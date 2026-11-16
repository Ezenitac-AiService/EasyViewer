import type { BookMeta, ReadingLocation } from '@/types'
import { isTauriEnv, platformStorage } from '@/services/storage/platformAdapter'
import { computeBufferSha256, dataUriToBlob } from '@/services/storage/bookHasher'

/**
 * Migrates legacy Base64 data: coverUrl values from BookMeta JSON into book_covers Blob store.
 */
export async function migrateLegacyCoversV1toV2(books: BookMeta[]): Promise<boolean> {
  let migrated = false
  for (const book of books) {
    if (typeof book.coverUrl === 'string' && book.coverUrl.startsWith('data:')) {
      const blob = dataUriToBlob(book.coverUrl)
      if (blob) {
        await platformStorage.saveCoverBlob(book.id, blob)
        book.hasCover = true
      }
      delete book.coverUrl
      migrated = true
    } else if ('coverUrl' in book && book.coverUrl !== undefined) {
      delete book.coverUrl
      migrated = true
    }
  }
  return migrated
}

/**
 * Matches incoming SHA-256 fingerprint against existing books, computing hashes on-demand
 * only for legacy entries without contentHash whose fileSize matches.
 */
export async function findMatchingBookByHashOrSize(
  books: BookMeta[],
  incomingHash: string,
  incomingSize: number
): Promise<BookMeta | undefined> {
  const direct = books.find((b) => b.contentHash === incomingHash)
  if (direct) return direct

  for (const candidate of books) {
    if (candidate.contentHash || candidate.fileSize !== incomingSize) continue
    let candidateHash: string | undefined
    if (candidate.storedPath && isTauriEnv()) {
      try {
        candidateHash = await platformStorage.hashValidatedBookFile(candidate.storedPath)
      } catch {
        candidateHash = undefined
      }
    }
    if (!candidateHash) {
      const binary = await platformStorage.loadBookBinary(candidate.id, candidate.storedPath)
      if (binary) {
        candidateHash = await computeBufferSha256(binary)
      }
    }
    if (candidateHash) {
      candidate.contentHash = candidateHash
      if (candidateHash === incomingHash) {
        return candidate
      }
    }
  }

  return undefined
}

export function resolveSyncBookId(
  books: BookMeta[],
  remoteBookId: string
): string {
  if (books.some((b) => b.id === remoteBookId)) return remoteBookId
  if (remoteBookId.startsWith('sha256-')) {
    const byHash = books.find((b) => b.contentHash === remoteBookId)
    if (byHash) return byHash.id
  }
  return remoteBookId
}

export function mergeSyncLocationsWithFallback(
  books: BookMeta[],
  localPositions: Record<string, ReadingLocation>,
  remotePositions: Record<string, ReadingLocation>
): number {
  let updatedCount = 0
  for (const [remoteId, remoteLoc] of Object.entries(remotePositions)) {
    const targetId = resolveSyncBookId(books, remoteId)
    const localLoc = localPositions[targetId]
    if (!localLoc || remoteLoc.updatedAt >= localLoc.updatedAt) {
      localPositions[targetId] = { ...remoteLoc, bookId: targetId }
      updatedCount++
    }
  }
  return updatedCount
}
