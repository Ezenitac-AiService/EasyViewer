<script setup lang="ts">
import type { WebDavConnection } from '@/types'
import { AlertCircle, CheckCircle2, Clock, Loader2, Server, Trash2 } from 'lucide-vue-next'

defineProps<{
  url: string
  initialPath: string
  username: string
  password: string
  rememberPassword: boolean
  webStorageConsent: boolean
  hasSecureCredentialStore: boolean
  isConnecting: boolean
  errorMessage: string
  successMessage: string
  pendingConsent: { kind: 'private' | 'tls'; origin: string } | null
  history: WebDavConnection[]
}>()

const emit = defineEmits<{
  (e: 'update:url', val: string): void
  (e: 'update:initialPath', val: string): void
  (e: 'update:username', val: string): void
  (e: 'update:password', val: string): void
  (e: 'update:rememberPassword', val: boolean): void
  (e: 'update:webStorageConsent', val: boolean): void
  (e: 'connect'): void
  (e: 'approve-consent'): void
  (e: 'select-history', conn: WebDavConnection, autoConnect: boolean): void
  (e: 'delete-history', id: string): void
}>()

function formatDate(ts: number): string {
  const d = new Date(ts)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`
}
</script>

<template>
  <div class="w-full grid grid-cols-1 lg:grid-cols-12 gap-3">
    <div class="lg:col-span-5">
      <div
        class="rounded-2xl border p-3.5 sm:p-4 shadow-xs"
        :style="{ backgroundColor: 'var(--ev-surface)', borderColor: 'var(--ev-border)' }"
      >
        <div class="flex items-center gap-2 mb-3">
          <Server class="w-4 h-4 text-indigo-500" />
          <h2 class="text-sm font-bold">WebDAV 서버 연결 정보 입력</h2>
        </div>

        <form class="space-y-2.5" @submit.prevent="emit('connect')">
          <div>
            <label class="block text-[11px] font-semibold mb-1 opacity-80">WebDAV 서버 URL *</label>
            <input
              :value="url"
              type="url"
              required
              placeholder="https://example.synology.me"
              class="w-full px-3 py-1.5 rounded-xl border text-xs bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
              :style="{ borderColor: 'var(--ev-border)' }"
              @input="emit('update:url', ($event.target as HTMLInputElement).value)"
            />
          </div>

          <div class="grid grid-cols-3 gap-2">
            <div>
              <label class="block text-[11px] font-semibold mb-1 opacity-80">초기 경로</label>
              <input
                :value="initialPath"
                type="text"
                placeholder="/"
                class="w-full px-3 py-1.5 rounded-xl border text-xs bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
                :style="{ borderColor: 'var(--ev-border)' }"
                @input="emit('update:initialPath', ($event.target as HTMLInputElement).value)"
              />
            </div>
            <div>
              <label class="block text-[11px] font-semibold mb-1 opacity-80">아이디</label>
              <input
                :value="username"
                type="text"
                autocomplete="username"
                placeholder="아이디"
                class="w-full px-3 py-1.5 rounded-xl border text-xs bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
                :style="{ borderColor: 'var(--ev-border)' }"
                @input="emit('update:username', ($event.target as HTMLInputElement).value)"
              />
            </div>
            <div>
              <label class="block text-[11px] font-semibold mb-1 opacity-80">비밀번호</label>
              <input
                :value="password"
                type="password"
                autocomplete="current-password"
                placeholder="비밀번호"
                class="w-full px-3 py-1.5 rounded-xl border text-xs bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
                :style="{ borderColor: 'var(--ev-border)' }"
                @input="emit('update:password', ($event.target as HTMLInputElement).value)"
              />
            </div>
          </div>

          <div class="space-y-1.5 pt-1 text-xs">
            <label class="flex items-center gap-2 cursor-pointer select-none">
              <input
                :checked="rememberPassword"
                type="checkbox"
                class="rounded border-gray-400"
                @change="emit('update:rememberPassword', ($event.target as HTMLInputElement).checked)"
              />
              <span>
                비밀번호 기억
                <span class="opacity-65">
                  ({{ hasSecureCredentialStore ? 'OS 키체인 안전 저장' : '기본 세션 메모리 유지' }})
                </span>
              </span>
            </label>
            <label
              v-if="rememberPassword && !hasSecureCredentialStore"
              class="flex items-start gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/25 cursor-pointer select-none text-[11px]"
            >
              <input
                :checked="webStorageConsent"
                type="checkbox"
                class="mt-0.5 rounded border-gray-400"
                @change="emit('update:webStorageConsent', ($event.target as HTMLInputElement).checked)"
              />
              <span>
                웹 브라우저 환경에서는 OS 키체인을 사용할 수 없어 로컬 저장소(IndexedDB)에 보관됩니다. 개인 기기에서만 사용함을 확인하고 동의합니다.
              </span>
            </label>
          </div>

          <div
            v-if="errorMessage"
            class="flex items-start gap-2 p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-xs"
          >
            <AlertCircle class="w-4 h-4 shrink-0 mt-0.5" />
            <span>{{ errorMessage }}</span>
          </div>

          <div
            v-if="pendingConsent"
            class="flex flex-col gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-300 text-xs"
          >
            <span>
              {{
                pendingConsent.kind === 'private'
                  ? `사설 네트워크 NAS(${pendingConsent.origin}) 연결을 신뢰하고 허용하시겠습니까?`
                  : `자체 서명 TLS 인증서(${pendingConsent.origin}) 예외를 허용하시겠습니까?`
              }}
            </span>
            <div class="flex justify-end">
              <button
                type="button"
                class="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold"
                @click="emit('approve-consent')"
              >
                신뢰하고 다시 연결
              </button>
            </div>
          </div>

          <div
            v-if="successMessage"
            class="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs"
          >
            <CheckCircle2 class="w-4 h-4 shrink-0" />
            <span>{{ successMessage }}</span>
          </div>

          <div class="flex flex-wrap items-center justify-end gap-2 pt-2.5 border-t" :style="{ borderColor: 'var(--ev-border)' }">
            <button
              type="submit"
              :disabled="isConnecting || !url.trim()"
              class="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <Loader2 v-if="isConnecting" class="w-3.5 h-3.5 animate-spin" />
              <Server v-else class="w-3.5 h-3.5" />
              <span>WebDAV 연결하기</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <div class="lg:col-span-7">
      <div
        class="rounded-2xl border p-3.5 sm:p-4 shadow-xs h-full flex flex-col"
        :style="{ backgroundColor: 'var(--ev-surface)', borderColor: 'var(--ev-border)' }"
      >
        <div class="flex items-center justify-between mb-2.5">
          <div class="flex items-center gap-2">
            <Clock class="w-4 h-4 text-indigo-500" />
            <h2 class="text-sm font-bold">최근 WebDAV 접속내역 ({{ history.length }})</h2>
          </div>
        </div>

        <div
          v-if="history.length === 0"
          class="flex-1 min-h-40 rounded-xl border border-dashed flex flex-col items-center justify-center p-4 text-center text-xs opacity-60"
          :style="{ borderColor: 'var(--ev-border)' }"
        >
          <Server class="w-7 h-7 mb-1.5 opacity-40" />
          <p>저장된 최근 WebDAV 접속내역이 없습니다.</p>
          <p class="mt-0.5">서버 정보를 입력해 연결하면 이곳에 자동으로 목록이 관리됩니다.</p>
        </div>

        <div v-else class="space-y-2 overflow-y-auto max-h-[75vh] pr-1">
          <div
            v-for="conn in history"
            :key="conn.id"
            class="group rounded-xl border p-2.5 sm:p-3 flex items-center justify-between gap-2.5 hover:border-indigo-500/60 transition-all cursor-pointer"
            :style="{ borderColor: 'var(--ev-border)' }"
            @click="emit('select-history', conn, false)"
          >
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2 mb-0.5">
                <span class="text-xs font-bold break-all font-mono">{{ conn.url }}</span>
                <span
                  v-if="conn.username"
                  class="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-500 shrink-0"
                >
                  {{ conn.username }}
                </span>
              </div>
              <p class="text-[10px] opacity-55">
                경로: {{ conn.initialPath || '/' }} · {{ formatDate(conn.lastConnectedAt) }}
              </p>
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <button
                type="button"
                :disabled="isConnecting"
                class="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold transition-colors"
                @click.stop="emit('select-history', conn, true)"
              >
                접속
              </button>
              <button
                type="button"
                class="p-1.5 rounded-lg opacity-60 hover:opacity-100 hover:bg-red-500/10 hover:text-red-500 transition-colors"
                title="최근 접속내역에서 삭제"
                aria-label="최근 접속내역에서 삭제"
                @click.stop="emit('delete-history', conn.id)"
              >
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
