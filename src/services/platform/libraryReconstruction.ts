// SPDX-License-Identifier: GPL-3.0-only
/**
 * Fallback after a desktop migration whose WebView store could not be read (spec 003 R1, T072):
 * register the copied `books/` files in place. Reading and hashing go through the existing
 * validated Rust boundaries; duplicates are skipped by path and content hash.
 */
import type { BookFormat, BookMeta } from '@/types'
import { isSupportedBookFileName } from '@/services/platform/dialogService'
import {
  hashValidatedBookFileIpc,
  readValidatedBookFileIpc
} from '@/services/storage/nativeBookIpc'
import { platformStorage } from '@/services/storage/platformAdapter'

/** The part of the library store this module needs (public store API only). */
export interface ReconstructionLibraryPort {
  readonly books: ReadonlyArray<Pick<BookMeta, 'contentHash' | 'storedPath'>>
  addBookFromBuffer(
    buffer: ArrayBuffer,
    filename: string,
    explicitFormat?: BookFormat,
    sourceUrl?: string,
    sourcePath?: string
  ): Promise<unknown>
}

export interface BookFileSource {
  listBookFiles(): Promise<Array<{ name: string; path: string }>>
  hash(path: string): Promise<string>
  read(path: string): Promise<ArrayBuffer>
}

export interface ReconstructionResult {
  added: number
  /** Already in the library (same path or same content). */
  skipped: number
  /** Could not be read or was rejected by the store (e.g. a damaged EPUB). */
  failed: number
}

export async function reconstructLibrary(
  library: ReconstructionLibraryPort,
  files: BookFileSource
): Promise<ReconstructionResult> {
  const knownPaths = new Set(library.books.map((b) => b.storedPath).filter(Boolean))
  const knownHashes = new Set(library.books.map((b) => b.contentHash).filter(Boolean))
  const result: ReconstructionResult = { added: 0, skipped: 0, failed: 0 }

  for (const file of await files.listBookFiles()) {
    if (!isSupportedBookFileName(file.name) || file.name.startsWith('.')) continue
    if (knownPaths.has(file.path)) {
      result.skipped += 1
      continue
    }
    try {
      const hash = await files.hash(file.path)
      if (knownHashes.has(hash)) {
        result.skipped += 1
        continue
      }
      const buffer = await files.read(file.path)
      // Passing the existing path makes the store register the file where it already is.
      await library.addBookFromBuffer(buffer, file.name, undefined, undefined, file.path)
      knownHashes.add(hash)
      knownPaths.add(file.path)
      result.added += 1
    } catch {
      result.failed += 1
    }
  }
  return result
}

/** Desktop source: the default storage folder (`<app data>/books`) of the new identifier. */
export function createDesktopBookFileSource(): BookFileSource {
  return {
    async listBookFiles() {
      const dir = await platformStorage.getDefaultStorageDir()
      await platformStorage.allowStorageDirs([dir])
      const { readDir } = await import('@tauri-apps/plugin-fs')
      const { join } = await import('@tauri-apps/api/path')
      let entries: Array<{ name: string; isFile: boolean }>
      try {
        entries = await readDir(dir)
      } catch {
        return []
      }
      const files = entries.filter((e) => e.isFile).map((e) => e.name).sort()
      return Promise.all(files.map(async (name) => ({ name, path: await join(dir, name) })))
    },
    hash: (path) => hashValidatedBookFileIpc(path),
    read: (path) => readValidatedBookFileIpc(path)
  }
}
