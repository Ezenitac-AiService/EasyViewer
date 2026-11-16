import { describe, expect, it, vi } from 'vitest'
import { mockIPC } from '@tauri-apps/api/mocks'

describe('PlatformDialogPort contract (US2)', () => {
  it('returns null from pickStorageDirectory in web fallback and invokes window.confirm for confirmAction', async () => {
    vi.resetModules()
    const { platformDialog } = await import('@/services/platform/dialogService')

    expect(await platformDialog.pickStorageDirectory('/tmp')).toBeNull()

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    expect(
      await platformDialog.confirmAction({
        title: '책 삭제',
        message: '삭제할까요?'
      })
    ).toBe(false)
    expect(
      await platformDialog.confirmAction({
        title: '책 삭제',
        message: '삭제할까요?'
      })
    ).toBe(true)
    expect(confirmSpy).toHaveBeenCalledTimes(2)
  })

  it('picks files lazily in Tauri mode and maps cancel/ok confirmation via mockIPC', async () => {
    vi.resetModules()
    const bytes = Array.from(new TextEncoder().encode('hello book'))
    mockIPC((cmd, args) => {
      const payload = args as { options?: { directory?: boolean }; buttons?: unknown }
      if (cmd === 'is_desktop') return true
      if (cmd === 'plugin:dialog|open') {
        if (payload?.options?.directory) {
          return '/Users/reader/ChosenBooks'
        }
        return ['/Users/reader/sample.txt']
      }
      if (cmd === 'plugin:fs|stat') {
        return { size: bytes.length, isFile: true, isDirectory: false }
      }
      if (cmd === 'plugin:fs|read_file') {
        return bytes
      }
      if (cmd === 'plugin:dialog|message') {
        return '삭제'
      }
      return null
    })

    const { platformDialog } = await import('@/services/platform/dialogService')
    expect(await platformDialog.pickStorageDirectory()).toBe('/Users/reader/ChosenBooks')

    const picked = await platformDialog.pickBookFiles()
    expect(picked.cancelled).toBe(false)
    expect(picked.files).toHaveLength(1)
    expect(picked.files[0].name).toBe('sample.txt')
    expect(picked.files[0].sourcePath).toBe('/Users/reader/sample.txt')

    const buf = await picked.files[0].readBuffer()
    expect(new TextDecoder().decode(buf)).toBe('hello book')

    const ok = await platformDialog.confirmAction({
      title: '책 삭제',
      message: '확인',
      kind: 'warning',
      confirmLabel: '삭제',
      cancelLabel: '취소'
    })
    expect(ok).toBe(true)
  })

  it('returns { files: [], cancelled: true } when Tauri file picker is dismissed', async () => {
    vi.resetModules()
    mockIPC((cmd) => {
      if (cmd === 'plugin:dialog|open') return null
      return null
    })

    const { platformDialog } = await import('@/services/platform/dialogService')
    const picked = await platformDialog.pickBookFiles()
    expect(picked).toEqual({ files: [], cancelled: true })
  })

  it('decodes binary ArrayBuffer responses from Tauri v2 read_validated_book_file ipc::Response (T067)', async () => {
    vi.resetModules()
    const payload = new TextEncoder().encode('binary-epub-bytes')
    vi.doMock('@tauri-apps/plugin-fs', () => ({
      stat: async () => {
        throw new Error('outside fs scope')
      },
      readFile: async () => {
        throw new Error('outside fs scope')
      }
    }))
    vi.doMock('@tauri-apps/api/core', () => ({
      invoke: async (cmd: string) => {
        if (cmd === 'read_validated_book_file') {
          return payload.buffer.slice(0)
        }
        return null
      }
    }))
    vi.doMock('@/services/storage/platformAdapter', () => ({
      isTauriEnv: () => true
    }))

    const { readValidatedLocalFileBuffer } = await import('@/services/platform/dialogService')
    const { buffer, size } = await readValidatedLocalFileBuffer('/Users/reader/Downloads/book.epub')
    expect(size).toBe(payload.byteLength)
    expect(new TextDecoder().decode(buffer)).toBe('binary-epub-bytes')

    vi.doUnmock('@/services/storage/platformAdapter')
    vi.doUnmock('@tauri-apps/api/core')
    vi.doUnmock('@tauri-apps/plugin-fs')
  })
})
