import { onBeforeUnmount, ref, watch, type Ref } from 'vue'
import type { BookMeta } from '@/types'

/**
 * Loads book cover Blobs into object URLs and revokes stale/removed URLs on unmount.
 */
export function useBookCoverUrls(
  books: Ref<BookMeta[]>,
  loadCoverBlob: (bookId: string) => Promise<Blob | null>
) {
  const coverUrlMap = ref<Record<string, string>>({})

  function revokeBookUrl(bookId: string): void {
    const existing = coverUrlMap.value[bookId]
    if (!existing) return
    if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(existing)
    }
    const next = { ...coverUrlMap.value }
    delete next[bookId]
    coverUrlMap.value = next
  }

  function revokeAll(): void {
    for (const id of Object.keys(coverUrlMap.value)) {
      revokeBookUrl(id)
    }
  }

  watch(
    () => books.value.map((b) => `${b.id}:${b.hasCover ? 1 : 0}`).join('|'),
    async () => {
      const activeIds = new Set(books.value.map((b) => b.id))
      for (const id of Object.keys(coverUrlMap.value)) {
        if (!activeIds.has(id)) revokeBookUrl(id)
      }
      for (const book of books.value) {
        if (!book.hasCover || coverUrlMap.value[book.id]) continue
        try {
          const blob = await loadCoverBlob(book.id)
          if (blob && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
            coverUrlMap.value = {
              ...coverUrlMap.value,
              [book.id]: URL.createObjectURL(blob)
            }
          }
        } catch {
          // Optional cover loading
        }
      }
    },
    { immediate: true }
  )

  onBeforeUnmount(() => {
    revokeAll()
  })

  return {
    coverUrlMap,
    revokeBookUrl,
    revokeAll
  }
}
