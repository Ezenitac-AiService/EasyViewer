import { StorageWriteError, type LocationIndexCacheRecord } from '@/types'
import {
  idbGetBookFile,
  idbGetKeyValue,
  idbPutBookFile,
  idbRemoveBookFile,
  idbSetKeyValue,
  loadCoverBlob,
  loadLocationIndex,
  removeCoverBlob,
  saveCoverBlob,
  saveLocationIndex
} from './assetStore'
import { computeBufferSha256 } from './bookHasher'
import {
  extractEpubMetadataFromPathIpc,
  hashValidatedBookFileIpc,
  importValidatedBookToStorageIpc,
  readValidatedBookFileIpc
} from './nativeBookIpc'

const STORAGE_DIR_KEY = 'storage_dir_v1'
const NO_LOCALSTORAGE_KEYS = new Set(['library_books_v1', 'reading_positions_v1', 'bookmarks_v1'])

let desktopCache: boolean | null = null

export function isTauriEnv(): boolean {
  return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)
}

async function invokeCommand<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(cmd, args)
}

export async function isDesktopApp(): Promise<boolean> {
  if (!isTauriEnv()) return false
  if (desktopCache !== null) return desktopCache
  try {
    desktopCache = await invokeCommand<boolean>('is_desktop')
    return desktopCache
  } catch {
    return false
  }
}

export function sanitizeFileName(name: string): string {
  const dot = name.lastIndexOf('.')
  const rawStem = dot > 0 ? name.slice(0, dot) : name
  const rawExt = dot > 0 ? name.slice(dot) : ''
  let stem = rawStem
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/[. ]+$/g, '')
    .trim()
  if (!stem) stem = 'book'
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(stem)) stem = `_${stem}`
  const ext = rawExt.replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
  if (stem.length + ext.length > 180) stem = stem.slice(0, Math.max(1, 180 - ext.length))
  return `${stem}${ext}`
}

function comparablePath(p: string): string {
  const unified = p.replace(/\\/g, '/').replace(/\/+$/, '')
  const caseInsensitive =
    typeof navigator !== 'undefined' && /Windows|Macintosh|Mac OS X/i.test(navigator.userAgent)
  return caseInsensitive ? unified.toLowerCase() : unified
}

async function sameFileContent(filePath: string, data: ArrayBuffer): Promise<boolean> {
  const [diskHash, addedHash] = await Promise.all([
    hashValidatedBookFileIpc(filePath),
    computeBufferSha256(data)
  ])
  return typeof diskHash === 'string' && diskHash === addedHash
}

async function findInStorageDir(
  dir: string,
  fileName: string,
  data: ArrayBuffer,
  sourcePath?: string
): Promise<string | undefined> {
  if (sourcePath && comparablePath(sourcePath).startsWith(`${comparablePath(dir)}/`)) {
    return sourcePath
  }
  const { join } = await import('@tauri-apps/api/path')
  const { exists } = await import('@tauri-apps/plugin-fs')
  const candidate = await join(dir, sanitizeFileName(fileName))
  try {
    if ((await exists(candidate)) && (await sameFileContent(candidate, data))) {
      return candidate
    }
  } catch {
    // Ignore probe errors
  }
  return undefined
}

async function uniqueFilePath(dir: string, fileName: string): Promise<string> {
  const { join } = await import('@tauri-apps/api/path')
  const { exists } = await import('@tauri-apps/plugin-fs')
  const dot = fileName.lastIndexOf('.')
  const base = dot > 0 ? fileName.slice(0, dot) : fileName
  const ext = dot > 0 ? fileName.slice(dot) : ''
  let candidate = await join(dir, fileName)
  for (let n = 2; await exists(candidate); n++) {
    candidate = await join(dir, `${base} (${n})${ext}`)
  }
  return candidate
}

export class PlatformStorageAdapter {
  async getDefaultStorageDir(): Promise<string> {
    const { appDataDir, join } = await import('@tauri-apps/api/path')
    return join(await appDataDir(), 'books')
  }

  async getStorageDir(): Promise<string> {
    const custom = await this.getItem<string | null>(STORAGE_DIR_KEY, null)
    return custom || this.getDefaultStorageDir()
  }

  async isCustomStorageDir(): Promise<boolean> {
    return !!(await this.getItem<string | null>(STORAGE_DIR_KEY, null))
  }

  async setStorageDir(dir: string | null): Promise<void> {
    if (dir) await invokeCommand('allow_storage_dir', { path: dir })
    await this.setItem(STORAGE_DIR_KEY, dir)
  }

  async openStorageDir(): Promise<void> {
    const dir = await this.getStorageDir()
    await invokeCommand('allow_storage_dir', { path: dir })
    const { openPath } = await import('@tauri-apps/plugin-opener')
    await openPath(dir)
  }

  async allowStorageDirs(dirs: string[]): Promise<void> {
    if (!(await isDesktopApp())) return
    for (const dir of new Set(dirs.filter(Boolean))) {
      try {
        await invokeCommand('allow_storage_dir', { path: dir })
      } catch (err) {
        console.warn('[PlatformAdapter] Storage folder unavailable:', dir, err)
      }
    }
  }

  async migrateLegacyBookFile(bookId: string, fileName: string): Promise<string | undefined> {
    if (!(await isDesktopApp())) return undefined
    try {
      const { exists, rename, BaseDirectory } = await import('@tauri-apps/plugin-fs')
      const legacy = `books/${bookId}.bin`
      if (!(await exists(legacy, { baseDir: BaseDirectory.AppData }))) return undefined
      const target = await uniqueFilePath(await this.getDefaultStorageDir(), sanitizeFileName(fileName))
      await rename(legacy, target, { oldPathBaseDir: BaseDirectory.AppData })
      return target
    } catch (err) {
      console.warn('[PlatformAdapter] Could not rename legacy book file:', bookId, err)
      return undefined
    }
  }

  async saveBookFile(
    bookId: string,
    fileName: string,
    data: ArrayBuffer,
    existingPath?: string,
    sourcePath?: string
  ): Promise<string | undefined> {
    if (isTauriEnv() && !(await isDesktopApp())) {
      try {
        const { writeFile, mkdir, BaseDirectory } = await import('@tauri-apps/plugin-fs')
        await mkdir('books', { baseDir: BaseDirectory.AppData, recursive: true })
        await writeFile(`books/${bookId}.bin`, new Uint8Array(data), { baseDir: BaseDirectory.AppData })
        return undefined
      } catch (err) {
        console.warn('[PlatformAdapter] Mobile Tauri FS fallback to IndexedDB:', err)
      }
    } else if (isTauriEnv()) {
      const dir = await this.getStorageDir()
      try {
        const { writeFile, exists } = await import('@tauri-apps/plugin-fs')
        await invokeCommand('allow_storage_dir', { path: dir })
        const inPlace = await findInStorageDir(dir, fileName, data, sourcePath)
        if (inPlace) return inPlace
        let target = existingPath && (await exists(existingPath)) ? existingPath : undefined
        if (!target) target = await uniqueFilePath(dir, sanitizeFileName(fileName))
        await writeFile(target, new Uint8Array(data))
        return target
      } catch (err) {
        throw new StorageWriteError(dir, err instanceof Error ? err.message : String(err))
      }
    }

    await idbPutBookFile(bookId, data)
    return undefined
  }

  async loadBookBinary(bookId: string, storedPath?: string): Promise<ArrayBuffer | null> {
    if (isTauriEnv()) {
      if (storedPath) {
        try {
          return await readValidatedBookFileIpc(storedPath)
        } catch (err) {
          console.warn('[PlatformAdapter] Stored book file not readable via IPC:', storedPath, err)
        }
      }
      try {
        const { appDataDir, join } = await import('@tauri-apps/api/path')
        const fallbackPath = await join(await appDataDir(), 'books', `${bookId}.bin`)
        return await readValidatedBookFileIpc(fallbackPath)
      } catch {
        // Fallback to IndexedDB
      }
    }
    return idbGetBookFile(bookId)
  }

  async removeBookBinary(bookId: string, storedPath?: string): Promise<void> {
    if (isTauriEnv()) {
      const { remove, BaseDirectory } = await import('@tauri-apps/plugin-fs')
      if (storedPath) {
        try {
          await remove(storedPath)
        } catch {
          // Ignore if not found
        }
      }
      try {
        await remove(`books/${bookId}.bin`, { baseDir: BaseDirectory.AppData })
      } catch {
        // Ignore if not found
      }
    }
    await idbRemoveBookFile(bookId)
  }

  async hashValidatedBookFile(path: string): Promise<string> {
    return hashValidatedBookFileIpc(path)
  }

  async importValidatedBookToStorage(sourcePath: string, destDir: string, targetFileName: string) {
    return importValidatedBookToStorageIpc(sourcePath, destDir, targetFileName)
  }

  async extractEpubMetadataFromPath(path: string) {
    return extractEpubMetadataFromPathIpc(path)
  }

  async saveCoverBlob(bookId: string, blob: Blob): Promise<void> {
    return saveCoverBlob(bookId, blob)
  }

  async loadCoverBlob(bookId: string): Promise<Blob | null> {
    return loadCoverBlob(bookId)
  }

  async removeCoverBlob(bookId: string): Promise<void> {
    return removeCoverBlob(bookId)
  }

  async saveLocationIndex(contentHash: string, record: LocationIndexCacheRecord): Promise<void> {
    return saveLocationIndex(contentHash, record)
  }

  async loadLocationIndex(contentHash: string): Promise<LocationIndexCacheRecord | null> {
    return loadLocationIndex(contentHash)
  }

  async setItem<T>(key: string, value: T): Promise<void> {
    const serialized = JSON.stringify(value)
    if (NO_LOCALSTORAGE_KEYS.has(key)) {
      try {
        localStorage.removeItem(`easyviewer:${key}`)
      } catch {
        // Ignore localStorage cleanup errors
      }
    } else {
      try {
        localStorage.setItem(`easyviewer:${key}`, serialized)
      } catch {
        // Quota fallback to IndexedDB
      }
    }
    await idbSetKeyValue(key, serialized)
  }

  async getItem<T>(key: string, defaultValue: T): Promise<T> {
    try {
      const rawFromDb = await idbGetKeyValue(key)
      if (rawFromDb !== undefined) {
        return JSON.parse(rawFromDb) as T
      }
    } catch {
      // Fallback to legacy localStorage
    }
    try {
      const raw = localStorage.getItem(`easyviewer:${key}`)
      if (raw !== null) {
        return JSON.parse(raw) as T
      }
    } catch {
      // Ignore parse errors
    }
    return defaultValue
  }
}

export const platformStorage = new PlatformStorageAdapter()
