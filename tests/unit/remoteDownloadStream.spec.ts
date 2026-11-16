import { describe, expect, it, vi } from 'vitest'
import { mockIPC } from '@tauri-apps/api/mocks'

describe('Native disk streaming download & lightweight metadata integration (T018)', () => {
  it('calls safe_download_to_storage and extract_epub_metadata_from_path without buffering 256MB in JS', async () => {
    vi.resetModules()
    const calls: string[] = []
    mockIPC((cmd) => {
      calls.push(cmd)
      if (cmd === 'is_desktop') return true
      if (cmd === 'safe_download_to_storage') {
        return {
          storedPath: '/Users/tester/Books/big.epub',
          fileName: 'big.epub',
          fileSize: 200 * 1024 * 1024,
          contentHash: 'sha256-' + 'a'.repeat(64),
          finalUrl: 'https://example.com/big.epub',
          detectedFormat: 'epub'
        }
      }
      if (cmd === 'extract_epub_metadata_from_path') {
        return {
          title: '스트리밍 EPUB',
          author: '작가',
          coverBytes: [137, 80, 78, 71],
          coverMime: 'image/png'
        }
      }
      return null
    })

    const { downloadBookStreamNative } = await import('@/services/network/downloadService')
    const progressEvents: number[] = []
    const result = await downloadBookStreamNative({
      url: 'https://example.com/big.epub',
      destDir: '/Users/tester/Books',
      onProgress: (ev) => progressEvents.push(ev.percent)
    })

    expect(result.storedPath).toBe('/Users/tester/Books/big.epub')
    expect(result.contentHash).toBe('sha256-' + 'a'.repeat(64))
    expect(calls).toContain('safe_download_to_storage')
    expect(calls).not.toContain('safe_remote_fetch')
    expect(calls).not.toContain('read_validated_book_file')
  })
})
