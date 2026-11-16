<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAccessibleDialog } from '@/composables/ui/useAccessibleDialog'

const props = withDefaults(
  defineProps<{
    open: boolean
    title: string
    message: string
    kind?: 'info' | 'warning'
    confirmLabel?: string
    cancelLabel?: string
    secondaryLabel?: string
  }>(),
  {
    kind: 'info',
    confirmLabel: '확인',
    cancelLabel: '취소',
    secondaryLabel: ''
  }
)

const emit = defineEmits<{
  (e: 'confirm'): void
  (e: 'secondary'): void
  (e: 'cancel'): void
}>()

const dialogRef = ref<HTMLElement | null>(null)
const cancelBtnRef = ref<HTMLButtonElement | null>(null)
const isOpen = computed(() => props.open)
const titleId = `ev-confirm-title-${Math.random().toString(36).slice(2, 8)}`

useAccessibleDialog({
  isOpen,
  containerRef: dialogRef,
  initialFocusRef: cancelBtnRef,
  onClose: () => emit('cancel')
})
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
    @click.self="emit('cancel')"
  >
    <div
      ref="dialogRef"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
      tabindex="-1"
      class="w-full max-w-md rounded-2xl border p-6 shadow-2xl outline-none transition-colors"
      style="
        background-color: var(--ev-surface);
        color: var(--ev-text);
        border-color: var(--ev-border);
      "
    >
      <h2 :id="titleId" class="text-lg font-semibold mb-2">
        {{ title }}
      </h2>
      <p class="text-sm whitespace-pre-line mb-6" style="color: var(--ev-text-muted)">
        {{ message }}
      </p>

      <div class="flex flex-wrap items-center justify-end gap-2">
        <button
          ref="cancelBtnRef"
          type="button"
          class="px-4 py-2 rounded-lg text-sm font-medium border transition-colors hover:opacity-80 cursor-pointer"
          style="border-color: var(--ev-border); color: var(--ev-text)"
          @click="emit('cancel')"
        >
          {{ cancelLabel }}
        </button>
        <button
          v-if="secondaryLabel"
          type="button"
          class="px-4 py-2 rounded-lg text-sm font-medium border transition-colors hover:opacity-80 cursor-pointer"
          style="border-color: var(--ev-accent); color: var(--ev-accent)"
          @click="emit('secondary')"
        >
          {{ secondaryLabel }}
        </button>
        <button
          type="button"
          class="px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors hover:opacity-90 cursor-pointer"
          :class="kind === 'warning' ? 'bg-red-600' : ''"
          :style="kind === 'warning' ? undefined : { backgroundColor: 'var(--ev-accent)' }"
          @click="emit('confirm')"
        >
          {{ confirmLabel }}
        </button>
      </div>
    </div>
  </div>
</template>
