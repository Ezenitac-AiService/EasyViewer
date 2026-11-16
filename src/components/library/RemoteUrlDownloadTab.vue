<script setup lang="ts">
import { ref } from 'vue'
import { useBookStore } from '@/stores/useBookStore'
import type { BookMeta } from '@/types'
import { grantHostConsent, RemoteFetchConsentError } from '@/services/network/remoteFetch'
import { AlertCircle, CheckCircle2, Download, Globe, Loader2 } from 'lucide-vue-next'

const emit = defineEmits<{
  (e: 'downloaded', book: BookMeta): void
  (e: 'close'): void
}>()

const bookStore = useBookStore()
const remoteUrl = ref('')
const isDownloading = ref(false)
const progressPercent = ref(0)
const errorMessage = ref('')
const pendingConsent = ref<{ kind: 'private' | 'tls'; url: string; origin: string } | null>(null)

async function approveConsent() {
  const prompt = pendingConsent.value
  if (!prompt) return
  pendingConsent.value = null
  await grantHostConsent(prompt.url, {
    allowPrivateNetwork: prompt.kind === 'private' ? true : undefined,
    allowSelfSignedTls: prompt.kind === 'tls' ? true : undefined
  })
  await handleDownload()
}

async function handleDownload() {
  if (!remoteUrl.value.trim() || isDownloading.value) return
  errorMessage.value = ''
  pendingConsent.value = null
  isDownloading.value = true
  progressPercent.value = 5

  try {
    const book = await bookStore.importFromUrl(remoteUrl.value, (prog) => {
      progressPercent.value = prog.percent
    })
    remoteUrl.value = ''
    emit('downloaded', book)
    emit('close')
  } catch (err: any) {
    if (
      err instanceof RemoteFetchConsentError &&
      (err.code === 'PRIVATE_NETWORK_CONFIRM_REQUIRED' ||
        err.code === 'SELF_SIGNED_TLS_CONFIRM_REQUIRED')
    ) {
      pendingConsent.value = {
        kind: err.code === 'PRIVATE_NETWORK_CONFIRM_REQUIRED' ? 'private' : 'tls',
        url: remoteUrl.value.trim(),
        origin: err.origin
      }
    }
    errorMessage.value =
      err?.message || '원격 파일 다운로드 중 오류가 발생했습니다. CORS 정책 또는 URL을 확인해 주세요.'
  } finally {
    isDownloading.value = false
  }
}
</script>

<template>
  <div class="w-full">
    <div
      class="rounded-2xl border p-4 shadow-xs"
      :style="{ backgroundColor: 'var(--ev-surface)', borderColor: 'var(--ev-border)' }"
    >
      <div class="flex items-center gap-2 mb-3">
        <Globe class="w-4 h-4 text-indigo-500" />
        <h2 class="text-sm font-bold">원격 문서 URL 직접 다운로드</h2>
      </div>

      <form class="space-y-4" @submit.prevent="handleDownload">
        <div>
          <label class="block text-xs font-semibold mb-1.5 opacity-80">
            원격 문서 URL (.txt 또는 .epub)
          </label>
          <input
            v-model="remoteUrl"
            type="url"
            required
            placeholder="https://example.com/books/novel.epub"
            class="w-full px-3.5 py-2 rounded-xl border text-xs bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
            :style="{ borderColor: 'var(--ev-border)' }"
          />
          <p class="mt-1.5 text-xs opacity-65">
            다운로드된 문서는 기기 내부 로컬 스토리지에 영구 캐싱되어 오프라인에서도 즉시 읽을 수 있습니다.
          </p>
        </div>

        <div v-if="isDownloading" class="space-y-1.5">
          <div class="flex items-center justify-between text-xs font-medium">
            <span class="flex items-center gap-1.5 text-indigo-500">
              <Loader2 class="w-3.5 h-3.5 animate-spin" />
              오프라인 저장소로 다운로드 중...
            </span>
            <span class="font-mono">{{ progressPercent }}%</span>
          </div>
          <div class="w-full h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
            <div class="h-full bg-indigo-600 transition-all duration-200" :style="{ width: `${progressPercent}%` }" />
          </div>
        </div>

        <div
          v-if="errorMessage"
          class="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-xs"
        >
          <AlertCircle class="w-4 h-4 shrink-0 mt-0.5" />
          <span>{{ errorMessage }}</span>
        </div>

        <div
          v-if="pendingConsent"
          class="flex flex-col gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-300 text-xs"
        >
          <span>
            {{
              pendingConsent.kind === 'private'
                ? `사설 네트워크(${pendingConsent.origin}) 연결을 신뢰하고 허용하시겠습니까?`
                : `자체 서명 TLS 인증서(${pendingConsent.origin}) 예외를 허용하시겠습니까?`
            }}
          </span>
          <div class="flex justify-end">
            <button
              type="button"
              class="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold"
              @click="approveConsent"
            >
              신뢰하고 다시 시도
            </button>
          </div>
        </div>

        <div class="flex items-center justify-end gap-2 pt-3 border-t" :style="{ borderColor: 'var(--ev-border)' }">
          <button
            type="submit"
            :disabled="isDownloading || !remoteUrl.trim()"
            class="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <Download v-if="!isDownloading" class="w-3.5 h-3.5" />
            <CheckCircle2 v-else class="w-3.5 h-3.5" />
            <span>다운로드</span>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
