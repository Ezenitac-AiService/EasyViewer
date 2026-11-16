<script setup lang="ts">
import { RouterView } from 'vue-router'
import InAppConfirmModal from '@/components/common/InAppConfirmModal.vue'
import { resolveWebConfirmDialog, webConfirmDialogState } from '@/services/platform/dialogService'
</script>

<template>
  <div
    class="pointer-events-none fixed top-0 left-0 right-0 z-50"
    :style="{
      height: 'env(safe-area-inset-top, 0px)',
      backgroundColor: 'var(--ev-surface)'
    }"
  />
  <RouterView />
  <InAppConfirmModal
    v-if="webConfirmDialogState"
    :open="webConfirmDialogState.open"
    :title="webConfirmDialogState.title"
    :message="webConfirmDialogState.message"
    :kind="webConfirmDialogState.kind"
    :confirm-label="webConfirmDialogState.confirmLabel"
    :cancel-label="webConfirmDialogState.cancelLabel"
    @confirm="resolveWebConfirmDialog(true)"
    @cancel="resolveWebConfirmDialog(false)"
  />
</template>

