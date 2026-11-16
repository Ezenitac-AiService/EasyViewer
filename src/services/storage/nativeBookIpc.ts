import type { ExtractedEpubMetadata } from '@/engines/types'

interface RustExtractedEpubMetadata {
  title?: string | null
  author?: string | null
  coverBytes?: number[] | null
  coverMime?: string | null
}

export function decodeIpcBinary(raw: ArrayBuffer | ArrayBufferView | number[]): ArrayBuffer {
  if (
    raw instanceof ArrayBuffer ||
    Object.prototype.toString.call(raw) === '[object ArrayBuffer]'
  ) {
    return raw as ArrayBuffer
  }
  const u8 =
    raw instanceof Uint8Array
      ? raw
      : ArrayBuffer.isView(raw)
        ? new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength)
        : Uint8Array.from(raw)
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer
}

export async function readValidatedBookFileIpc(
  path: string,
  maxBytes?: number
): Promise<ArrayBuffer> {
  const { invoke } = await import('@tauri-apps/api/core')
  const raw = await invoke<ArrayBuffer | ArrayBufferView | number[]>('read_validated_book_file', {
    path,
    maxBytes
  })
  return decodeIpcBinary(raw)
}

export async function hashValidatedBookFileIpc(path: string): Promise<string> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<string>('hash_validated_book_file', { path })
}

export async function importValidatedBookToStorageIpc(
  sourcePath: string,
  destDir: string,
  targetFileName: string
): Promise<{ storedPath: string; fileSize: number; contentHash: string }> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<{ storedPath: string; fileSize: number; contentHash: string }>(
    'import_validated_book_to_storage',
    { sourcePath, destDir, targetFileName }
  )
}

export async function extractEpubMetadataFromPathIpc(
  path: string
): Promise<ExtractedEpubMetadata> {
  const { invoke } = await import('@tauri-apps/api/core')
  const raw = await invoke<RustExtractedEpubMetadata>('extract_epub_metadata_from_path', { path })
  const coverBlob =
    Array.isArray(raw.coverBytes) && raw.coverBytes.length > 0
      ? new Blob([new Uint8Array(raw.coverBytes)], { type: raw.coverMime || 'image/jpeg' })
      : null
  return {
    title: raw.title || undefined,
    author: raw.author || undefined,
    coverBlob,
    coverMime: raw.coverMime || undefined
  }
}
