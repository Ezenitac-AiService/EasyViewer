<!-- SPDX-License-Identifier: GPL-3.0-only -->
<script setup lang="ts">
/**
 * One-time notice after the desktop migration (spec 003 US6, contracts/data-migration.md §2).
 * Also rebuilds the library from copied book files when the WebView store was not readable and
 * runs the legacy credential migration (with the macOS keychain warning first).
 */
import { computed, onMounted, ref, watch } from 'vue'
import type { WebDavConnection } from '@/types'
import { useAccessibleDialog } from '@/composables/ui/useAccessibleDialog'
import { loadWebDavHistory } from '@/services/network/webdavService'
import {
  createDesktopBookFileSource,
  reconstructLibrary
} from '@/services/platform/libraryReconstruction'
import {
  describeMigrationNotice,
  platformMigration,
  type MigrationErrorKind,
  type MigrationNoticeKind,
  type MigrationRecord
} from '@/services/platform/migrationService'
import { useBookStore } from '@/stores/useBookStore'

const bookStore = useBookStore()
const record = ref<MigrationRecord | null>(null)
const kind = ref<MigrationNoticeKind | null>(null)
const reconstructedCount = ref(0)
const reconstructFailedCount = ref(0)
const pendingCredentialCount = ref(0)
const failedCredentialCount = ref(0)
const connections = ref<WebDavConnection[]>([])
const confirmingDiscard = ref(false)
const working = ref(false)
const visible = ref(false)
let acknowledged = false

const dialogRef = ref<HTMLElement | null>(null)
const closeBtnRef = ref<HTMLButtonElement | null>(null)
const titleId = `ev-migration-title-${Math.random().toString(36).slice(2, 8)}`

useAccessibleDialog({ isOpen: visible, containerRef: dialogRef, initialFocusRef: closeBtnRef, onClose: close })

const ERROR_TEXT: Record<MigrationErrorKind, string> = {
  busy: '옮기는 동안 다른 EasyViewer가 데이터를 쓰고 있었습니다.',
  space: '저장 공간이 부족했습니다.',
  permission: '폴더에 접근할 권한이 없었습니다.',
  boundary: '안전하지 않은 위치라 옮기지 않았습니다.',
  io: '파일을 읽거나 쓰는 중 오류가 났습니다.'
}
const ORIGINAL_KEPT = '원본은 원래 위치에 그대로 있습니다.'
const MANUAL_RECOVERY = '필요하면 [책 추가]로 책 파일을 다시 가져오세요. 서재를 다시 만들 수 있습니다.'

const title = computed(() => {
  switch (kind.value) {
    case 'migrated':
      return '이전 버전 데이터를 옮겼습니다'
    case 'partial':
      return '이전 버전 데이터를 일부만 옮겼습니다'
    case 'failed':
      return '이전 버전 데이터를 옮기지 못했습니다'
    case 'declined':
      return '이전 버전 데이터를 옮기지 않았습니다'
    case 'kept-new':
      return '새 위치의 데이터를 우선했습니다'
    default:
      return 'Pagelight 데이터 안내'
  }
})

const lines = computed(() => {
  const out: string[] = []
  const rec = record.value
  switch (kind.value) {
    case 'migrated':
    case 'partial':
      out.push(`이전 버전이 쓰던 서재와 설정을 Pagelight로 복사했습니다. ${ORIGINAL_KEPT}`)
      out.push(
        '이전 위치는 원저작자의 EasyViewer와 함께 쓰던 곳이라, 원저작자 앱이 만든 데이터가 섞여 있을 수 있습니다. 원하지 않으면 [이전 결과 버리기]로 빈 상태에서 다시 시작할 수 있습니다.'
      )
      break
    case 'failed':
      out.push(`${rec?.error ? ERROR_TEXT[rec.error] : ''} ${ORIGINAL_KEPT}`.trim())
      out.push(MANUAL_RECOVERY)
      break
    case 'declined':
      out.push(`이번 실행에서는 데이터를 옮기지 않고 빈 상태로 시작했습니다. ${ORIGINAL_KEPT}`)
      out.push(MANUAL_RECOVERY)
      break
    case 'kept-new':
      out.push(`Pagelight에 이미 데이터가 있어 이전 버전 데이터와 합치지 않았습니다. ${ORIGINAL_KEPT}`)
      break
  }
  if (reconstructedCount.value > 0) {
    out.push(
      `서재를 책 파일 ${reconstructedCount.value}권으로 다시 만들었습니다. 읽기 진행률, 책갈피, 표시 설정은 옮기지 못했습니다.`
    )
  }
  if (reconstructFailedCount.value > 0) {
    out.push(
      `책 파일 ${reconstructFailedCount.value}개는 손상되었거나 읽을 수 없어 서재에 넣지 못했습니다. 원본 파일을 [책 추가]로 다시 가져오세요.`
    )
  }
  if (failedCredentialCount.value > 0) {
    out.push(
      `WebDAV 연결 ${failedCredentialCount.value}개의 비밀번호를 옮기지 못했습니다. 그 연결을 열 때 비밀번호를 다시 입력하세요.`
    )
  }
  return out
})

const canDiscard = computed(() => kind.value === 'migrated' || kind.value === 'partial')

async function whenLibraryReady(): Promise<void> {
  if (bookStore.isInitialized) return
  await new Promise<void>((resolve) => {
    const stop = watch(
      () => bookStore.isInitialized,
      (ready) => {
        if (ready) {
          stop()
          resolve()
        }
      }
    )
  })
}

async function runCredentialMigration() {
  working.value = true
  try {
    const out = await platformMigration.migrateCredentials(connections.value)
    failedCredentialCount.value = out.failed
  } catch {
    failedCredentialCount.value = pendingCredentialCount.value
  } finally {
    pendingCredentialCount.value = 0
    working.value = false
  }
}

async function migrateCredentialsNow() {
  await runCredentialMigration()
  refreshVisibility()
}

async function skipCredentials() {
  pendingCredentialCount.value = 0
  await platformMigration.skipCredentials().catch(() => undefined)
  refreshVisibility()
}

function refreshVisibility() {
  visible.value =
    kind.value !== null ||
    reconstructedCount.value > 0 ||
    reconstructFailedCount.value > 0 ||
    pendingCredentialCount.value > 0 ||
    failedCredentialCount.value > 0
}

async function confirmDiscard() {
  working.value = true
  try {
    // Records `discard_pending` and restarts; nothing is deleted during this run.
    await platformMigration.requestDiscardRestart()
  } finally {
    working.value = false
  }
}

function close() {
  visible.value = false
  confirmingDiscard.value = false
  if (kind.value !== null && !acknowledged) {
    acknowledged = true
    void platformMigration.acknowledge().catch(() => undefined)
  }
}

onMounted(async () => {
  const rec = await platformMigration.getRecord()
  record.value = rec
  if (!rec) return
  kind.value = describeMigrationNotice(rec)
  if (rec.state === 'migrated' || rec.state === 'partial') {
    await whenLibraryReady()
    if (!rec.reconstructed && rec.copied.dataDir) {
      try {
        const rebuilt = await reconstructLibrary(bookStore, createDesktopBookFileSource())
        reconstructedCount.value = rebuilt.added
        reconstructFailedCount.value = rebuilt.failed
      } catch {
        reconstructedCount.value = 0
      }
      await platformMigration.markReconstructed().catch(() => undefined)
    }
    if (!rec.credentials) {
      connections.value = await loadWebDavHistory().catch(() => [])
      const count = platformMigration.countMigratableCredentials(connections.value)
      if (count > 0) {
        pendingCredentialCount.value = count
        if (!platformMigration.needsKeychainPrompt()) await runCredentialMigration()
      }
    }
  }
  refreshVisibility()
})
</script>

<template>
  <div
    v-if="visible"
    data-testid="migration-backdrop"
    class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
    @click.self="close"
  >
    <div
      ref="dialogRef"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
      tabindex="-1"
      class="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border p-6 shadow-2xl outline-none"
      style="background-color: var(--ev-surface); color: var(--ev-text); border-color: var(--ev-border)"
    >
      <h2 :id="titleId" class="text-lg font-semibold mb-3">{{ title }}</h2>
      <p v-for="(line, i) in lines" :key="i" class="text-sm mb-2" style="color: var(--ev-text-muted)">
        {{ line }}
      </p>

      <section
        v-if="pendingCredentialCount > 0"
        class="mt-4 rounded-xl border p-4 text-sm"
        style="border-color: var(--ev-border)"
        aria-label="WebDAV 비밀번호 옮기기"
      >
        <p class="mb-3">
          WebDAV 연결 {{ pendingCredentialCount }}개의 비밀번호를 옮기려면 macOS가 최대
          {{ pendingCredentialCount }}번 로그인 암호를 물을 수 있습니다.
        </p>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            data-testid="credentials-migrate"
            class="min-h-11 px-4 rounded-lg font-medium cursor-pointer text-white"
            style="background-color: var(--ev-accent)"
            :disabled="working"
            @click="migrateCredentialsNow"
          >
            옮기기
          </button>
          <button
            type="button"
            data-testid="credentials-skip"
            class="min-h-11 px-4 rounded-lg border cursor-pointer"
            style="border-color: var(--ev-border)"
            :disabled="working"
            @click="skipCredentials"
          >
            건너뛰고 나중에 재입력
          </button>
        </div>
      </section>

      <section v-if="confirmingDiscard" class="mt-4 rounded-xl border p-4 text-sm" style="border-color: var(--ev-border)">
        <p class="mb-3">
          옮겨 온 서재와 설정을 지우고 빈 상태에서 다시 시작합니다. 앱이 다시 시작됩니다. 이전 버전의 원본
          데이터는 지우지 않습니다.
        </p>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            data-testid="migration-discard-confirm"
            class="min-h-11 px-4 rounded-lg font-medium cursor-pointer text-white bg-red-600"
            :disabled="working"
            @click="confirmDiscard"
          >
            버리고 다시 시작
          </button>
          <button
            type="button"
            class="min-h-11 px-4 rounded-lg border cursor-pointer"
            style="border-color: var(--ev-border)"
            @click="confirmingDiscard = false"
          >
            취소
          </button>
        </div>
      </section>

      <div class="mt-5 flex flex-wrap justify-end gap-2">
        <button
          v-if="canDiscard && !confirmingDiscard"
          type="button"
          data-testid="migration-discard"
          class="min-h-11 px-4 rounded-lg border cursor-pointer"
          style="border-color: var(--ev-border)"
          @click="confirmingDiscard = true"
        >
          이전 결과 버리기
        </button>
        <button
          ref="closeBtnRef"
          type="button"
          data-testid="migration-close"
          class="min-h-11 px-4 rounded-lg font-medium cursor-pointer text-white"
          style="background-color: var(--ev-accent)"
          @click="close"
        >
          확인
        </button>
      </div>
    </div>
  </div>
</template>
