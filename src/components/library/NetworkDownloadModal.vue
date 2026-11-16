<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useBookStore } from '@/stores/useBookStore'
import type { BookMeta, WebDavConnection, WebDavItem } from '@/types'
import {
  downloadWebDavFile,
  listWebDavDirectory,
  loadWebDavHistory,
  removeWebDavConnection,
  saveWebDavConnection
} from '@/services/network/webdavService'
import { getPlatformCapabilities, platformCredential } from '@/services/platform'
import { grantHostConsent, RemoteFetchConsentError } from '@/services/network/remoteFetch'
import { useAccessibleDialog } from '@/composables/ui/useAccessibleDialog'
import { useToast } from '@/composables/ui/useToast'
import { ArrowLeft, Download, Globe, Server } from 'lucide-vue-next'
import RemoteUrlDownloadTab from './RemoteUrlDownloadTab.vue'
import WebDavConnectionForm from './WebDavConnectionForm.vue'
import WebDavExplorerView from './WebDavExplorerView.vue'

const props = defineProps<{ open: boolean; initialTab?: 'url' | 'webdav' }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'downloaded', book: BookMeta): void }>()

const bookStore = useBookStore()
const dialogRef = ref<HTMLElement | null>(null)
const activeTab = ref<'url' | 'webdav'>(props.initialTab || 'url')
const { toastMessage, showToast } = useToast(3000)

useAccessibleDialog({
  isOpen: computed(() => props.open),
  containerRef: dialogRef,
  onClose: () => emit('close')
})

const webdavUrl = ref('')
const webdavPath = ref('/')
const webdavUsername = ref('')
const webdavPassword = ref('')
const rememberPassword = ref(false)
const webStorageConsent = ref(false)
const hasSecureCredentialStore = ref(false)
const webdavHistory = ref<WebDavConnection[]>([])
const pendingConsent = ref<{ kind: 'private' | 'tls'; url: string; origin: string } | null>(null)

const isWebDavConnecting = ref(false)
const isWebDavExplorerOpen = ref(false)
const currentBrowsePath = ref('/')
const webdavItems = ref<WebDavItem[]>([])
const downloadingItemPath = ref('')
const downloadedPaths = ref<Set<string>>(new Set())
const webdavError = ref('')
const webdavSuccessMsg = ref('')

watch(
  () => [props.open, props.initialTab] as const,
  async ([isOpen, tab]) => {
    if (!isOpen) return
    if (tab) activeTab.value = tab
    webdavError.value = ''
    webdavSuccessMsg.value = ''
    isWebDavExplorerOpen.value = false
    webdavHistory.value = await loadWebDavHistory()
  }
)

onMounted(async () => {
  hasSecureCredentialStore.value = (await getPlatformCapabilities()).hasSecureCredentialStore
  webdavHistory.value = await loadWebDavHistory()
})

async function approvePendingConsent() {
  const prompt = pendingConsent.value
  if (!prompt) return
  pendingConsent.value = null
  await grantHostConsent(prompt.url, {
    allowPrivateNetwork: prompt.kind === 'private' ? true : undefined,
    allowSelfSignedTls: prompt.kind === 'tls' ? true : undefined
  })
  await handleConnectWebDav()
}

async function handleConnectWebDav() {
  const url = webdavUrl.value.trim()
  if (!url || isWebDavConnecting.value) return
  if (rememberPassword.value && !hasSecureCredentialStore.value && !webStorageConsent.value) {
    webdavError.value = '웹 환경에서 비밀번호를 저장하려면 브라우저 로컬 저장소 안내에 동의해 주세요.'
    return
  }

  webdavError.value = ''
  webdavSuccessMsg.value = ''
  pendingConsent.value = null
  isWebDavConnecting.value = true
  const startPath = webdavPath.value.trim() || '/'

  try {
    webdavHistory.value = await saveWebDavConnection({
      alias: '',
      url,
      username: webdavUsername.value.trim(),
      password: webdavPassword.value,
      initialPath: startPath,
      rememberPassword: rememberPassword.value,
      webStorageConsent: webStorageConsent.value
    })
    const clean = url.split('?')[0].toLowerCase()
    if (clean.endsWith('.epub') || clean.endsWith('.txt')) {
      const downloaded = await downloadWebDavFile(url, '', webdavUsername.value.trim(), webdavPassword.value)
      const book = await bookStore.addBookFromBuffer(downloaded.buffer, `${downloaded.filename}.${downloaded.format}`, downloaded.format, downloaded.sourceUrl)
      emit('downloaded', book)
      emit('close')
      return
    }
    webdavItems.value = await listWebDavDirectory(url, startPath, webdavUsername.value.trim(), webdavPassword.value)
    currentBrowsePath.value = startPath.startsWith('/') ? startPath : `/${startPath}`
    isWebDavExplorerOpen.value = true
  } catch (err: any) {
    if (err instanceof RemoteFetchConsentError && (err.code === 'PRIVATE_NETWORK_CONFIRM_REQUIRED' || err.code === 'SELF_SIGNED_TLS_CONFIRM_REQUIRED')) {
      pendingConsent.value = { kind: err.code === 'PRIVATE_NETWORK_CONFIRM_REQUIRED' ? 'private' : 'tls', url, origin: err.origin }
    }
    webdavError.value = err?.message || 'WebDAV 서버에 연결할 수 없습니다. 주소와 계정 정보를 확인해 주세요.'
  } finally {
    isWebDavConnecting.value = false
  }
}

async function selectRecentConnection(conn: WebDavConnection, autoConnect = true) {
  webdavUrl.value = conn.url
  webdavPath.value = conn.initialPath || '/'
  webdavUsername.value = conn.username
  rememberPassword.value = Boolean(conn.rememberPassword)
  webStorageConsent.value = conn.credentialScope === 'web-acknowledged'
  webdavPassword.value = await platformCredential.getPassword(conn.id)
  webdavError.value = ''
  webdavSuccessMsg.value = ''
  if (autoConnect) await handleConnectWebDav()
}

async function handleDeleteRecentConnection(id: string) {
  webdavHistory.value = await removeWebDavConnection(id)
}

async function navigateWebDavFolder(targetPath: string) {
  if (isWebDavConnecting.value) return
  webdavError.value = ''
  isWebDavConnecting.value = true
  try {
    webdavItems.value = await listWebDavDirectory(webdavUrl.value.trim(), targetPath, webdavUsername.value.trim(), webdavPassword.value)
    currentBrowsePath.value = targetPath
  } catch (err: any) {
    webdavError.value = err?.message || '폴더 목록을 불러오지 못했습니다.'
  } finally {
    isWebDavConnecting.value = false
  }
}

async function navigateUpFolder() {
  const segments = currentBrowsePath.value.split('/').filter(Boolean)
  if (segments.length === 0) return
  segments.pop()
  await navigateWebDavFolder(segments.length > 0 ? `/${segments.join('/')}` : '/')
}

async function handleSelectWebDavItem(item: WebDavItem) {
  if (item.isDirectory) return navigateWebDavFolder(item.path)
  if (downloadingItemPath.value) return
  webdavError.value = ''
  downloadingItemPath.value = item.path
  try {
    const downloaded = await downloadWebDavFile(webdavUrl.value.trim(), item.path, webdavUsername.value.trim(), webdavPassword.value)
    const fileName = item.name.toLowerCase().endsWith(`.${downloaded.format}`) ? item.name : `${item.name}.${downloaded.format}`
    const book = await bookStore.addBookFromBuffer(downloaded.buffer, fileName, downloaded.format, downloaded.sourceUrl)
    downloadedPaths.value.add(item.path)
    emit('downloaded', book)
    showToast(`'${book.title}' 문서를 오프라인 서재에 저장했습니다.`)
  } catch (err: any) {
    webdavError.value = err?.message || `'${item.name}' 파일 다운로드에 실패했습니다.`
  } finally {
    downloadingItemPath.value = ''
  }
}
</script>

<template>
  <div
    v-if="open"
    ref="dialogRef"
    role="dialog"
    aria-modal="true"
    aria-labelledby="ev-network-download-title"
    tabindex="-1"
    class="fixed inset-0 z-50 w-full h-full flex flex-col overflow-hidden outline-none"
    :style="{ backgroundColor: 'var(--ev-bg)', color: 'var(--ev-text)', paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)', paddingLeft: 'env(safe-area-inset-left, 0px)', paddingRight: 'env(safe-area-inset-right, 0px)' }"
  >
    <h1 id="ev-network-download-title" class="sr-only">원격 문서 및 WebDAV 다운로드</h1>

    <WebDavExplorerView
      v-if="activeTab === 'webdav' && isWebDavExplorerOpen"
      :server-url="webdavUrl"
      :current-path="currentBrowsePath"
      :items="webdavItems"
      :is-connecting="isWebDavConnecting"
      :downloading-item-path="downloadingItemPath"
      :downloaded-paths="downloadedPaths"
      :error-message="webdavError"
      :toast-message="toastMessage"
      @back="isWebDavExplorerOpen = false"
      @refresh="navigateWebDavFolder"
      @navigate-up="navigateUpFolder"
      @select-item="handleSelectWebDavItem"
    />

    <template v-else>
      <header
        class="px-4 sm:px-8 py-4 border-b flex flex-wrap items-center justify-between gap-3 shrink-0"
        :style="{ backgroundColor: 'var(--ev-surface)', borderColor: 'var(--ev-border)' }"
      >
        <div class="flex items-center gap-3 min-w-0">
          <button
            type="button"
            class="p-2 rounded-xl border flex items-center justify-center hover:border-indigo-500 transition-colors shrink-0"
            :style="{ borderColor: 'var(--ev-border)' }"
            title="서재로 돌아가기"
            aria-label="서재로 돌아가기"
            @click="emit('close')"
          >
            <ArrowLeft class="w-4 h-4" />
          </button>
          <div class="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
            <Download class="w-5 h-5" />
          </div>
          <h2 class="text-lg font-extrabold tracking-tight">원격 문서 다운로드</h2>
        </div>

        <div class="flex items-center gap-1 p-1 rounded-xl bg-black/5 dark:bg-white/5">
          <button
            type="button"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
            :class="activeTab === 'url' ? 'bg-indigo-600 text-white shadow-xs' : 'opacity-70 hover:opacity-100'"
            @click="activeTab = 'url'"
          >
            <Globe class="w-4 h-4" /><span>URL 다운로드</span>
          </button>
          <button
            type="button"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
            :class="activeTab === 'webdav' ? 'bg-indigo-600 text-white shadow-xs' : 'opacity-70 hover:opacity-100'"
            @click="activeTab = 'webdav'"
          >
            <Server class="w-4 h-4" /><span>WebDAV 연결</span>
            <span
              v-if="webdavHistory.length > 0"
              class="px-1.5 py-0.2 rounded-full text-[10px] font-mono"
              :class="activeTab === 'webdav' ? 'bg-white/20 text-white' : 'bg-indigo-500/15 text-indigo-500'"
            >
              {{ webdavHistory.length }}
            </span>
          </button>
        </div>
      </header>

      <main class="flex-1 overflow-y-auto px-3 sm:px-4 py-3">
        <RemoteUrlDownloadTab
          v-if="activeTab === 'url'"
          @downloaded="emit('downloaded', $event)"
          @close="emit('close')"
        />
        <WebDavConnectionForm
          v-else
          v-model:url="webdavUrl"
          v-model:initial-path="webdavPath"
          v-model:username="webdavUsername"
          v-model:password="webdavPassword"
          v-model:remember-password="rememberPassword"
          v-model:web-storage-consent="webStorageConsent"
          :has-secure-credential-store="hasSecureCredentialStore"
          :is-connecting="isWebDavConnecting"
          :error-message="webdavError"
          :success-message="webdavSuccessMsg"
          :pending-consent="pendingConsent"
          :history="webdavHistory"
          @connect="handleConnectWebDav"
          @approve-consent="approvePendingConsent"
          @select-history="selectRecentConnection"
          @delete-history="handleDeleteRecentConnection"
        />
      </main>
    </template>
  </div>
</template>
