import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mockIPC } from '@tauri-apps/api/mocks'
import { StorageWriteError, type BookMeta } from '@/types'

describe('Storage v1->v2 cover Blob migration, decoupled position flush & non-fallback write error (T016)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('migrates 100 legacy books with Base64 coverUrl into book_covers Blob, stops writing to localStorage, and saves positions cleanly', async () => {
    const { platformStorage } = await import('@/services/storage/platformAdapter')
    const { useBookStore } = await import('@/stores/useBookStore')

    const tinyPngDataUri =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII='

    const legacyBooks: BookMeta[] = Array.from({ length: 100 }, (_, i) => ({
      id: `legacy-book-${i}`,
      title: `도서 ${i}`,
      author: '작가',
      format: 'epub',
      fileSize: 5000 + i,
      coverUrl: tinyPngDataUri,
      isOfflineCached: true,
      addedAt: 1000 + i,
      lastOpenedAt: 1000 + i
    }))

    await platformStorage.setItem('samples_seeded_v1', true)
    await platformStorage.setItem('library_books_v1', legacyBooks)

    const store = useBookStore()
    await store.initLibrary()

    expect(store.books).toHaveLength(100)
    expect(store.books[0].hasCover).toBe(true)
    expect(store.books[0].coverUrl).toBeUndefined()
    expect(localStorage.getItem('easyviewer:library_books_v1')).toBeNull()

    const coverBlob = await platformStorage.loadCoverBlob('legacy-book-0')
    expect(coverBlob).not.toBeNull()
    expect(coverBlob!.size).toBeGreaterThan(0)

    const setItemSpy = vi.spyOn(platformStorage, 'setItem')
    await store.saveReadingLocation('legacy-book-0', 'epubcfi(/6/2)', 45, '제1장')
    await store.flushReadingLocation()
    expect(setItemSpy).toHaveBeenCalledWith('reading_positions_v1', expect.any(Object))
    expect(setItemSpy).not.toHaveBeenCalledWith('library_books_v1', expect.any(Array))
  })

  it('flushes debounced location saves immediately and throws StorageWriteError on desktop write failures', async () => {
    vi.resetModules()
    mockIPC((cmd) => {
      if (cmd === 'is_desktop') return true
      if (cmd === 'allow_storage_dir') return null
      if (cmd === 'plugin:path|resolve_directory') return '/tmp/app-data'
      if (cmd === 'plugin:path|join') return '/tmp/app-data/books'
      return null
    })
    vi.doMock('@tauri-apps/plugin-fs', () => ({
      exists: async () => false,
      mkdir: async () => undefined,
      writeFile: async () => {
        throw new Error('EACCES: read-only storage folder')
      }
    }))

    const { platformStorage } = await import('@/services/storage/platformAdapter')
    await expect(
      platformStorage.saveBookFile('book-fail', 'fail.txt', new Uint8Array([1, 2, 3]).buffer)
    ).rejects.toMatchObject({
      name: 'StorageWriteError',
      code: 'STORAGE_DIR_WRITE_FAILED'
    })

    vi.doUnmock('@tauri-apps/plugin-fs')
  })
})
