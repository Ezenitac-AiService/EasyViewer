import { describe, expect, it } from 'vitest'
import { extractEpubMetadata } from '@/engines/epub/epubEngine'
import { extractFilenameFromUrl, inferBookFormat } from '@/services/network/downloadService'
import {
  buildWebDavTargetUrl,
  loadWebDavHistory,
  saveWebDavConnection
} from '@/services/network/webdavService'
import { createCleanEpubBuffer } from '../fixtures/bookFixtures'

describe('Media and network baseline characterization', () => {
  it('extracts EPUB title and author from valid EPUB buffer', async () => {
    const epubBuf = await createCleanEpubBuffer({
      title: '별 헤는 밤',
      author: '윤동주'
    })
    const meta = await extractEpubMetadata(epubBuf)
    expect(meta.title).toBe('별 헤는 밤')
    expect(meta.author).toBe('윤동주')
  })

  it('infers book format from URL, content-type, or ZIP magic bytes and extracts filename', () => {
    const zipBytes = Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]).buffer
    expect(inferBookFormat('https://example.com/download?id=1', 'application/octet-stream', zipBytes)).toBe('epub')
    expect(inferBookFormat('https://example.com/book.txt', 'text/plain', new ArrayBuffer(8))).toBe('txt')
    expect(extractFilenameFromUrl('https://example.com/books/%EC%8B%9C%EC%A7%91.epub', 'epub')).toBe('시집')
  })

  it('builds deduplicated WebDAV target URLs and manages WebDAV history', async () => {
    expect(buildWebDavTargetUrl('https://nas.example.com/dav/', '/novels/test.epub', false)).toBe(
      'https://nas.example.com/dav/novels/test.epub'
    )
    expect(buildWebDavTargetUrl('https://nas.example.com/dav', '/dav', true)).toBe(
      'https://nas.example.com/dav/'
    )

    const saved = await saveWebDavConnection({
      alias: '',
      url: 'https://nas.example.com/dav/',
      username: 'reader',
      password: 'secret',
      initialPath: 'books'
    })
    expect(saved).toHaveLength(1)
    expect(saved[0].alias).toBe('reader@nas.example.com')
    expect(saved[0].initialPath).toBe('/books')

    const loaded = await loadWebDavHistory()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].url).toBe('https://nas.example.com/dav')
  })
})
