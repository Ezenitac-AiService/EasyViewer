import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

describe('SHA-256 contentHash deduplication & legacy same-fileSize on-demand matching (T017)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('distinguishes buffers with identical first 4KB but different tails using full SHA-256 contentHash', async () => {
    const { useBookStore } = await import('@/stores/useBookStore')
    const store = useBookStore()

    const bufA = new Uint8Array(8192).fill(65)
    const bufB = new Uint8Array(8192).fill(65)
    bufB[6000] = 66 // Differs after first 4KB

    const bookA = await store.addBookFromBuffer(bufA.buffer, '권1.txt', 'txt')
    const bookB = await store.addBookFromBuffer(bufB.buffer, '권2.txt', 'txt')

    expect(bookA.contentHash).toMatch(/^sha256-[0-9a-f]{64}$/)
    expect(bookB.contentHash).toMatch(/^sha256-[0-9a-f]{64}$/)
    expect(bookA.contentHash).not.toBe(bookB.contentHash)
    expect(bookA.id).not.toBe(bookB.id)
    expect(store.books).toHaveLength(2)
  })

  it('hashes only same-fileSize legacy candidates on demand to prevent duplicate registration on rename', async () => {
    const { platformStorage } = await import('@/services/storage/platformAdapter')
    const { useBookStore } = await import('@/stores/useBookStore')

    const originalBytes = new TextEncoder().encode('동일 콘텐츠지만 파일명 변경 재등록 테스트 본문')
    await platformStorage.setItem('samples_seeded_v1', true)
    await platformStorage.setItem('library_books_v1', [
      {
        id: 'legacy-kept-id',
        title: '기존 도서',
        author: '작가',
        format: 'txt',
        fileSize: originalBytes.byteLength,
        isOfflineCached: true,
        addedAt: 1000,
        lastOpenedAt: 1000
      }
    ])
    await platformStorage.saveBookFile('legacy-kept-id', 'legacy.txt', originalBytes.buffer.slice(0))

    const store = useBookStore()
    await store.initLibrary()

    const reimported = await store.addBookFromBuffer(
      originalBytes.buffer.slice(0),
      '이름바뀐사본.txt',
      'txt'
    )
    expect(reimported.id).toBe('legacy-kept-id')
    expect(reimported.contentHash).toMatch(/^sha256-[0-9a-f]{64}$/)
    expect(store.books).toHaveLength(1)
  })
})
