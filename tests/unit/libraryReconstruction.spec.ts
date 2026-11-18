// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it, vi } from 'vitest'
import {
  reconstructLibrary,
  type BookFileSource,
  type ReconstructionLibraryPort
} from '@/services/platform/libraryReconstruction'

/** spec 003 US6 / T072: rebuild the library from copied `books/` files, in place, without duplicates. */

const DIR = '/Users/u/Library/Application Support/com.ezenitac.easyviewer/books'

function source(files: Record<string, { hash: string; bytes?: string; failRead?: boolean }>): BookFileSource {
  return {
    listBookFiles: vi.fn(async () => Object.keys(files).map((name) => ({ name, path: `${DIR}/${name}` }))),
    hash: vi.fn(async (path: string) => files[path.slice(DIR.length + 1)].hash),
    read: vi.fn(async (path: string) => {
      const f = files[path.slice(DIR.length + 1)]
      if (f.failRead) throw new Error('unreadable')
      return new TextEncoder().encode(f.bytes ?? 'x').buffer as ArrayBuffer
    })
  }
}

/** Mirrors the store: a book added from a source path inside the storage folder keeps that path. */
function library(existing: Array<{ contentHash?: string; storedPath?: string }> = []): ReconstructionLibraryPort & {
  added: Array<{ fileName: string; sourcePath?: string }>
} {
  const books = [...existing]
  const added: Array<{ fileName: string; sourcePath?: string }> = []
  return {
    get books() {
      return books
    },
    added,
    addBookFromBuffer: vi.fn(async (_buf: ArrayBuffer, fileName: string, _f?: unknown, _u?: unknown, sourcePath?: string) => {
      added.push({ fileName, sourcePath })
      books.push({ contentHash: `h-${fileName}`, storedPath: sourcePath })
    })
  }
}

describe('reconstructLibrary', () => {
  it('registers supported files in place (passes the existing path, never copies)', async () => {
    const lib = library()
    const files = source({ 'a.epub': { hash: 'ha' }, 'b.TXT': { hash: 'hb' }, 'notes.pdf': { hash: 'hp' }, '.DS_Store': { hash: 'hd' } })
    const res = await reconstructLibrary(lib, files)
    expect(res).toEqual({ added: 2, skipped: 0, failed: 0 })
    expect(lib.added).toEqual([
      { fileName: 'a.epub', sourcePath: `${DIR}/a.epub` },
      { fileName: 'b.TXT', sourcePath: `${DIR}/b.TXT` }
    ])
  })

  it('skips files already in the library by path or by content hash', async () => {
    const lib = library([{ storedPath: `${DIR}/a.epub` }, { contentHash: 'hb' }])
    const files = source({ 'a.epub': { hash: 'ha' }, 'b.txt': { hash: 'hb' }, 'c.txt': { hash: 'hc' } })
    const res = await reconstructLibrary(lib, files)
    expect(res).toEqual({ added: 1, skipped: 2, failed: 0 })
    expect(lib.added.map((a) => a.fileName)).toEqual(['c.txt'])
    expect(files.hash).not.toHaveBeenCalledWith(`${DIR}/a.epub`)
  })

  it('does not add duplicates when two files share content', async () => {
    const lib = library()
    const res = await reconstructLibrary(lib, source({ 'a.txt': { hash: 'same' }, 'a (1).txt': { hash: 'same' } }))
    expect(res).toEqual({ added: 1, skipped: 1, failed: 0 })
  })

  it('is idempotent: a second run adds nothing and books/ files are not multiplied', async () => {
    const lib = library()
    const files = source({ 'a.epub': { hash: 'ha' }, 'b.txt': { hash: 'hb' } })
    await reconstructLibrary(lib, files)
    const again = await reconstructLibrary(lib, files)
    expect(again).toEqual({ added: 0, skipped: 2, failed: 0 })
    expect(lib.books).toHaveLength(2)
    expect(lib.added).toHaveLength(2)
  })

  it('counts unreadable or rejected files as failed (not as already known) and keeps going', async () => {
    const lib = library()
    const res = await reconstructLibrary(lib, source({ 'bad.epub': { hash: 'h1', failRead: true }, 'ok.txt': { hash: 'h2' } }))
    expect(res).toEqual({ added: 1, skipped: 0, failed: 1 })

    // A file the store rejects (e.g. a 0-byte EPUB) is a failure too.
    const rejecting = library()
    rejecting.addBookFromBuffer = vi.fn(async () => {
      throw new Error('invalid epub')
    })
    const res2 = await reconstructLibrary(rejecting, source({ 'empty.epub': { hash: 'h0' } }))
    expect(res2).toEqual({ added: 0, skipped: 0, failed: 1 })
  })
})
