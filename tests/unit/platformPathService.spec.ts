import { describe, expect, it, vi } from 'vitest'
import { mockIPC } from '@tauri-apps/api/mocks'

describe('PlatformPathPort contract (US2)', () => {
  it('normalizes Windows backslash and POSIX slash in basename and web dirname fallback', async () => {
    vi.resetModules()
    const { platformPath } = await import('@/services/platform/pathService')

    expect(platformPath.basename('C:\\Users\\reader\\Books\\별 헤는 밤.txt')).toBe('별 헤는 밤.txt')
    expect(platformPath.basename('/Users/reader/Books/novel.epub')).toBe('novel.epub')
    expect(platformPath.basename('plain.txt')).toBe('plain.txt')

    expect(await platformPath.dirname('C:\\Users\\reader\\Books\\book.txt')).toBe('C:\\Users\\reader\\Books')
    expect(await platformPath.dirname('/Users/reader/Books/novel.epub')).toBe('/Users/reader/Books')
    expect(await platformPath.dirname('single.txt')).toBe('')
  })

  it('delegates dirname to Tauri path IPC when running inside Tauri environment', async () => {
    vi.resetModules()
    mockIPC((cmd, args) => {
      if (cmd === 'plugin:path|dirname') {
        const p = (args as { path: string }).path
        return p.slice(0, p.lastIndexOf('/'))
      }
      return null
    })

    const { platformPath } = await import('@/services/platform/pathService')
    expect(await platformPath.dirname('/var/mobile/books/book.epub')).toBe('/var/mobile/books')
  })
})
