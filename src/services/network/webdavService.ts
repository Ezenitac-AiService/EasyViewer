import type { BookFormat, WebDavConnection, WebDavItem } from '@/types'
import { isTauriEnv, platformStorage } from '@/services/storage/platformAdapter'
import { platformCredential } from '@/services/platform/credentialService'
import { MAX_REMOTE_RESPONSE_BYTES, remoteFetch } from '@/services/network/remoteFetch'
import {
  extractFilenameFromUrl,
  inferBookFormat,
  type DownloadedFileResult,
  type DownloadProgress
} from '@/services/network/downloadService'

const WEBDAV_HISTORY_KEY = 'webdav_history'

function hasUnsafeControlOrTraversal(raw: string): boolean {
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\\]/.test(raw)) return true
  const segments = raw.split('/').filter(Boolean)
  return segments.some((seg) => seg === '..' || seg === '.')
}

function encodeBasicAuth(username: string, password?: string): string {
  if (!username && !password) return ''
  const raw = `${username}:${password || ''}`
  const bytes = new TextEncoder().encode(raw)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return `Basic ${btoa(binary)}`
}

export function buildWebDavTargetUrl(
  serverUrl: string,
  subPath: string,
  isDirectory = false
): string {
  const base = serverUrl.trim().replace(/\/+$/, '')
  const cleanSub = subPath.trim().replace(/^\/+|\/+$/g, '')

  let fullUrl = base
  if (cleanSub) {
    const segments = cleanSub.split('/').filter(Boolean)
    if (segments.some((seg) => seg === '..' || seg === '.')) {
      throw new Error('WebDAV 경로에 허용되지 않은 상위 이동(..) 세그먼트가 포함되어 있습니다.')
    }
    const encodedSegments = segments
      .map((seg) => encodeURIComponent(decodeURIComponent(seg)))
      .join('/')

    const lowerBase = base.toLowerCase()
    const lowerSub = `/${encodedSegments.toLowerCase()}`
    const lowerRawSub = `/${cleanSub.toLowerCase()}`
    if (!lowerBase.endsWith(lowerSub) && !lowerBase.endsWith(lowerRawSub)) {
      fullUrl = `${base}/${encodedSegments}`
    }
  }

  if (isDirectory && !fullUrl.endsWith('/')) {
    return `${fullUrl}/`
  }
  return fullUrl
}

/**
 * Loads saved WebDAV connection profiles (migrating v1 plaintext passwords transparently to v2).
 */
export async function loadWebDavHistory(): Promise<WebDavConnection[]> {
  const list = await platformStorage.getItem<WebDavConnection[]>(WEBDAV_HISTORY_KEY, [])
  const { sanitized, migratedCount } = await platformCredential.migrateLegacyPlaintext(list)
  if (migratedCount > 0) {
    await platformStorage.setItem(WEBDAV_HISTORY_KEY, sanitized)
  }
  return sanitized.sort((a, b) => b.lastConnectedAt - a.lastConnectedAt)
}

export interface SaveWebDavConnectionInput
  extends Omit<WebDavConnection, 'id' | 'lastConnectedAt' | 'password'> {
  id?: string
  password?: string
  webStorageConsent?: boolean
}

/**
 * Adds or updates a WebDAV connection profile without storing plaintext passwords in connection metadata.
 */
export async function saveWebDavConnection(
  input: SaveWebDavConnectionInput
): Promise<WebDavConnection[]> {
  const history = await loadWebDavHistory()
  const cleanUrl = input.url.trim().replace(/\/+$/, '')
  const cleanUser = input.username.trim()
  const cleanPath = input.initialPath?.trim() || '/'

  let defaultAlias = input.alias?.trim()
  if (!defaultAlias) {
    try {
      const parsed = new URL(cleanUrl)
      defaultAlias = cleanUser ? `${cleanUser}@${parsed.host}` : parsed.host
    } catch {
      defaultAlias = cleanUrl
    }
  }

  const existingIdx = history.findIndex(
    (item) =>
      (input.id && item.id === input.id) ||
      (item.url.replace(/\/+$/, '') === cleanUrl && item.username === cleanUser)
  )

  const id = existingIdx >= 0 ? history[existingIdx].id : input.id || `webdav-${Date.now()}`
  const rememberPassword = Boolean(input.rememberPassword)
  const credentialScope = rememberPassword
    ? isTauriEnv()
      ? 'native-secure'
      : 'web-acknowledged'
    : 'session'

  if (typeof input.password === 'string' && input.password.length > 0) {
    await platformCredential.setPassword(id, input.password, {
      remember: rememberPassword,
      webStorageConsent: input.webStorageConsent
    })
  } else if (!rememberPassword) {
    await platformCredential.removePassword(id)
  }

  const record: WebDavConnection = {
    id,
    alias: defaultAlias,
    url: cleanUrl,
    username: cleanUser,
    initialPath: cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`,
    lastConnectedAt: Date.now(),
    rememberPassword,
    credentialScope
  }

  if (existingIdx >= 0) {
    history.splice(existingIdx, 1)
  }
  history.unshift(record)

  const trimmed = history.slice(0, 20)
  await platformStorage.setItem(WEBDAV_HISTORY_KEY, trimmed)
  return trimmed
}

/**
 * Removes a WebDAV connection profile and its stored credential from recent history.
 */
export async function removeWebDavConnection(id: string): Promise<WebDavConnection[]> {
  const history = await loadWebDavHistory()
  const filtered = history.filter((item) => item.id !== id)
  await platformCredential.removePassword(id)
  await platformStorage.setItem(WEBDAV_HISTORY_KEY, filtered)
  return filtered
}

/**
 * Parses WebDAV PROPFIND XML safely, rejecting path traversal (`..`), control chars, and origin escapes.
 */
export function parseWebDavPropfindXml(
  xmlText: string,
  serverUrl: string,
  targetUrl: string
): WebDavItem[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlText, 'application/xml')

  const baseParsed = new URL(serverUrl.trim())
  const basePathPrefix = decodeURIComponent(baseParsed.pathname).replace(/\/+$/, '')
  const targetParsed = new URL(targetUrl)
  const currentFullDecodedPath =
    '/' + decodeURIComponent(targetParsed.pathname).replace(/^\/+|\/+$/g, '')

  const responses = Array.from(doc.getElementsByTagNameNS('*', 'response'))
  const items: WebDavItem[] = []

  for (const respNode of responses) {
    const hrefNode = respNode.getElementsByTagNameNS('*', 'href')[0]
    if (!hrefNode || !hrefNode.textContent) continue

    const rawHref = hrefNode.textContent.trim()
    if (hasUnsafeControlOrTraversal(rawHref)) continue

    let decodedPathname = rawHref
    try {
      if (rawHref.startsWith('http://') || rawHref.startsWith('https://')) {
        const hrefParsed = new URL(rawHref)
        if (hrefParsed.origin !== targetParsed.origin) continue
        decodedPathname = decodeURIComponent(hrefParsed.pathname)
      } else {
        decodedPathname = decodeURIComponent(rawHref)
      }
    } catch {
      continue
    }

    if (hasUnsafeControlOrTraversal(decodedPathname)) continue

    const normalizedItemFull = '/' + decodedPathname.replace(/^\/+|\/+$/g, '')
    if (
      basePathPrefix &&
      normalizedItemFull !== basePathPrefix &&
      !normalizedItemFull.toLowerCase().startsWith(`${basePathPrefix.toLowerCase()}/`)
    ) {
      continue
    }

    // Skip the current directory entry itself
    if (normalizedItemFull.toLowerCase() === currentFullDecodedPath.toLowerCase()) {
      continue
    }

    let relativePath = decodedPathname
    if (basePathPrefix && relativePath.toLowerCase().startsWith(basePathPrefix.toLowerCase())) {
      relativePath = relativePath.slice(basePathPrefix.length)
    }
    const cleanRel = '/' + relativePath.replace(/^\/+|\/+$/g, '')

    const resourceTypeNode = respNode.getElementsByTagNameNS('*', 'resourcetype')[0]
    const isDirectory = Boolean(
      resourceTypeNode && resourceTypeNode.getElementsByTagNameNS('*', 'collection').length > 0
    )

    const displayNameNode = respNode.getElementsByTagNameNS('*', 'displayname')[0]
    const rawDisplayName = displayNameNode?.textContent?.trim() || ''
    if (rawDisplayName && (hasUnsafeControlOrTraversal(rawDisplayName) || rawDisplayName.includes('/'))) {
      continue
    }

    const segments = cleanRel.split('/').filter(Boolean)
    const fallbackName = segments[segments.length - 1] || cleanRel
    const name = rawDisplayName || fallbackName
    if (!name || hasUnsafeControlOrTraversal(name)) continue

    const lengthNode = respNode.getElementsByTagNameNS('*', 'getcontentlength')[0]
    const size = lengthNode?.textContent ? parseInt(lengthNode.textContent.trim(), 10) || 0 : 0

    const modifiedNode = respNode.getElementsByTagNameNS('*', 'getlastmodified')[0]
    const lastModified = modifiedNode?.textContent?.trim()

    const lowerName = name.toLowerCase()
    let format: BookFormat | undefined
    if (!isDirectory) {
      if (lowerName.endsWith('.epub')) format = 'epub'
      else if (lowerName.endsWith('.txt')) format = 'txt'
      else continue
    }

    items.push({
      name,
      path: cleanRel,
      href: rawHref,
      isDirectory,
      size,
      lastModified,
      format
    })
  }

  return items.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
    return a.name.localeCompare(b.name, 'ko')
  })
}

/**
 * Lists folders and supported documents (.txt, .epub) from a WebDAV server directory via PROPFIND
 */
export async function listWebDavDirectory(
  serverUrl: string,
  subPath: string,
  username = '',
  password = ''
): Promise<WebDavItem[]> {
  const targetUrl = buildWebDavTargetUrl(serverUrl, subPath, true)
  const headers: Record<string, string> = {
    Depth: '1',
    'Content-Type': 'application/xml; charset=utf-8'
  }
  const auth = encodeBasicAuth(username, password)
  if (auth) {
    headers.Authorization = auth
  }

  const propfindBody = `<?xml version="1.0" encoding="utf-8" ?>
<D:propfind xmlns:D="DAV:">
  <D:prop>
    <D:displayname/>
    <D:getcontentlength/>
    <D:getlastmodified/>
    <D:resourcetype/>
  </D:prop>
</D:propfind>`

  const response = await remoteFetch(targetUrl, {
    method: 'PROPFIND',
    headers,
    body: propfindBody
  })

  if (response.status === 401 || response.status === 403) {
    throw new Error(`WebDAV 인증 실패 (HTTP ${response.status}): 아이디 또는 비밀번호를 확인해 주세요.`)
  }
  if (!response.ok && response.status !== 207) {
    throw new Error(`WebDAV 서버 응답 오류 (HTTP ${response.status})`)
  }

  const xmlText = await response.text()
  return parseWebDavPropfindXml(xmlText, serverUrl, targetUrl)
}

/**
 * Downloads a book file (.txt or .epub) from a WebDAV server with optional Basic Auth
 */
export async function downloadWebDavFile(
  serverUrl: string,
  filePath: string,
  username = '',
  password = '',
  onProgress?: (progress: DownloadProgress) => void
): Promise<DownloadedFileResult> {
  const targetUrl = buildWebDavTargetUrl(serverUrl, filePath, false)
  const headers: Record<string, string> = {}
  const auth = encodeBasicAuth(username, password)
  if (auth) {
    headers.Authorization = auth
  }

  const response = await remoteFetch(targetUrl, {
    method: 'GET',
    headers,
    maxResponseBytes: MAX_REMOTE_RESPONSE_BYTES
  })

  if (!response.ok) {
    throw new Error(`WebDAV 파일 다운로드 실패 (HTTP ${response.status})`)
  }

  const contentType = response.headers.get('content-type') || ''
  const contentLengthHeader = response.headers.get('content-length')
  const totalBytes = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0
  if (totalBytes > MAX_REMOTE_RESPONSE_BYTES) {
    throw new Error('원격 파일 크기가 허용 상한(256 MiB)을 초과했습니다.')
  }

  const buffer = await response.arrayBuffer()
  if (buffer.byteLength > MAX_REMOTE_RESPONSE_BYTES) {
    throw new Error('원격 파일 크기가 허용 상한(256 MiB)을 초과했습니다.')
  }

  onProgress?.({
    loaded: buffer.byteLength,
    total: totalBytes || buffer.byteLength,
    percent: 100
  })

  const format = inferBookFormat(targetUrl, contentType, buffer)
  const filename = extractFilenameFromUrl(targetUrl, format)

  return {
    buffer,
    filename,
    format,
    sourceUrl: targetUrl
  }
}
