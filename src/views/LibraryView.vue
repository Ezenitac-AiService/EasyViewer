<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useBookStore } from '@/stores/useBookStore'
import { useSettingsStore } from '@/stores/useSettingsStore'
import {
  getPlatformCapabilities,
  isSupportedBookFileName,
  MAX_LOCAL_BOOK_BYTES,
  platformDialog,
  platformDragDrop,
  type DroppedBookInput,
  type SelectedBookFile
} from '@/services/platform'
import { useToast } from '@/composables/ui/useToast'
import { useBookCoverUrls } from '@/composables/library/useBookCoverUrls'
import { useLibraryImport, type StorageRecoveryChoice } from '@/composables/library/useLibraryImport'
import type { BookFormat, BookMeta, StorageWriteError } from '@/types'
import InAppConfirmModal from '@/components/common/InAppConfirmModal.vue'
import NetworkDownloadModal from '@/components/library/NetworkDownloadModal.vue'
import StorageFolderMenu from '@/components/library/StorageFolderMenu.vue'
import SyncModal from '@/components/library/SyncModal.vue'
import {
  BookOpen,
  FileText,
  Upload,
  Download,
  RefreshCw,
  Trash2,
  Sun,
  Moon,
  Coffee,
  Search,
  Sparkles,
  CheckCircle2
} from 'lucide-vue-next'

const router = useRouter()
const bookStore = useBookStore()
const settingsStore = useSettingsStore()

const fileInputRef = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)
let unlistenDragDrop: (() => void) | null = null
const filterFormat = ref<'all' | BookFormat>('all')
const searchQuery = ref('')
const showDownloadModal = ref(false)
const showSyncModal = ref(false)
const { toastMessage, showToast } = useToast(3000)

const isDesktop = ref(false)
const showStoragePanel = ref(false)
const storageDir = ref('')
const storageIsCustom = ref(false)
const recoveryModal = ref<{ open: boolean; message: string; resolve: (c: StorageRecoveryChoice) => void } | null>(null)

const { coverUrlMap, revokeBookUrl } = useBookCoverUrls(
  computed(() => bookStore.books),
  (bookId) => bookStore.loadBookCoverBlob(bookId)
)

const errorText = (err: unknown): string => (err instanceof Error ? err.message : String(err))

async function refreshStorageDir() {
  storageDir.value = await bookStore.getStorageDir()
  storageIsCustom.value = await bookStore.isCustomStorageDir()
}

async function openStorageFolder() {
  try { await bookStore.openStorageDir() } catch (err) { showToast(`폴더를 열 수 없습니다: ${errorText(err)}`) }
}

async function changeStorageFolder(): Promise<boolean> {
  try {
    const picked = await platformDialog.pickStorageDirectory(storageDir.value || undefined)
    if (!picked) return false
    await bookStore.setStorageDir(picked)
    await refreshStorageDir()
    showToast('저장 폴더를 변경했습니다. 이제부터 추가하는 책이 이 폴더에 저장됩니다.')
    return true
  } catch (err) {
    showToast(`저장 폴더를 변경할 수 없습니다: ${errorText(err)}`)
    return false
  }
}

async function resetStorageFolder() {
  try {
    await bookStore.setStorageDir(null)
    await refreshStorageDir()
    showToast('기본 저장 폴더로 되돌렸습니다.')
  } catch (err) {
    showToast(`기본 폴더로 되돌릴 수 없습니다: ${errorText(err)}`)
  }
}

function promptStorageRecovery(err: StorageWriteError): Promise<StorageRecoveryChoice> {
  return new Promise((resolve) => {
    recoveryModal.value = { open: true, message: err.message, resolve }
  })
}

function finishRecovery(choice: StorageRecoveryChoice) {
  const modal = recoveryModal.value
  recoveryModal.value = null
  modal?.resolve(choice)
}

const { isImporting, importProgress, importSelectedFiles } = useLibraryImport({
  addBook: async (file) => {
    const prevIds = new Set(bookStore.books.map((b) => b.id))
    if (file.sourcePath) {
      const book = await bookStore.addBookFromNativePath(file.sourcePath, file.name)
      return { book, deduplicated: prevIds.has(book.id) }
    }
    const buf = await file.readBuffer()
    const book = await bookStore.addBookFromBuffer(buf, file.name)
    return { book, deduplicated: prevIds.has(book.id) }
  },
  switchToDefaultStorage: resetStorageFolder,
  pickCustomStorage: changeStorageFolder,
  promptStorageRecovery,
  showToast
})

async function handleRemoveBook(book: BookMeta) {
  const deleteFile = await bookStore.willDeleteFileOnRemove(book.id)
  const needsConfirm = !isDesktop.value || deleteFile
  if (needsConfirm) {
    try {
      const ok = await platformDialog.confirmAction({
        title: '책 삭제',
        message:
          isDesktop.value && deleteFile
            ? `'${book.title}'을(를) 서재에서 삭제하고 저장 폴더의 파일도 삭제합니다.\n삭제한 파일은 되돌릴 수 없습니다.`
            : `'${book.title}'을(를) 서재에서 삭제하시겠습니까?`,
        kind: 'warning',
        confirmLabel: '삭제',
        cancelLabel: '취소'
      })
      if (!ok) return
    } catch { return }
  }
  const fileDeleted = await bookStore.removeBook(book.id)
  revokeBookUrl(book.id)
  if (isDesktop.value) {
    showToast(fileDeleted ? '서재에서 삭제하고 파일도 삭제했습니다.' : '서재에서 삭제했습니다. 파일은 저장 폴더에 남아 있습니다.')
  }
}

onMounted(async () => {
  await settingsStore.initSettings()
  await bookStore.initLibrary()
  const caps = await getPlatformCapabilities()
  isDesktop.value = caps.canPickStorageDir
  if (isDesktop.value) await refreshStorageDir()
  unlistenDragDrop = await platformDragDrop.subscribe({
    onDragStateChange: (dragging) => { isDragging.value = dragging },
    onFilesDropped: async (items: DroppedBookInput[]) => {
      const selected: SelectedBookFile[] = items.map((item) => ({
        name: item.fileName,
        size: item.buffer.byteLength,
        sourcePath: item.sourcePath,
        readBuffer: async () => item.buffer
      }))
      await importSelectedFiles(selected)
    },
    onError: (err) => showToast(errorText(err))
  })
})

onBeforeUnmount(() => { unlistenDragDrop?.() })

const filteredBooks = computed(() =>
  bookStore.sortedBooks.filter((book) => {
    if (filterFormat.value !== 'all' && book.format !== filterFormat.value) return false
    if (!searchQuery.value.trim()) return true
    const q = searchQuery.value.toLowerCase()
    return book.title.toLowerCase().includes(q) || book.author.toLowerCase().includes(q)
  })
)

async function handleFileSelect(e: Event) {
  const input = e.target as HTMLInputElement
  if (!input.files || input.files.length === 0) return
  const valid: SelectedBookFile[] = []
  let rejected = ''
  for (const file of Array.from(input.files)) {
    if (!isSupportedBookFileName(file.name)) continue
    if (file.size > MAX_LOCAL_BOOK_BYTES) {
      rejected = `허용된 최대 도서 파일 크기(256 MB)를 초과했습니다: ${file.name}`
      continue
    }
    valid.push({ name: file.name, size: file.size, readBuffer: () => file.arrayBuffer() })
  }
  if (valid.length > 0) await importSelectedFiles(valid)
  else showToast(rejected || '지원하는 파일 형식(.txt, .epub)을 선택해 주세요.')
  input.value = ''
}

function cycleTheme() {
  const order: Array<'light' | 'sepia' | 'dark'> = ['light', 'sepia', 'dark']
  settingsStore.setTheme(order[(order.indexOf(settingsStore.settings.theme) + 1) % order.length])
}

const formatFileSize = (bytes: number): string =>
  bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / (1024 * 1024)).toFixed(2)} MB`
</script>

<template>
  <div class="h-full w-full flex flex-col overflow-hidden select-none">
    <header
      class="px-4 sm:px-8 pb-4 border-b flex flex-wrap items-center justify-between gap-3 shrink-0"
      :style="{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)', backgroundColor: 'var(--ev-surface)', borderColor: 'var(--ev-border)' }"
    >
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
          <BookOpen class="w-5 h-5" />
        </div>
        <h1 class="text-lg font-extrabold tracking-tight flex items-center gap-2">
          <span>EasyViewer</span>
          <span class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">TXT · EPUB</span>
        </h1>
      </div>

      <div class="flex items-center gap-2">
        <input ref="fileInputRef" type="file" accept=".txt,.epub" multiple class="hidden" @change="handleFileSelect" />
        <button type="button" :disabled="isImporting" class="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold shadow-sm transition-all" @click="fileInputRef?.click()">
          <Upload class="w-4 h-4" /><span>{{ isImporting ? '가져오는 중...' : '파일 열기' }}</span>
        </button>
        <button type="button" class="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold hover:border-indigo-500 transition-all" :style="{ borderColor: 'var(--ev-border)' }" @click="showDownloadModal = true">
          <Download class="w-4 h-4 text-indigo-500" /><span>다운로드</span>
        </button>
        <StorageFolderMenu
          v-if="isDesktop"
          :open="showStoragePanel"
          :storage-dir="storageDir"
          :storage-is-custom="storageIsCustom"
          :delete-file-on-remove="bookStore.deleteFileOnRemove"
          @toggle="showStoragePanel = !showStoragePanel"
          @close="showStoragePanel = false"
          @open-folder="openStorageFolder"
          @change-folder="changeStorageFolder"
          @reset-folder="resetStorageFolder"
          @toggle-delete-file="bookStore.setDeleteFileOnRemove"
        />
        <button v-show="false" type="button" title="마지막 읽은 페이지 동기화" aria-label="마지막 읽은 페이지 동기화" @click="showSyncModal = true">
          <RefreshCw class="w-4 h-4" />
        </button>
        <button
          type="button"
          class="p-2 rounded-xl border hover:border-indigo-500 transition-all"
          :style="{ borderColor: 'var(--ev-border)' }"
          :title="`현재 테마: ${settingsStore.settings.theme.toUpperCase()} (클릭하여 전환)`"
          :aria-label="`현재 테마: ${settingsStore.settings.theme.toUpperCase()} (클릭하여 전환)`"
          @click="cycleTheme"
        >
          <Sun v-if="settingsStore.settings.theme === 'light'" class="w-4 h-4 text-amber-500" />
          <Coffee v-else-if="settingsStore.settings.theme === 'sepia'" class="w-4 h-4 text-amber-800" />
          <Moon v-else class="w-4 h-4 text-indigo-400" />
        </button>
      </div>
    </header>

    <div class="px-4 sm:px-8 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
      <div class="flex items-center gap-1.5 p-1 rounded-xl bg-black/5 dark:bg-white/5">
        <button
          v-for="tab in ([{ key: 'all', label: '전체' }, { key: 'epub', label: 'EPUB' }, { key: 'txt', label: 'TXT' }] as const)"
          :key="tab.key"
          type="button"
          class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
          :class="filterFormat === tab.key ? 'bg-indigo-600 text-white shadow-xs' : 'opacity-70 hover:opacity-100'"
          @click="filterFormat = tab.key"
        >
          {{ tab.label }}
        </button>
      </div>
      <div class="relative w-full sm:w-64">
        <Search class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
        <input v-model="searchQuery" type="text" placeholder="서재 내 제목·저자 검색..." class="w-full pl-9 pr-3 py-2 rounded-xl border text-xs bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500" :style="{ borderColor: 'var(--ev-border)' }" />
      </div>
    </div>

    <main class="flex-1 overflow-y-auto px-4 sm:px-8 pb-8">
      <div
        v-if="isImporting && importProgress"
        data-testid="import-progress-banner"
        class="mb-4 px-4 py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between gap-3"
        :style="{ backgroundColor: 'var(--ev-surface)', borderColor: 'var(--ev-border)' }"
      >
        <span>도서 가져오는 중 ({{ importProgress.current }}/{{ importProgress.total }}) · {{ importProgress.fileName }}</span>
      </div>
      <div v-if="filteredBooks.length === 0" class="h-64 rounded-3xl border-2 border-dashed flex flex-col items-center justify-center text-center p-6" :style="{ borderColor: 'var(--ev-border)' }">
        <BookOpen class="w-12 h-12 mb-3 opacity-30" />
        <p class="text-sm font-semibold mb-1">표시할 문서가 없습니다</p>
        <p class="text-xs opacity-60 mb-4">컴퓨터/기기의 .txt, .epub 파일을 끌어다 놓거나 샘플 문서를 불러오세요.</p>
        <button type="button" class="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold" @click="bookStore.seedSampleBooks()">
          <Sparkles class="w-4 h-4" /><span>기본 샘플 북(EPUB & TXT) 다시 생성</span>
        </button>
      </div>

      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <div
          v-for="book in filteredBooks"
          :key="book.id"
          class="group relative rounded-2xl border p-4 flex flex-col justify-between transition-all hover:-translate-y-0.5 hover:shadow-lg hover:border-indigo-500/60 cursor-pointer"
          :style="{ backgroundColor: 'var(--ev-surface)', borderColor: 'var(--ev-border)' }"
          @click="router.push({ name: 'reader', params: { id: book.id } })"
        >
          <div>
            <div class="flex items-center justify-between gap-2 mb-3">
              <div class="flex items-center gap-1.5">
                <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide" :class="book.format === 'epub' ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400' : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'">
                  <BookOpen v-if="book.format === 'epub'" class="w-3 h-3" /><FileText v-else class="w-3 h-3" />{{ book.format }}
                </span>
                <span v-if="book.isOfflineCached" class="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 opacity-75" title="오프라인 읽기 가능">
                  <CheckCircle2 class="w-3 h-3 text-emerald-500" />오프라인
                </span>
              </div>
              <button
                type="button"
                class="p-1.5 rounded-lg opacity-0 group-hover:opacity-70 hover:!opacity-100 hover:bg-red-500/10 hover:text-red-500 transition-all"
                :title="isDesktop && book.storedPath ? (bookStore.deleteFileOnRemove ? '서재에서 삭제 (파일도 삭제)' : '서재에서 삭제 (파일은 유지)') : '서재에서 삭제'"
                aria-label="서재에서 삭제"
                @click.stop="handleRemoveBook(book)"
              >
                <Trash2 class="w-4 h-4" />
              </button>
            </div>
            <img v-if="coverUrlMap[book.id]" :src="coverUrlMap[book.id]" :alt="book.title" class="w-full h-36 object-cover rounded-xl mb-3" />
            <h2 class="text-base font-bold line-clamp-2 mb-1 group-hover:text-indigo-500 transition-colors">{{ book.title }}</h2>
            <p class="text-xs opacity-65 truncate mb-4">{{ book.author }} · {{ formatFileSize(book.fileSize) }}</p>
          </div>
          <div class="pt-3 border-t" :style="{ borderColor: 'var(--ev-border)' }">
            <div class="flex items-center justify-between text-xs mb-1.5">
              <span class="truncate opacity-75 max-w-[70%]">{{ book.lastLocation?.chapterTitle || '읽기 전' }}</span>
              <span class="font-mono font-bold text-indigo-600 dark:text-indigo-400">{{ (book.lastLocation?.percentage ?? 0).toFixed(1) }}%</span>
            </div>
            <div class="w-full h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
              <div class="h-full bg-indigo-600 rounded-full transition-all duration-300" :style="{ width: `${book.lastLocation?.percentage ?? 0}%` }" />
            </div>
          </div>
        </div>
      </div>
    </main>

    <div v-if="isDragging" class="fixed inset-0 z-50 bg-indigo-600/20 backdrop-blur-xs border-4 border-dashed border-indigo-500 flex items-center justify-center pointer-events-none">
      <div class="px-8 py-6 rounded-2xl bg-slate-900 text-white shadow-2xl flex items-center gap-3">
        <Upload class="w-6 h-6 text-indigo-400 animate-bounce" /><span class="text-base font-bold">여기에 .TXT 또는 .EPUB 파일을 놓아 서재에 추가하세요</span>
      </div>
    </div>
    <div v-if="toastMessage" class="fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-medium shadow-xl">{{ toastMessage }}</div>

    <InAppConfirmModal
      v-if="recoveryModal"
      :open="recoveryModal.open"
      title="저장 폴더 쓰기 실패"
      :message="recoveryModal.message"
      kind="warning"
      confirm-label="기본 폴더로 전환"
      secondary-label="다른 폴더 선택"
      cancel-label="취소"
      @confirm="finishRecovery('default')"
      @secondary="finishRecovery('choose')"
      @cancel="finishRecovery('cancel')"
    />
    <NetworkDownloadModal :open="showDownloadModal" @close="showDownloadModal = false" @downloaded="(b) => showToast(`'${b.title}' 다운로드 및 오프라인 저장 완료!`)" />
    <SyncModal :open="showSyncModal" @close="showSyncModal = false" />
  </div>
</template>
