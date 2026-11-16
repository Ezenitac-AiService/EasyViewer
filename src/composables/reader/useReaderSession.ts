import { onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'

export interface ReaderSessionOptions {
  bookId: Ref<string>
  ensureContentHash?: (bookId: string) => Promise<void>
  loadBook: (bookId: string, signal: AbortSignal) => Promise<void>
  flushLocation: () => Promise<void>
}

/**
 * Coordinates reader book lifecycle across route changes, aborting stale loads
 * and flushing pending reading locations on exit or visibility loss.
 */
export function useReaderSession(options: ReaderSessionOptions) {
  const isLoading = ref(false)
  const loadError = ref('')
  let activeController: AbortController | null = null
  let sessionSeq = 0

  async function startSession(targetBookId: string): Promise<void> {
    const seq = ++sessionSeq
    if (activeController) {
      activeController.abort()
      await options.flushLocation().catch(() => {})
    }

    const controller = new AbortController()
    activeController = controller
    isLoading.value = true
    loadError.value = ''

    try {
      if (options.ensureContentHash) {
        await options.ensureContentHash(targetBookId)
      }
      if (controller.signal.aborted || seq !== sessionSeq) return
      await options.loadBook(targetBookId, controller.signal)
    } catch (err) {
      if (controller.signal.aborted || seq !== sessionSeq) return
      loadError.value = err instanceof Error ? err.message : String(err)
    } finally {
      if (seq === sessionSeq && !controller.signal.aborted) {
        isLoading.value = false
      }
    }
  }

  function handlePageExit(): void {
    void options.flushLocation().catch(() => {})
  }

  function handleVisibilityChange(): void {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      void options.flushLocation().catch(() => {})
    }
  }

  watch(
    () => options.bookId.value,
    (nextId) => {
      if (!nextId) return
      void startSession(nextId)
    },
    { immediate: true }
  )

  onMounted(() => {
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', handlePageExit)
      window.addEventListener('pagehide', handlePageExit)
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange)
    }
  })

  onBeforeUnmount(() => {
    if (activeController) {
      activeController.abort()
      activeController = null
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', handlePageExit)
      window.removeEventListener('pagehide', handlePageExit)
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
    void options.flushLocation().catch(() => {})
  })

  return {
    isLoading,
    loadError,
    reload: () => startSession(options.bookId.value)
  }
}
