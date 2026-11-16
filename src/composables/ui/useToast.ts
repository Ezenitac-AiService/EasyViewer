import { onBeforeUnmount, ref } from 'vue'

/**
 * Shared toast notification state with automatic unmount timer cleanup.
 */
export function useToast(defaultDurationMs = 2800) {
  const toastMessage = ref('')
  let timer: ReturnType<typeof setTimeout> | null = null

  function clearToast(): void {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    toastMessage.value = ''
  }

  function showToast(message: string, durationMs = defaultDurationMs): void {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    toastMessage.value = message
    if (durationMs > 0) {
      timer = setTimeout(() => {
        toastMessage.value = ''
        timer = null
      }, durationMs)
    }
  }

  onBeforeUnmount(() => {
    clearToast()
  })

  return {
    toastMessage,
    showToast,
    clearToast
  }
}
