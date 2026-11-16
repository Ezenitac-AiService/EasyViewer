import { isTauriEnv } from '@/services/storage/platformAdapter'
import {
  isSupportedBookFileName,
  MAX_LOCAL_BOOK_BYTES,
  readValidatedLocalFileBuffer
} from '@/services/platform/dialogService'
import { platformPath } from '@/services/platform/pathService'

export interface DroppedBookInput {
  fileName: string
  buffer: ArrayBuffer
  sourcePath?: string
}

export interface PlatformDragDropPort {
  subscribe(handlers: {
    onDragStateChange: (isDragging: boolean) => void
    onFilesDropped: (items: DroppedBookInput[]) => Promise<void> | void
    onError?: (err: unknown) => void
  }): Promise<() => void>
}

function hasFileTransfer(e: DragEvent): boolean {
  const types = e.dataTransfer?.types
  if (!types) return true
  return Array.from(types).includes('Files')
}

async function readBrowserFileBuffer(file: File): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === 'function') {
    return file.arrayBuffer()
  }
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result)
      } else {
        reject(new Error('파일 데이터를 ArrayBuffer로 읽을 수 없습니다.'))
      }
    }
    reader.onerror = () => reject(reader.error || new Error('파일 읽기 실패'))
    reader.readAsArrayBuffer(file)
  })
}

export class PlatformDragDropService implements PlatformDragDropPort {
  async subscribe(handlers: {
    onDragStateChange: (isDragging: boolean) => void
    onFilesDropped: (items: DroppedBookInput[]) => Promise<void> | void
    onError?: (err: unknown) => void
  }): Promise<() => void> {
    if (isTauriEnv()) {
      const { getCurrentWebview } = await import('@tauri-apps/api/webview')
      const unlistenTauri = await getCurrentWebview().onDragDropEvent(async (event) => {
        const payload = event.payload
        if (payload.type === 'enter' || payload.type === 'over') {
          handlers.onDragStateChange(true)
        } else if (payload.type === 'leave') {
          handlers.onDragStateChange(false)
        } else if (payload.type === 'drop') {
          handlers.onDragStateChange(false)
          if (payload.paths && payload.paths.length > 0) {
            const items: DroppedBookInput[] = []
            for (const fullPath of payload.paths) {
              const fileName = platformPath.basename(fullPath)
              if (!isSupportedBookFileName(fileName)) {
                handlers.onError?.(new Error(`지원하지 않는 파일 형식입니다: ${fileName}`))
                continue
              }
              try {
                const { buffer } = await readValidatedLocalFileBuffer(fullPath)
                items.push({ fileName, buffer, sourcePath: fullPath })
              } catch (err) {
                handlers.onError?.(err)
              }
            }
            if (items.length > 0) {
              await handlers.onFilesDropped(items)
            }
          }
        }
      })

      return () => {
        unlistenTauri()
      }
    }

    let dragDepth = 0

    const onDragEnter = (e: DragEvent) => {
      if (!hasFileTransfer(e)) return
      e.preventDefault()
      dragDepth++
      handlers.onDragStateChange(true)
    }

    const onDragOver = (e: DragEvent) => {
      if (!hasFileTransfer(e)) return
      e.preventDefault()
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy'
      }
      handlers.onDragStateChange(true)
    }

    const onDragLeave = (e: DragEvent) => {
      if (!hasFileTransfer(e)) return
      e.preventDefault()
      dragDepth = Math.max(0, dragDepth - 1)
      if (dragDepth === 0 || !e.relatedTarget) {
        handlers.onDragStateChange(false)
        dragDepth = 0
      }
    }

    const onDrop = async (e: DragEvent) => {
      e.preventDefault()
      dragDepth = 0
      handlers.onDragStateChange(false)
      const fileList = e.dataTransfer?.files
      if (!fileList || fileList.length === 0) return

      const items: DroppedBookInput[] = []
      for (const file of Array.from(fileList)) {
        if (!isSupportedBookFileName(file.name)) {
          handlers.onError?.(new Error(`지원하지 않는 파일 형식입니다: ${file.name}`))
          continue
        }
        if (file.size > MAX_LOCAL_BOOK_BYTES) {
          handlers.onError?.(
            new Error(`허용된 최대 도서 파일 크기(256 MB)를 초과했습니다: ${file.name}`)
          )
          continue
        }
        try {
          const buffer = await readBrowserFileBuffer(file)
          items.push({ fileName: file.name, buffer })
        } catch (err) {
          handlers.onError?.(err)
        }
      }

      if (items.length > 0) {
        await handlers.onFilesDropped(items)
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('dragenter', onDragEnter)
      window.addEventListener('dragover', onDragOver)
      window.addEventListener('dragleave', onDragLeave)
      window.addEventListener('drop', onDrop)
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('dragenter', onDragEnter)
        window.removeEventListener('dragover', onDragOver)
        window.removeEventListener('dragleave', onDragLeave)
        window.removeEventListener('drop', onDrop)
      }
    }
  }
}

export const platformDragDrop = new PlatformDragDropService()
