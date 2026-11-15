import { describe, expect, it, vi } from 'vitest'
import { mockIPC } from '@tauri-apps/api/mocks'

describe('PlatformDragDropPort contract (US2)', () => {
  it('handles browser HTML5 drag/drop events, filters invalid extensions & oversized files, and cleans up', async () => {
    vi.resetModules()
    const { platformDragDrop } = await import('@/services/platform/dragDropService')

    const states: boolean[] = []
    const dropped: Array<{ fileName: string; size: number }> = []
    const errors: unknown[] = []

    const unsubscribe = await platformDragDrop.subscribe({
      onDragStateChange: (dragging) => states.push(dragging),
      onFilesDropped: (items) => {
        for (const item of items) {
          dropped.push({ fileName: item.fileName, size: item.buffer.byteLength })
        }
      },
      onError: (err) => errors.push(err)
    })

    const txtFile = new File(['hello world'], 'story.txt', { type: 'text/plain' })
    const invalidFile = new File(['bad'], 'malware.exe', { type: 'application/octet-stream' })
    const fakeOversizedFile = {
      name: 'huge.epub',
      size: 300 * 1024 * 1024,
      arrayBuffer: async () => new ArrayBuffer(0)
    } as unknown as File

    const dragEnterEvt = new Event('dragenter') as DragEvent
    Object.defineProperty(dragEnterEvt, 'dataTransfer', {
      value: { types: ['Files'], dropEffect: '' }
    })
    window.dispatchEvent(dragEnterEvt)
    expect(states[states.length - 1]).toBe(true)

    const dropEvt = new Event('drop') as DragEvent
    Object.defineProperty(dropEvt, 'dataTransfer', {
      value: { files: [txtFile, invalidFile, fakeOversizedFile] }
    })
    window.dispatchEvent(dropEvt)

    await vi.waitFor(() => {
      expect(dropped).toHaveLength(1)
    })
    expect(dropped[0]).toEqual({ fileName: 'story.txt', size: 11 })
    expect(states[states.length - 1]).toBe(false)
    expect(errors.length).toBeGreaterThanOrEqual(1)

    unsubscribe()
  })

  it('subscribes ONLY to Tauri onDragDropEvent (no HTML5 window drag* listeners) and reads dropped paths via readValidatedLocalFileBuffer (T063)', async () => {
    vi.resetModules()
    const listeners = new Map<string, (ev: { payload: unknown }) => Promise<void> | void>()
    const rawBytes = new TextEncoder().encode('dropped tauri txt')
    const addSpy = vi.spyOn(window, 'addEventListener')

    mockIPC((cmd, args) => {
      if (cmd === 'plugin:fs|stat') {
        throw new Error('outside fs scope')
      }
      if (cmd === 'read_validated_book_file') {
        const reqPath = (args as { path: string }).path
        if (reqPath.includes('/etc/passwd')) {
          throw new Error('SECURITY_DENIED: system path blocked')
        }
        return Array.from(rawBytes)
      }
      return null
    })

    vi.doMock('@tauri-apps/api/webview', () => ({
      getCurrentWebview: () => ({
        onDragDropEvent: async (cb: (ev: { payload: unknown }) => Promise<void> | void) => {
          listeners.set('drag-drop', cb)
          return () => {
            listeners.delete('drag-drop')
          }
        }
      })
    }))

    const { platformDragDrop } = await import('@/services/platform/dragDropService')
    const tauriConf = await import('../../src-tauri/tauri.conf.json')
    expect(tauriConf.app.windows[0]?.dragDropEnabled).toBe(true)

    const states: boolean[] = []
    const dropped: Array<{ fileName: string; size: number; sourcePath?: string }> = []
    const errors: unknown[] = []

    const unsub = await platformDragDrop.subscribe({
      onDragStateChange: (d) => states.push(d),
      onFilesDropped: (items) => {
        for (const item of items) {
          dropped.push({
            fileName: item.fileName,
            size: item.buffer.byteLength,
            sourcePath: item.sourcePath
          })
        }
      },
      onError: (err) => errors.push(err)
    })

    const registeredDragEvents = addSpy.mock.calls
      .map((c) => c[0])
      .filter((t) => ['dragenter', 'dragover', 'dragleave', 'drop'].includes(t))
    expect(registeredDragEvents).toEqual([])
    expect(listeners.has('drag-drop')).toBe(true)

    const cb = listeners.get('drag-drop')!
    await cb({ payload: { type: 'enter' } })
    expect(states.at(-1)).toBe(true)

    await cb({
      payload: {
        type: 'drop',
        paths: ['/Users/dev/Books/novel.txt', '/etc/passwd.txt']
      }
    })
    expect(states.at(-1)).toBe(false)
    expect(dropped).toEqual([
      { fileName: 'novel.txt', size: rawBytes.byteLength, sourcePath: '/Users/dev/Books/novel.txt' }
    ])
    expect(errors).toHaveLength(1)

    unsub()
    expect(listeners.has('drag-drop')).toBe(false)
    addSpy.mockRestore()
    vi.doUnmock('@tauri-apps/api/webview')
  })
})
