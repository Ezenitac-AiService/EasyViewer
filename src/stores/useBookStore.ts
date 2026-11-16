import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { BookFormat, BookMeta, BookmarkItem, LocationIndexCacheRecord, ReadingLocation } from '@/types'
import { isDesktopApp, isTauriEnv, platformStorage } from '@/services/platform'
import { createSampleEpubBook, createSampleTxtBook } from '@/services/sampleBooks'
import {
  downloadBookStreamNative,
  downloadRemoteBook,
  type DownloadProgress
} from '@/services/network/downloadService'
import { computeBufferSha256 } from '@/services/storage/bookHasher'
import { getOrCreateDeviceId } from '@/services/sync/syncService'
import { findMatchingBookByHashOrSize, migrateLegacyCoversV1toV2 } from './libraryMigration'
import {
  applySyncSnapshotJson,
  prepareLibraryBookFiles,
  runBookSync,
  serializeSyncSnapshot
} from './librarySyncHelpers'
import { useSettingsStore } from './useSettingsStore'

const BOOKS_META_KEY = 'library_books_v1'
const POSITIONS_KEY = 'reading_positions_v1'
const BOOKMARKS_KEY = 'bookmarks_v1'
const SAMPLES_SEEDED_KEY = 'samples_seeded_v1'
const DELETE_FILE_ON_REMOVE_KEY = 'delete_file_on_remove_v1'

export const useBookStore = defineStore('books', () => {
  const books = ref<BookMeta[]>([])
  const positions = ref<Record<string, ReadingLocation>>({})
  const bookmarks = ref<Record<string, BookmarkItem[]>>({})
  const isInitialized = ref(false)
  const isSyncing = ref(false)
  const lastSyncTime = ref<number | null>(null)
  const syncStatusMessage = ref<string>('')
  const deleteFileOnRemove = ref(false)

  const sortedBooks = computed(() =>
    [...books.value].sort((a, b) => (b.lastOpenedAt || b.addedAt) - (a.lastOpenedAt || a.addedAt))
  )

  async function initLibrary() {
    if (isInitialized.value) return
    books.value = await platformStorage.getItem<BookMeta[]>(BOOKS_META_KEY, [])
    positions.value = await platformStorage.getItem<Record<string, ReadingLocation>>(POSITIONS_KEY, {})
    deleteFileOnRemove.value = await platformStorage.getItem<boolean>(DELETE_FILE_ON_REMOVE_KEY, false)
    bookmarks.value = await platformStorage.getItem<Record<string, BookmarkItem[]>>(BOOKMARKS_KEY, {})

    const coversMigrated = await migrateLegacyCoversV1toV2(books.value)
    if (coversMigrated) {
      await platformStorage.setItem(BOOKS_META_KEY, books.value)
    }

    await prepareBookFiles()

    const seeded = await platformStorage.getItem<boolean>(SAMPLES_SEEDED_KEY, false)
    if (!seeded && books.value.length === 0) {
      await seedSampleBooks()
      await platformStorage.setItem(SAMPLES_SEEDED_KEY, true)
    }

    for (const book of books.value) {
      if (positions.value[book.id]) {
        book.lastLocation = positions.value[book.id]
      }
    }
    isInitialized.value = true
  }

  async function persistAll() {
    await platformStorage.setItem(BOOKS_META_KEY, books.value)
    await platformStorage.setItem(POSITIONS_KEY, positions.value)
    await platformStorage.setItem(BOOKMARKS_KEY, bookmarks.value)
  }

  async function prepareBookFiles() {
    if (await prepareLibraryBookFiles(books.value)) {
      await platformStorage.setItem(BOOKS_META_KEY, books.value)
    }
  }

  async function seedSampleBooks() {
    await addBookFromBuffer(await createSampleEpubBook(), 'EasyViewer 완벽 가이드 및 샘플 북.epub', 'epub')
    await addBookFromBuffer(createSampleTxtBook(), '윤동주 시선 - 별 헤는 밤.txt', 'txt')
  }

  async function upsertBookRecord(params: {
    contentHash: string
    fileSize: number
    fileName: string
    format: BookFormat
    title: string
    author: string
    storedPath?: string
    sourceUrl?: string
    coverBlob?: Blob | null
  }): Promise<BookMeta> {
    const existing = await findMatchingBookByHashOrSize(
      books.value,
      params.contentHash,
      params.fileSize
    )
    const id = existing?.id || params.contentHash
    let hasCover = existing?.hasCover
    if (params.coverBlob && params.coverBlob.size > 0) {
      await platformStorage.saveCoverBlob(id, params.coverBlob)
      hasCover = true
    }

    const now = Date.now()
    const existingIdx = books.value.findIndex((b) => b.id === id)
    const meta: BookMeta = {
      id,
      contentHash: params.contentHash,
      hasCover,
      title: params.title,
      author: params.author,
      format: params.format,
      fileSize: params.fileSize,
      sourceUrl: params.sourceUrl,
      isOfflineCached: true,
      fileName: params.fileName,
      storedPath: params.storedPath,
      addedAt: existingIdx >= 0 ? books.value[existingIdx].addedAt : now,
      lastOpenedAt: now,
      lastLocation: positions.value[id]
    }
    if (existingIdx >= 0) {
      books.value[existingIdx] = meta
    } else {
      books.value.unshift(meta)
    }
    await persistAll()
    return meta
  }

  async function addBookFromBuffer(
    buffer: ArrayBuffer,
    filename: string,
    explicitFormat?: BookFormat,
    sourceUrl?: string,
    sourcePath?: string
  ): Promise<BookMeta> {
    const lower = filename.toLowerCase()
    const format: BookFormat = explicitFormat || (lower.endsWith('.epub') ? 'epub' : 'txt')
    const fileName = /\.(epub|txt)$/i.test(filename) ? filename : `${filename}.${format}`

    const contentHash = await computeBufferSha256(buffer)
    const previous = await findMatchingBookByHashOrSize(books.value, contentHash, buffer.byteLength)
    const targetId = previous?.id || contentHash
    const storedPath = await platformStorage.saveBookFile(
      targetId,
      fileName,
      buffer,
      previous?.storedPath,
      sourcePath
    )

    let title = filename.replace(/\.(epub|txt)$/i, '')
    let author = format === 'epub' ? 'EPUB 문서' : 'TXT 문서'
    let coverBlob: Blob | null = null

    if (format === 'epub') {
      const { extractEpubMetadata } = await import('@/engines/epub/metadataExtractor')
      const epubMeta = await extractEpubMetadata(buffer)
      if (epubMeta.title && epubMeta.title !== '제목 없는 EPUB') title = epubMeta.title
      if (epubMeta.author) author = epubMeta.author
      coverBlob = epubMeta.coverBlob ?? null
    } else if (title.includes(' - ')) {
      const parts = title.split(' - ')
      title = parts[0].trim()
      author = parts.slice(1).join(' - ').trim()
    }

    return upsertBookRecord({
      contentHash,
      fileSize: buffer.byteLength,
      fileName,
      format,
      title,
      author,
      storedPath,
      sourceUrl,
      coverBlob
    })
  }

  async function addBookFromNativePath(sourcePath: string, filename: string): Promise<BookMeta> {
    const lower = filename.toLowerCase()
    const format: BookFormat = lower.endsWith('.epub') ? 'epub' : 'txt'
    const fileName = /\.(epub|txt)$/i.test(filename) ? filename : `${filename}.${format}`
    const destDir = await platformStorage.getStorageDir()
    const imported = await platformStorage.importValidatedBookToStorage(sourcePath, destDir, fileName)

    let title = filename.replace(/\.(epub|txt)$/i, '')
    let author = format === 'epub' ? 'EPUB 문서' : 'TXT 문서'
    let coverBlob: Blob | null = null
    if (format === 'epub') {
      const epubMeta = await platformStorage
        .extractEpubMetadataFromPath(imported.storedPath)
        .catch(() => undefined)
      if (epubMeta?.title && epubMeta.title !== '제목 없는 EPUB') title = epubMeta.title
      if (epubMeta?.author) author = epubMeta.author
      coverBlob = epubMeta?.coverBlob ?? null
    } else if (title.includes(' - ')) {
      const parts = title.split(' - ')
      title = parts[0].trim()
      author = parts.slice(1).join(' - ').trim()
    }

    return upsertBookRecord({
      contentHash: imported.contentHash,
      fileSize: imported.fileSize,
      fileName,
      format,
      title,
      author,
      storedPath: imported.storedPath,
      coverBlob
    })
  }

  async function importFromUrl(
    url: string,
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<BookMeta> {
    if (isTauriEnv()) {
      const destDir = (await isDesktopApp()) ? await platformStorage.getStorageDir() : undefined
      const nativeRes = await downloadBookStreamNative({
        url,
        destDir,
        onProgress: (ev) =>
          onProgress?.({ loaded: ev.receivedBytes, total: ev.totalBytes ?? 0, percent: ev.percent })
      })
      const fallbackTitle = nativeRes.fileName.replace(/\.(epub|txt)$/i, '')
      return upsertBookRecord({
        contentHash: nativeRes.contentHash,
        fileSize: nativeRes.fileSize,
        fileName: nativeRes.fileName,
        format: nativeRes.detectedFormat,
        title: nativeRes.metadata?.title || fallbackTitle,
        author: nativeRes.metadata?.author || (nativeRes.detectedFormat === 'epub' ? 'EPUB 문서' : 'TXT 문서'),
        storedPath: nativeRes.storedPath,
        sourceUrl: nativeRes.finalUrl,
        coverBlob: nativeRes.metadata?.coverBlob ?? null
      })
    }

    const result = await downloadRemoteBook(url, onProgress)
    return addBookFromBuffer(
      result.buffer,
      `${result.filename}.${result.format}`,
      result.format,
      result.sourceUrl
    )
  }

  async function ensureBookContentHash(bookId: string): Promise<string | undefined> {
    const book = books.value.find((b) => b.id === bookId)
    if (!book) return undefined
    if (book.contentHash) return book.contentHash
    let hash: string | undefined
    if (book.storedPath && isTauriEnv()) {
      hash = await platformStorage.hashValidatedBookFile(book.storedPath).catch(() => undefined)
    }
    if (!hash) {
      const buf = await platformStorage.loadBookBinary(book.id, book.storedPath)
      if (buf) hash = await computeBufferSha256(buf)
    }
    if (hash) {
      book.contentHash = hash
      await platformStorage.setItem(BOOKS_META_KEY, books.value)
    }
    return hash
  }

  const loadBookBinary = async (bookId: string): Promise<ArrayBuffer | null> => {
    const book = books.value.find((b) => b.id === bookId)
    return book ? platformStorage.loadBookBinary(book.id, book.storedPath) : null
  }
  const loadBookCoverBlob = (bookId: string) => platformStorage.loadCoverBlob(bookId)
  const getStorageDir = () => platformStorage.getStorageDir()
  const isCustomStorageDir = () => platformStorage.isCustomStorageDir()
  const setStorageDir = (dir: string | null) => platformStorage.setStorageDir(dir)
  const openStorageDir = () => platformStorage.openStorageDir()

  async function willDeleteFileOnRemove(bookId: string): Promise<boolean> {
    const storedPath = books.value.find((b) => b.id === bookId)?.storedPath
    return !storedPath || !(await isDesktopApp()) ? true : deleteFileOnRemove.value
  }

  async function removeBook(bookId: string): Promise<boolean> {
    const storedPath = books.value.find((b) => b.id === bookId)?.storedPath
    const deleteFile = await willDeleteFileOnRemove(bookId)
    books.value = books.value.filter((b) => b.id !== bookId)
    await platformStorage.removeCoverBlob(bookId).catch(() => {})
    if (deleteFile) await platformStorage.removeBookBinary(bookId, storedPath)
    await persistAll()
    return deleteFile
  }

  const setDeleteFileOnRemove = async (value: boolean) => {
    deleteFileOnRemove.value = value
    await platformStorage.setItem(DELETE_FILE_ON_REMOVE_KEY, value)
  }

  let cachedDeviceId: string | null = null
  let saveLocationTimer: ReturnType<typeof setTimeout> | null = null
  let booksMetaDirty = false

  async function flushReadingLocation(): Promise<void> {
    if (saveLocationTimer !== null) { clearTimeout(saveLocationTimer); saveLocationTimer = null }
    await platformStorage.setItem(POSITIONS_KEY, positions.value)
    if (booksMetaDirty) {
      booksMetaDirty = false
      await platformStorage.setItem(BOOKS_META_KEY, books.value)
    }
  }

  async function saveReadingLocation(
    bookId: string,
    locator: string,
    percentage: number,
    chapterTitle?: string
  ) {
    if (!cachedDeviceId) cachedDeviceId = await getOrCreateDeviceId()
    const now = Date.now()
    const location: ReadingLocation = {
      bookId,
      locator,
      percentage: Math.min(100, Math.max(0, Math.round(percentage * 10) / 10)),
      chapterTitle,
      updatedAt: now,
      deviceId: cachedDeviceId
    }
    positions.value[bookId] = location
    const target = books.value.find((b) => b.id === bookId)
    if (target) {
      target.lastLocation = location
      target.lastOpenedAt = now
      booksMetaDirty = true
    }
    if (saveLocationTimer !== null) clearTimeout(saveLocationTimer)
    saveLocationTimer = setTimeout(() => {
      saveLocationTimer = null
      void platformStorage.setItem(POSITIONS_KEY, positions.value)
    }, 400)
  }

  const getBookBookmarks = (bookId: string): BookmarkItem[] => bookmarks.value[bookId] || []

  async function addBookmark(
    bookId: string,
    locator: string,
    percentage: number,
    title: string,
    excerpt: string
  ): Promise<BookmarkItem> {
    const list = bookmarks.value[bookId] ? [...bookmarks.value[bookId]] : []
    const existing = list.find((b) => b.locator === locator)
    if (existing) return existing
    const item: BookmarkItem = {
      id: `bm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      bookId,
      locator,
      percentage: Math.round(percentage * 10) / 10,
      title: title || '책갈피',
      excerpt: excerpt.slice(0, 120),
      createdAt: Date.now()
    }
    list.unshift(item)
    bookmarks.value[bookId] = list
    await platformStorage.setItem(BOOKMARKS_KEY, bookmarks.value)
    return item
  }

  async function removeBookmark(bookId: string, bookmarkId: string) {
    if (!bookmarks.value[bookId]) return
    bookmarks.value[bookId] = bookmarks.value[bookId].filter((b) => b.id !== bookmarkId)
    await platformStorage.setItem(BOOKMARKS_KEY, bookmarks.value)
  }

  async function syncNow(): Promise<{ updatedCount: number; message: string }> {
    const settingsStore = useSettingsStore()
    isSyncing.value = true
    try {
      const res = await runBookSync(books.value, positions.value, bookmarks.value, settingsStore.settings)
      positions.value = res.positions
      bookmarks.value = res.bookmarks
      await persistAll()
      lastSyncTime.value = Date.now()
      syncStatusMessage.value = res.message
      return { updatedCount: res.updatedCount, message: res.message }
    } finally { isSyncing.value = false }
  }

  const exportSyncSnapshot = async (): Promise<string> =>
    serializeSyncSnapshot(await getOrCreateDeviceId(), positions.value, bookmarks.value, useSettingsStore().settings)

  async function importSyncSnapshot(jsonText: string): Promise<number> {
    const updatedCount = applySyncSnapshotJson(jsonText, books.value, positions.value, bookmarks.value)
    await persistAll()
    lastSyncTime.value = Date.now()
    return updatedCount
  }

  const locationIndexCachePort = {
    load: (contentHash: string) => platformStorage.loadLocationIndex(contentHash),
    save: (contentHash: string, record: LocationIndexCacheRecord) =>
      platformStorage.saveLocationIndex(contentHash, record)
  }

  return {
    books,
    sortedBooks,
    positions,
    bookmarks,
    isInitialized,
    isSyncing,
    lastSyncTime,
    syncStatusMessage,
    deleteFileOnRemove,
    locationIndexCachePort,
    setDeleteFileOnRemove,
    willDeleteFileOnRemove,
    initLibrary,
    seedSampleBooks,
    addBookFromBuffer,
    addBookFromNativePath,
    importFromUrl,
    ensureBookContentHash,
    loadBookBinary,
    loadBookCoverBlob,
    getStorageDir,
    isCustomStorageDir,
    setStorageDir,
    openStorageDir,
    removeBook,
    saveReadingLocation,
    flushReadingLocation,
    getBookBookmarks,
    addBookmark,
    removeBookmark,
    syncNow,
    exportSyncSnapshot,
    importSyncSnapshot
  }
})
