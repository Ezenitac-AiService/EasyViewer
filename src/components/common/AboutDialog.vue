<!-- SPDX-License-Identifier: GPL-3.0-only -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAccessibleDialog } from '@/composables/ui/useAccessibleDialog'
import { FORK_REPO_URL, UPSTREAM_REPO_URL, renderSupportScopeKo } from '@/config/supportScope'
import about from '@/generated/about.json'
import { openExternalLink } from '@/services/platform/externalLink'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const dialogRef = ref<HTMLElement | null>(null)
const closeBtnRef = ref<HTMLButtonElement | null>(null)
const isOpen = computed(() => props.open)
const titleId = `ev-about-title-${Math.random().toString(36).slice(2, 8)}`

useAccessibleDialog({
  isOpen,
  containerRef: dialogRef,
  initialFocusRef: closeBtnRef,
  onClose: () => emit('close')
})

/** Plain-text rendering of the canonical support-scope Markdown (bold and links removed). */
const supportScopeLines = computed(() =>
  renderSupportScopeKo()
    .split('\n')
    .map((line) => line.replace(/\*\*/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'))
)

const licenseUrl = `${FORK_REPO_URL}/blob/main/LICENSE`
const notices = ref<string | null>(null)
const noticesError = ref('')
const licenseText = ref<string | null>(null)

async function showNotices() {
  noticesError.value = ''
  try {
    const mod = await import('@/generated/third-party-notices.txt?raw')
    notices.value = mod.default
  } catch {
    noticesError.value = '고지 전문을 불러오지 못했습니다.'
  }
}

async function showLicense() {
  try {
    const mod = await import('../../../LICENSE?raw')
    licenseText.value = mod.default
  } catch {
    licenseText.value = null
  }
}

function openLink(url: string) {
  void openExternalLink(url)
}
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
    @click.self="emit('close')"
  >
    <div
      ref="dialogRef"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
      tabindex="-1"
      class="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border p-6 shadow-2xl outline-none"
      style="background-color: var(--ev-surface); color: var(--ev-text); border-color: var(--ev-border)"
    >
      <h2 :id="titleId" class="text-lg font-semibold mb-4">앱 정보</h2>

      <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm mb-5">
        <dt style="color: var(--ev-text-muted)">이름</dt>
        <dd>{{ about.name }}</dd>
        <dt style="color: var(--ev-text-muted)">버전</dt>
        <dd>{{ about.version }}</dd>
        <dt style="color: var(--ev-text-muted)">라이선스</dt>
        <dd>
          {{ about.license }}
          <button
            type="button"
            class="ml-2 underline cursor-pointer"
            style="color: var(--ev-accent)"
            @click="showLicense"
          >
            전문 보기
          </button>
        </dd>
        <dt style="color: var(--ev-text-muted)">저장소</dt>
        <dd>
          <button
            type="button"
            class="underline cursor-pointer break-all text-left"
            style="color: var(--ev-accent)"
            :data-external-link="FORK_REPO_URL"
            @click="openLink(FORK_REPO_URL)"
          >
            {{ FORK_REPO_URL }}
          </button>
        </dd>
        <dt style="color: var(--ev-text-muted)">출처</dt>
        <dd>
          edith2580의 EasyViewer v0.1.6에서 파생한 독립 포크입니다.
          <button
            type="button"
            class="underline cursor-pointer break-all text-left"
            style="color: var(--ev-accent)"
            :data-external-link="UPSTREAM_REPO_URL"
            @click="openLink(UPSTREAM_REPO_URL)"
          >
            {{ UPSTREAM_REPO_URL }}
          </button>
        </dd>
        <dt style="color: var(--ev-text-muted)">변경 일자</dt>
        <dd>{{ about.separatedAt }} 독립 분리 (변경 내역은 NOTICE·CHANGELOG 참고)</dd>
      </dl>

      <section class="mb-5">
        <h3 class="text-sm font-semibold mb-2">지원 범위</h3>
        <p v-for="(line, i) in supportScopeLines" :key="i" class="text-sm" style="color: var(--ev-text-muted)">
          {{ line }}
        </p>
      </section>

      <section class="mb-5">
        <h3 class="text-sm font-semibold mb-2">주요 서드파티 구성요소</h3>
        <ul class="text-sm grid grid-cols-1 sm:grid-cols-2 gap-x-4" style="color: var(--ev-text-muted)">
          <li v-for="dep in about.thirdParty" :key="dep.name">{{ dep.name }} {{ dep.version }} — {{ dep.license }}</li>
        </ul>
        <button
          type="button"
          data-testid="show-notices"
          class="mt-3 px-3 py-1.5 rounded-lg text-sm border cursor-pointer"
          style="border-color: var(--ev-border); color: var(--ev-text)"
          @click="showNotices"
        >
          전체 고지와 라이선스 전문 보기
        </button>
        <p v-if="noticesError" class="text-sm mt-2 text-red-600">{{ noticesError }}</p>
        <pre
          v-if="notices"
          data-testid="third-party-notices"
          class="mt-3 max-h-64 overflow-auto text-xs whitespace-pre-wrap rounded-lg border p-3"
          style="border-color: var(--ev-border)"
        >{{ notices }}</pre>
        <pre
          v-if="licenseText"
          class="mt-3 max-h-64 overflow-auto text-xs whitespace-pre-wrap rounded-lg border p-3"
          style="border-color: var(--ev-border)"
        >{{ licenseText }}</pre>
      </section>

      <p class="text-xs mb-4" style="color: var(--ev-text-muted)">
        이 화면은 이 포크의 투명성 정책에 따라 제공합니다. 라이선스 원문:
        <button
          type="button"
          class="underline cursor-pointer"
          style="color: var(--ev-accent)"
          :data-external-link="licenseUrl"
          @click="openLink(licenseUrl)"
        >
          LICENSE
        </button>
      </p>

      <div class="flex justify-end">
        <button
          ref="closeBtnRef"
          type="button"
          class="px-4 py-2 rounded-lg text-sm font-medium text-white cursor-pointer"
          style="background-color: var(--ev-accent)"
          @click="emit('close')"
        >
          닫기
        </button>
      </div>
    </div>
  </div>
</template>
