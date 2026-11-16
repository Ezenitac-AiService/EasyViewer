import type { BookFormat, DownloadProgressEvent, NativeDownloadResult } from '@/types'
import type { ExtractedEpubMetadata } from '@/engines/types'
import { MAX_REMOTE_RESPONSE_BYTES, remoteFetch } from '@/services/network/remoteFetch'
import { extractEpubMetadataFromPathIpc } from '@/services/storage/nativeBookIpc'

export interface DownloadProgress {
  loaded: number
  total: number
  percent: number
}

export interface DownloadedFileResult {
  buffer: ArrayBuffer
  filename: string
  format: BookFormat
  sourceUrl: string
}

export interface NativeStreamDownloadOptions {
  url: string
  destDir?: string
  allowPrivateNas?: boolean
  allowSelfSignedTls?: boolean
  onProgress?: (event: DownloadProgressEvent) => void
}

export async function downloadBookStreamNative(
  options: NativeStreamDownloadOptions
): Promise<NativeDownloadResult & { metadata?: ExtractedEpubMetadata }> {
  const { Channel, invoke } = await import('@tauri-apps/api/core')
  const onProgressChannel = new Channel<DownloadProgressEvent>()
  onProgressChannel.onmessage = (ev) => {
    options.onProgress?.(ev)
  }

  const res = await invoke<NativeDownloadResult>('safe_download_to_storage', {
    request: {
      url: options.url,
      destDir: options.destDir,
      allowPrivateNas: options.allowPrivateNas,
      allowSelfSignedTls: options.allowSelfSignedTls
    },
    onProgress: onProgressChannel
  })

  let metadata: ExtractedEpubMetadata | undefined
  if (res.detectedFormat === 'epub') {
    metadata = await extractEpubMetadataFromPathIpc(res.storedPath).catch(() => undefined)
  }
  return { ...res, metadata }
}

export function inferBookFormat(url: string, contentType: string, buffer: ArrayBuffer): BookFormat {
  const cleanUrl = url.split('?')[0].toLowerCase()
  if (cleanUrl.endsWith('.epub')) return 'epub'
  if (cleanUrl.endsWith('.txt')) return 'txt'
  if (contentType.includes('application/epub+zip')) return 'epub'
  const bytes = new Uint8Array(buffer)
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    return 'epub'
  }
  return 'txt'
}

export function extractFilenameFromUrl(url: string, format: BookFormat): string {
  try {
    const parsed = new URL(url)
    const segments = parsed.pathname.split('/').filter(Boolean)
    const last = segments[segments.length - 1]
    if (last) {
      return decodeURIComponent(last).replace(/\.(epub|txt)$/i, '')
    }
  } catch {
    // Fallback
  }
  return `네트워크 문서 (${format.toUpperCase()})`
}

export async function downloadRemoteBook(
  url: string,
  onProgress?: (progress: DownloadProgress) => void
): Promise<DownloadedFileResult> {
  const trimmedUrl = url.trim()
  if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
    throw new Error('유효한 HTTP/HTTPS URL을 입력해 주세요.')
  }

  const response = await remoteFetch(trimmedUrl, {
    method: 'GET',
    maxResponseBytes: MAX_REMOTE_RESPONSE_BYTES
  })
  if (!response.ok) {
    throw new Error(`파일 다운로드 실패 (HTTP ${response.status})`)
  }

  const contentType = response.headers.get('content-type') || ''
  const contentLengthHeader = response.headers.get('content-length')
  const totalBytes = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0
  if (totalBytes > MAX_REMOTE_RESPONSE_BYTES) {
    throw new Error('원격 파일 크기가 허용 상한(256 MiB)을 초과했습니다.')
  }

  if (response.body && typeof response.body.getReader === 'function') {
    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let loadedBytes = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) {
        loadedBytes += value.byteLength
        if (loadedBytes > MAX_REMOTE_RESPONSE_BYTES) {
          await reader.cancel().catch(() => {})
          throw new Error('원격 파일 크기가 허용 상한(256 MiB)을 초과했습니다.')
        }
        chunks.push(value)
        const percent = totalBytes > 0 ? Math.min(99, Math.round((loadedBytes / totalBytes) * 100)) : 50
        onProgress?.({ loaded: loadedBytes, total: totalBytes, percent })
      }
    }
    const merged = new Uint8Array(loadedBytes)
    let offset = 0
    for (const chunk of chunks) {
      merged.set(chunk, offset)
      offset += chunk.byteLength
    }
    onProgress?.({ loaded: loadedBytes, total: loadedBytes, percent: 100 })
    const buffer = merged.buffer
    const format = inferBookFormat(trimmedUrl, contentType, buffer)
    return { buffer, filename: extractFilenameFromUrl(trimmedUrl, format), format, sourceUrl: trimmedUrl }
  }

  const buffer = await response.arrayBuffer()
  onProgress?.({ loaded: buffer.byteLength, total: buffer.byteLength, percent: 100 })
  const format = inferBookFormat(trimmedUrl, contentType, buffer)
  return { buffer, filename: extractFilenameFromUrl(trimmedUrl, format), format, sourceUrl: trimmedUrl }
}
