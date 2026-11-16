<script setup lang="ts">
import { computed, ref } from 'vue'
import type { WebDavItem } from '@/types'
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ArrowUpDown,
  BookOpen,
  CheckCircle2,
  CornerLeftUp,
  FileText,
  Folder,
  Loader2,
  RefreshCw,
  Search,
  Server
} from 'lucide-vue-next'

const props = defineProps<{
  serverUrl: string
  currentPath: string
  items: WebDavItem[]
  isConnecting: boolean
  downloadingItemPath: string
  downloadedPaths: Set<string>
  errorMessage: string
  toastMessage: string
}>()

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'refresh', path: string): void
  (e: 'navigate-up'): void
  (e: 'select-item', item: WebDavItem): void
}>()

const searchQuery = ref('')
const sortKey = ref<'name' | 'date' | 'size'>('name')
const sortOrder = ref<'asc' | 'desc'>('asc')

function toggleSort(key: 'name' | 'date' | 'size') {
  if (sortKey.value === key) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortOrder.value = key === 'name' ? 'asc' : 'desc'
  }
}

const activeServerLabel = computed(() => {
  try {
    return new URL(props.serverUrl.trim()).host
  } catch {
    return props.serverUrl.trim() || 'WebDAV 서버'
  }
})

const currentFolderName = computed(() => {
  const parts = props.currentPath.split('/').filter(Boolean)
  if (parts.length > 0) return parts[parts.length - 1]
  try {
    const urlParts = decodeURIComponent(new URL(props.serverUrl.trim()).pathname).split('/').filter(Boolean)
    if (urlParts.length > 0) return urlParts[urlParts.length - 1]
  } catch { /* ignore */ }
  return '루트 (/)'
})

const filteredItems = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  const baseList = q ? props.items.filter((i) => i.name.toLowerCase().includes(q)) : [...props.items]
  const key = sortKey.value
  const dir = sortOrder.value === 'asc' ? 1 : -1
  return baseList.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
    let cmp = 0
    if (key === 'date') {
      const ta = a.lastModified ? Date.parse(a.lastModified) || 0 : 0
      const tb = b.lastModified ? Date.parse(b.lastModified) || 0 : 0
      cmp = ta - tb
    } else if (key === 'size') {
      cmp = (a.size || 0) - (b.size || 0)
    }
    if (cmp === 0) cmp = a.name.localeCompare(b.name, 'ko', { numeric: true, sensitivity: 'base' })
    return cmp * dir
  })
})

const folderCount = computed(() => filteredItems.value.filter((i) => i.isDirectory).length)
const fileCount = computed(() => filteredItems.value.filter((i) => !i.isDirectory).length)

function formatSize(bytes: number): string {
  if (!bytes || bytes <= 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function formatItemDate(rawDate?: string): string {
  if (!rawDate) return ''
  const parsed = new Date(rawDate)
  if (Number.isNaN(parsed.getTime())) return rawDate
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`
}
</script>

<template>
  <header
    class="px-4 sm:px-8 py-4 border-b flex flex-wrap items-center justify-between gap-3 shrink-0"
    :style="{ backgroundColor: 'var(--ev-surface)', borderColor: 'var(--ev-border)' }"
  >
    <div class="flex items-center gap-3 min-w-0">
      <button
        type="button"
        class="p-2 rounded-xl border flex items-center justify-center hover:border-indigo-500 transition-colors shrink-0"
        :style="{ borderColor: 'var(--ev-border)' }"
        title="WebDAV 연결 설정으로 돌아가기"
        aria-label="WebDAV 연결 설정으로 돌아가기"
        @click="emit('back')"
      >
        <ArrowLeft class="w-4 h-4" />
      </button>
      <div class="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
        <Server class="w-5 h-5" />
      </div>
      <h1 class="text-lg font-extrabold tracking-tight flex items-center gap-2 truncate">
        <span class="truncate">{{ activeServerLabel }}</span>
        <span class="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shrink-0">
          연결됨
        </span>
      </h1>
    </div>
  </header>

  <div
    class="px-4 sm:px-8 py-3 border-b flex flex-wrap items-center justify-between gap-3 shrink-0"
    :style="{ backgroundColor: 'var(--ev-surface)', borderColor: 'var(--ev-border)' }"
  >
    <div class="flex items-center gap-2 min-w-0">
      <button
        type="button"
        class="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold hover:border-indigo-500 transition-colors"
        :style="{ borderColor: 'var(--ev-border)' }"
        title="현재 폴더 새로고침"
        aria-label="현재 폴더 새로고침"
        @click="emit('refresh', currentPath)"
      >
        <RefreshCw class="w-4 h-4 text-indigo-500" :class="{ 'animate-spin': isConnecting }" />
        <span class="hidden sm:inline">새로고침</span>
      </button>
      <button
        v-if="currentPath !== '/'"
        type="button"
        class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold hover:border-indigo-500 shrink-0 transition-colors"
        :style="{ borderColor: 'var(--ev-border)' }"
        @click="emit('navigate-up')"
      >
        <CornerLeftUp class="w-3.5 h-3.5 text-indigo-500" />
        <span>상위 폴더</span>
      </button>
      <span class="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-xs font-bold break-all">
        {{ currentFolderName }}
      </span>
    </div>

    <div class="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
      <span class="text-xs opacity-65 shrink-0">
        폴더 <strong>{{ folderCount }}</strong> · 문서 <strong>{{ fileCount }}</strong>
      </span>
      <div class="flex items-center gap-1 p-1 rounded-xl bg-black/5 dark:bg-white/5 shrink-0">
        <button
          v-for="opt in ([{ key: 'name', label: '이름' }, { key: 'date', label: '날짜' }, { key: 'size', label: '용량' }] as const)"
          :key="opt.key"
          type="button"
          class="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all"
          :class="sortKey === opt.key ? 'bg-indigo-600 text-white shadow-xs' : 'opacity-70 hover:opacity-100'"
          :title="`${opt.label} 기준 정렬 (${sortKey === opt.key && sortOrder === 'asc' ? '오름차순' : '내림차순'})`"
          @click="toggleSort(opt.key)"
        >
          <span>{{ opt.label }}</span>
          <template v-if="sortKey === opt.key">
            <ArrowUp v-if="sortOrder === 'asc'" class="w-3 h-3" />
            <ArrowDown v-else class="w-3 h-3" />
          </template>
          <ArrowUpDown v-else class="w-3 h-3 opacity-40" />
        </button>
      </div>
      <div class="relative w-full sm:w-56">
        <Search class="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="현재 폴더 내 이름 검색..."
          class="w-full pl-8 pr-3 py-1.5 rounded-xl border text-xs bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
          :style="{ borderColor: 'var(--ev-border)' }"
        />
      </div>
    </div>
  </div>

  <div
    v-if="errorMessage"
    class="mx-4 sm:mx-8 mt-4 flex items-start gap-2 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-xs shrink-0"
  >
    <AlertCircle class="w-4 h-4 shrink-0 mt-0.5" />
    <span>{{ errorMessage }}</span>
  </div>

  <main class="flex-1 overflow-y-auto px-4 sm:px-8 py-6">
    <div v-if="isConnecting" class="h-72 flex flex-col items-center justify-center gap-3 opacity-75">
      <Loader2 class="w-8 h-8 animate-spin text-indigo-500" />
      <p class="text-sm font-semibold">폴더 목록을 불러오고 있습니다...</p>
    </div>

    <div
      v-else-if="filteredItems.length === 0"
      class="h-72 rounded-3xl border-2 border-dashed flex flex-col items-center justify-center text-center p-6"
      :style="{ borderColor: 'var(--ev-border)' }"
    >
      <Folder class="w-12 h-12 mb-3 opacity-30" />
      <p class="text-sm font-bold mb-1">표시할 폴더나 문서(.txt, .epub)가 없습니다</p>
      <p class="text-xs opacity-60 mb-4">다른 하위 폴더로 이동하거나 상위 폴더 버튼을 눌러 탐색해 보세요.</p>
      <button
        v-if="currentPath !== '/'"
        type="button"
        class="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold"
        @click="emit('navigate-up')"
      >
        <CornerLeftUp class="w-4 h-4" />
        <span>상위 폴더로 이동</span>
      </button>
    </div>

    <div
      v-else
      class="rounded-2xl border overflow-hidden divide-y shadow-xs"
      :style="{ backgroundColor: 'var(--ev-surface)', borderColor: 'var(--ev-border)' }"
    >
      <button
        v-for="item in filteredItems"
        :key="item.path"
        type="button"
        :disabled="downloadingItemPath === item.path"
        class="w-full px-4 sm:px-6 py-3.5 flex items-start sm:items-center gap-3.5 text-left hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50 transition-colors"
        @click="emit('select-item', item)"
      >
        <div
          class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          :class="item.isDirectory ? 'bg-amber-500/15 text-amber-500' : item.format === 'epub' ? 'bg-indigo-500/15 text-indigo-500' : 'bg-emerald-500/15 text-emerald-500'"
        >
          <Loader2 v-if="downloadingItemPath === item.path" class="w-5 h-5 animate-spin text-indigo-500" />
          <Folder v-else-if="item.isDirectory" class="w-5 h-5" />
          <BookOpen v-else-if="item.format === 'epub'" class="w-5 h-5" />
          <FileText v-else class="w-5 h-5" />
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <p class="text-sm font-bold break-all whitespace-normal leading-snug">{{ item.name }}</p>
            <span
              v-if="downloadedPaths.has(item.path)"
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shrink-0"
            >
              <CheckCircle2 class="w-3 h-3" />저장됨
            </span>
          </div>
          <p v-if="(!item.isDirectory && item.size) || item.lastModified" class="text-xs opacity-60 mt-1 font-mono flex flex-wrap items-center gap-1.5">
            <span v-if="!item.isDirectory && item.size">{{ formatSize(item.size) }}</span>
            <span v-if="!item.isDirectory && item.size && item.lastModified">·</span>
            <span v-if="item.lastModified">{{ formatItemDate(item.lastModified) }}</span>
          </p>
        </div>
      </button>
    </div>
  </main>

  <div
    v-if="toastMessage"
    class="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-medium shadow-xl flex items-center gap-2"
  >
    <CheckCircle2 class="w-4 h-4 text-emerald-400" />
    <span>{{ toastMessage }}</span>
  </div>
</template>
