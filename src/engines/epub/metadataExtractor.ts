import ePub from 'epubjs'
import type { ExtractedEpubMetadata } from '@/engines/types'
import { validateEpubArchiveBounds } from './sanitizer'

/**
 * Dynamically imported EPUB metadata & Blob cover extractor (excluded from initial app bundle).
 */
export async function extractEpubMetadata(buffer: ArrayBuffer): Promise<ExtractedEpubMetadata> {
  await validateEpubArchiveBounds(buffer)
  const book = ePub(buffer)
  try {
    await book.ready
    const metadata = await book.loaded.metadata
    let coverBlob: Blob | null = null
    try {
      const blobUrl = await book.coverUrl()
      if (blobUrl && blobUrl.startsWith('blob:')) {
        const res = await fetch(blobUrl)
        coverBlob = await res.blob()
        URL.revokeObjectURL(blobUrl)
      }
    } catch {
      coverBlob = null
    }
    return {
      title: metadata?.title?.trim() || undefined,
      author: metadata?.creator?.trim() || undefined,
      coverBlob,
      coverMime: coverBlob?.type || undefined
    }
  } finally {
    book.destroy()
  }
}
