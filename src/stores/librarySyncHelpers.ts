import type { BookmarkItem, BookMeta, ReadingLocation, SyncPayload, ViewerSettings } from '@/types'
import { isDesktopApp, platformPath, platformStorage } from '@/services/platform'
import { synchronizeReadingData } from '@/services/sync/syncService'
import { mergeSyncLocationsWithFallback, resolveSyncBookId } from './libraryMigration'

function legacyFileName(book: BookMeta): string {
  const hasAuthor = book.format === 'txt' && book.author && book.author !== 'TXT 문서'
  const base = hasAuthor ? `${book.title} - ${book.author}` : book.title
  return `${base}.${book.format}`
}

export async function prepareLibraryBookFiles(books: BookMeta[]): Promise<boolean> {
  if (!(await isDesktopApp())) return false
  const dirs: string[] = [await platformStorage.getStorageDir()]
  for (const book of books) {
    if (book.storedPath) {
      try {
        const parent = await platformPath.dirname(book.storedPath)
        if (parent) dirs.push(parent)
      } catch { /* Ignore */ }
    }
  }
  await platformStorage.allowStorageDirs(dirs)
  let migrated = false
  for (const book of books) {
    if (book.storedPath) continue
    const fileName = book.fileName || legacyFileName(book)
    const newPath = await platformStorage.migrateLegacyBookFile(book.id, fileName)
    if (newPath) {
      book.storedPath = newPath
      book.fileName = fileName
      migrated = true
    }
  }
  return migrated
}

export async function runBookSync(
  books: BookMeta[],
  positions: Record<string, ReadingLocation>,
  bookmarks: Record<string, BookmarkItem[]>,
  settings: ViewerSettings
): Promise<{
  positions: Record<string, ReadingLocation>
  bookmarks: Record<string, BookmarkItem[]>
  updatedCount: number
  message: string
}> {
  const result = await synchronizeReadingData(settings.syncEndpoint, positions, bookmarks, settings)
  for (const book of books) {
    if (result.payload.positions[book.id]) {
      book.lastLocation = result.payload.positions[book.id]
    }
  }
  const message =
    result.mode === 'remote'
      ? `원격 서버 동기화 완료 (${result.updatedCount}건 갱신)`
      : `로컬 허브 동기화 완료 (${result.updatedCount}건 갱신)`
  return {
    positions: result.payload.positions,
    bookmarks: result.payload.bookmarks,
    updatedCount: result.updatedCount,
    message
  }
}

export function serializeSyncSnapshot(
  deviceId: string,
  positions: Record<string, ReadingLocation>,
  bookmarks: Record<string, BookmarkItem[]>,
  settings: ViewerSettings
): string {
  const payload: SyncPayload = {
    version: 1,
    exportedAt: Date.now(),
    deviceId,
    positions,
    bookmarks,
    settings
  }
  return JSON.stringify(payload, null, 2)
}

export function applySyncSnapshotJson(
  jsonText: string,
  books: BookMeta[],
  positions: Record<string, ReadingLocation>,
  bookmarks: Record<string, BookmarkItem[]>
): number {
  const parsed = JSON.parse(jsonText) as SyncPayload
  if (!parsed || typeof parsed !== 'object' || !parsed.positions) {
    throw new Error('유효하지 않은 동기화 데이터 형식입니다.')
  }
  const updatedCount = mergeSyncLocationsWithFallback(books, positions, parsed.positions)
  if (parsed.bookmarks) {
    for (const [remoteId, remoteList] of Object.entries(parsed.bookmarks)) {
      const targetId = resolveSyncBookId(books, remoteId)
      const current = bookmarks[targetId] || []
      const map = new Map(current.map((b) => [b.locator, b]))
      for (const item of remoteList) map.set(item.locator, item)
      bookmarks[targetId] = Array.from(map.values())
    }
  }
  for (const book of books) {
    if (positions[book.id]) book.lastLocation = positions[book.id]
  }
  return updatedCount
}
