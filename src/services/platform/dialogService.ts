import { isDesktopApp, isTauriEnv } from '@/services/storage/platformAdapter'

export const MAX_LOCAL_BOOK_BYTES = 256 * 1024 * 1024 // 256 MiB

export function isSupportedBookFileName(fileName: string): boolean {
  const lower = fileName.trim().toLowerCase()
  return lower.endsWith('.txt') || lower.endsWith('.epub')
}

export interface SelectedBookFile {
  name: string
  size: number
  sourcePath?: string
  readBuffer(): Promise<ArrayBuffer>
}

export interface PickBookFilesResult {
  files: SelectedBookFile[]
  cancelled: boolean
}

export interface PlatformDialogPort {
  pickBookFiles(): Promise<PickBookFilesResult>
  pickStorageDirectory(currentDir?: string): Promise<string | null>
  confirmAction(options: {
    title: string
    message: string
    kind?: 'info' | 'warning'
    confirmLabel?: string
    cancelLabel?: string
  }): Promise<boolean>
}

function fileNameFromPath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/')
  return normalized.split('/').pop() || filePath
}

export async function readValidatedLocalFileBuffer(
  filePath: string,
  knownSize?: number
): Promise<{ buffer: ArrayBuffer; size: number }> {
  if (typeof knownSize === 'number' && knownSize > MAX_LOCAL_BOOK_BYTES) {
    throw new Error(`허용된 최대 도서 파일 크기(256 MB)를 초과했습니다: ${fileNameFromPath(filePath)}`)
  }

  try {
    const { stat, readFile } = await import('@tauri-apps/plugin-fs')
    const meta = await stat(filePath)
    if (meta.size > MAX_LOCAL_BOOK_BYTES) {
      throw new Error(`허용된 최대 도서 파일 크기(256 MB)를 초과했습니다: ${fileNameFromPath(filePath)}`)
    }
    const bytes = await readFile(filePath)
    if (bytes.byteLength > MAX_LOCAL_BOOK_BYTES) {
      throw new Error(`허용된 최대 도서 파일 크기(256 MB)를 초과했습니다: ${fileNameFromPath(filePath)}`)
    }
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
    return { buffer, size: bytes.byteLength }
  } catch (err) {
    // Fallback to validated Rust command for dropped/transient paths outside static FS scope
    if (err instanceof Error && err.message.includes('최대 도서 파일 크기')) {
      throw err
    }
    const { invoke } = await import('@tauri-apps/api/core')
    const raw = await invoke<ArrayBuffer | ArrayBufferView | number[]>('read_validated_book_file', {
      path: filePath,
      maxBytes: MAX_LOCAL_BOOK_BYTES
    })
    if (
      raw instanceof ArrayBuffer ||
      Object.prototype.toString.call(raw) === '[object ArrayBuffer]'
    ) {
      const ab = raw as ArrayBuffer
      return { buffer: ab, size: ab.byteLength }
    }
    const u8 =
      raw instanceof Uint8Array
        ? raw
        : ArrayBuffer.isView(raw)
          ? new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength)
          : Uint8Array.from(raw)
    const buffer = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer
    return { buffer, size: u8.byteLength }
  }
}

export class TauriOrWebDialogService implements PlatformDialogPort {
  async pickBookFiles(): Promise<PickBookFilesResult> {
    if (isTauriEnv()) {
      const { open } = await import('@tauri-apps/plugin-dialog')
      const selected = await open({
        directory: false,
        multiple: true,
        title: '도서 파일 선택',
        filters: [{ name: 'Books', extensions: ['txt', 'epub'] }]
      })
      if (!selected) {
        return { files: [], cancelled: true }
      }
      const paths = Array.isArray(selected) ? selected : [selected]
      const { stat } = await import('@tauri-apps/plugin-fs')
      const files: SelectedBookFile[] = []
      for (const p of paths) {
        const name = fileNameFromPath(p)
        let size = 0
        try {
          size = (await stat(p)).size
        } catch {
          size = 0
        }
        files.push({
          name,
          size,
          sourcePath: p,
          readBuffer: async () => (await readValidatedLocalFileBuffer(p, size)).buffer
        })
      }
      return { files, cancelled: false }
    }

    if (typeof document === 'undefined') {
      return { files: [], cancelled: true }
    }

    return new Promise((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.txt,.epub'
      input.multiple = true
      let settled = false
      const finish = (result: PickBookFilesResult) => {
        if (settled) return
        settled = true
        resolve(result)
      }
      input.onchange = () => {
        const list = input.files ? Array.from(input.files) : []
        if (list.length === 0) {
          finish({ files: [], cancelled: true })
          return
        }
        finish({
          cancelled: false,
          files: list.map((f) => ({
            name: f.name,
            size: f.size,
            readBuffer: async () => {
              if (f.size > MAX_LOCAL_BOOK_BYTES) {
                throw new Error(`허용된 최대 도서 파일 크기(256 MB)를 초과했습니다: ${f.name}`)
              }
              return f.arrayBuffer()
            }
          }))
        })
      }
      input.oncancel = () => finish({ files: [], cancelled: true })
      input.click()
    })
  }

  async pickStorageDirectory(currentDir?: string): Promise<string | null> {
    if (!(await isDesktopApp())) {
      return null
    }
    const { open } = await import('@tauri-apps/plugin-dialog')
    const picked = await open({
      directory: true,
      multiple: false,
      defaultPath: currentDir || undefined,
      title: '소설 저장 폴더 선택'
    })
    if (!picked || Array.isArray(picked)) {
      return null
    }
    return picked
  }

  async confirmAction(options: {
    title: string
    message: string
    kind?: 'info' | 'warning'
    confirmLabel?: string
    cancelLabel?: string
  }): Promise<boolean> {
    if (isTauriEnv()) {
      const { ask } = await import('@tauri-apps/plugin-dialog')
      return ask(options.message, {
        title: options.title,
        kind: options.kind ?? 'info',
        okLabel: options.confirmLabel,
        cancelLabel: options.cancelLabel
      })
    }

    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      return window.confirm(`${options.title}\n\n${options.message}`)
    }
    return false
  }
}

export const platformDialog = new TauriOrWebDialogService()
