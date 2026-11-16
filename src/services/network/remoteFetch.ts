import type { TrustedRemoteHostConsent } from '@/types'
import { validateRemoteUrlSyntax } from '@/services/network/ssrfValidator'
import { isTauriEnv, platformStorage } from '@/services/storage/platformAdapter'

const HOST_CONSENT_STORAGE_KEY = 'trusted_remote_host_consents_v1'
export const MAX_REMOTE_RESPONSE_BYTES = 256 * 1024 * 1024

export type RemoteFetchErrorCode =
  | 'BLOCKED_HIGH_RISK'
  | 'PRIVATE_NETWORK_CONFIRM_REQUIRED'
  | 'SELF_SIGNED_TLS_CONFIRM_REQUIRED'
  | 'INSECURE_AUTH_BLOCKED'
  | 'STATIC_WEB_AUTH_CONFIRM_REQUIRED'
  | 'NETWORK_ERROR'

export class RemoteFetchConsentError extends Error {
  readonly code: RemoteFetchErrorCode
  readonly origin: string

  constructor(code: RemoteFetchErrorCode, origin: string, message: string) {
    super(message)
    this.name = 'RemoteFetchConsentError'
    this.code = code
    this.origin = origin
  }
}

export interface RemoteFetchOptions {
  method?: string
  headers?: Record<string, string>
  body?: string | ArrayBuffer | Uint8Array
  allowPrivateNas?: boolean
  allowSelfSignedTls?: boolean
  allowDirectStaticAuth?: boolean
  timeoutMs?: number
  maxResponseBytes?: number
}

interface RustSafeRemoteFetchResponse {
  status: number
  statusText: string
  headers: Record<string, string>
  bodyBase64: string
  finalUrl: string
}

function getProxySessionToken(): string {
  if (typeof document === 'undefined') return ''
  return document.querySelector('meta[name="ev-proxy-token"]')?.getAttribute('content') || ''
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function base64ToUint8Array(base64: string): Uint8Array {
  if (!base64) return new Uint8Array(0)
  const binary = atob(base64)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i)
  }
  return out
}

export async function loadHostConsents(): Promise<TrustedRemoteHostConsent[]> {
  const list = await platformStorage.getItem<TrustedRemoteHostConsent[]>(
    HOST_CONSENT_STORAGE_KEY,
    []
  )
  return Array.isArray(list) ? list : []
}

export async function getHostConsent(targetUrl: string): Promise<TrustedRemoteHostConsent | null> {
  try {
    const hostKey = new URL(targetUrl).origin
    const list = await loadHostConsents()
    return list.find((item) => item.hostKey === hostKey) ?? null
  } catch {
    return null
  }
}

export async function grantHostConsent(
  targetUrl: string,
  patch: Partial<Pick<TrustedRemoteHostConsent, 'allowPrivateNetwork' | 'allowSelfSignedTls'>>
): Promise<TrustedRemoteHostConsent> {
  const hostKey = new URL(targetUrl).origin
  const list = await loadHostConsents()
  const idx = list.findIndex((item) => item.hostKey === hostKey)
  const prev = idx >= 0 ? list[idx] : null
  const updated: TrustedRemoteHostConsent = {
    hostKey,
    allowPrivateNetwork: patch.allowPrivateNetwork ?? prev?.allowPrivateNetwork ?? false,
    allowSelfSignedTls: patch.allowSelfSignedTls ?? prev?.allowSelfSignedTls ?? false,
    consentedAt: Date.now()
  }
  if (idx >= 0) {
    list[idx] = updated
  } else {
    list.unshift(updated)
  }
  await platformStorage.setItem(HOST_CONSENT_STORAGE_KEY, list.slice(0, 50))
  return updated
}

function encodeBodyToBase64(body?: string | ArrayBuffer | Uint8Array): string | undefined {
  if (body === undefined) return undefined
  if (typeof body === 'string') {
    return bytesToBase64(new TextEncoder().encode(body))
  }
  if (body instanceof Uint8Array) {
    return bytesToBase64(body)
  }
  return bytesToBase64(new Uint8Array(body))
}

function mapErrorPrefixToCode(message: string): RemoteFetchErrorCode | null {
  if (message.startsWith('BLOCKED_HIGH_RISK:')) return 'BLOCKED_HIGH_RISK'
  if (message.startsWith('PRIVATE_NETWORK_CONFIRM_REQUIRED:')) {
    return 'PRIVATE_NETWORK_CONFIRM_REQUIRED'
  }
  if (message.startsWith('SELF_SIGNED_TLS_CONFIRM_REQUIRED:')) {
    return 'SELF_SIGNED_TLS_CONFIRM_REQUIRED'
  }
  return null
}

/**
 * Unified Zero-Trust remote HTTP/HTTPS client routing Tauri to Rust `safe_remote_fetch`
 * and Browser builds through `/__remote_proxy` with host-level exception consent checks.
 */
export async function remoteFetch(url: string, options: RemoteFetchOptions = {}): Promise<Response> {
  const validated = validateRemoteUrlSyntax(url)
  const origin = validated.url.origin

  if (validated.classification === 'blocked-high-risk') {
    throw new RemoteFetchConsentError(
      'BLOCKED_HIGH_RISK',
      origin,
      '보안 정책에 의해 차단된 내부 네트워크 주소입니다.'
    )
  }

  const storedConsent = await getHostConsent(url)
  const allowPrivateNas = options.allowPrivateNas ?? Boolean(storedConsent?.allowPrivateNetwork)
  const allowSelfSignedTls = options.allowSelfSignedTls ?? Boolean(storedConsent?.allowSelfSignedTls)

  if (validated.classification === 'private-network' && !allowPrivateNas) {
    throw new RemoteFetchConsentError(
      'PRIVATE_NETWORK_CONFIRM_REQUIRED',
      origin,
      `사설 네트워크(${validated.hostname}) 접근에는 사용자 승인이 필요합니다.`
    )
  }

  const method = (options.method || 'GET').toUpperCase()
  const maxResponseBytes = Math.min(
    options.maxResponseBytes ?? MAX_REMOTE_RESPONSE_BYTES,
    MAX_REMOTE_RESPONSE_BYTES
  )

  if (isTauriEnv()) {
    const { invoke } = await import('@tauri-apps/api/core')
    try {
      const nativeRes = await invoke<RustSafeRemoteFetchResponse>('safe_remote_fetch', {
        request: {
          url: validated.url.toString(),
          method,
          headers: options.headers ?? {},
          bodyBase64: encodeBodyToBase64(options.body),
          allowPrivateNas,
          allowSelfSignedTls,
          timeoutMs: options.timeoutMs,
          maxResponseBytes
        }
      })
      const rawBytes = base64ToUint8Array(nativeRes.bodyBase64)
      const bodyBuffer = rawBytes.buffer.slice(
        rawBytes.byteOffset,
        rawBytes.byteOffset + rawBytes.byteLength
      ) as ArrayBuffer
      return new Response(bodyBuffer, {
        status: nativeRes.status,
        statusText: nativeRes.statusText,
        headers: new Headers(nativeRes.headers)
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const code = mapErrorPrefixToCode(msg)
      if (code) {
        throw new RemoteFetchConsentError(code, origin, msg.replace(/^[A-Z0-9_]+:\s*/, ''))
      }
      throw new Error(msg)
    }
  }

  const proxyHeaders: Record<string, string> = {
    'x-target-url': validated.url.toString(),
    'x-target-method': method,
    'x-max-response-bytes': String(maxResponseBytes)
  }
  if (typeof options.timeoutMs === 'number' && Number.isFinite(options.timeoutMs) && options.timeoutMs > 0) {
    proxyHeaders['x-request-timeout-ms'] = String(
      Math.min(120_000, Math.max(1_000, Math.floor(options.timeoutMs)))
    )
  }
  if (options.headers?.Authorization) {
    proxyHeaders['x-target-auth'] = options.headers.Authorization
  }
  if (options.headers?.Depth) {
    proxyHeaders['x-target-depth'] = options.headers.Depth
  }
  if (options.headers?.['Content-Type']) {
    proxyHeaders['Content-Type'] = options.headers['Content-Type']
  }

  const token = getProxySessionToken()
  if ((allowPrivateNas || allowSelfSignedTls) && token) {
    proxyHeaders['x-proxy-session-token'] = token
  }
  if (allowPrivateNas) {
    proxyHeaders['x-allow-private-nas'] = '1'
  }
  if (allowSelfSignedTls) {
    proxyHeaders['x-allow-insecure-tls'] = '1'
  }

  const proxyBody =
    typeof options.body === 'string'
      ? options.body
      : options.body instanceof Uint8Array
        ? options.body.buffer.slice(
            options.body.byteOffset,
            options.body.byteOffset + options.body.byteLength
          ) as ArrayBuffer
        : options.body

  const proxyRes = await fetch('/__remote_proxy', {
    method: proxyBody ? 'POST' : 'GET',
    headers: proxyHeaders,
    body: proxyBody
  })

  const isProxyHandled = proxyRes.headers.get('x-easyviewer-proxy') === '1'
  if (isProxyHandled) {
    if (proxyRes.status === 403 || proxyRes.status === 502) {
      let jsonErr: { code?: string; error?: string } | null = null
      const cloneText = await proxyRes.clone().text().catch(() => '')
      try {
        jsonErr = JSON.parse(cloneText) as { code?: string; error?: string }
      } catch {
        jsonErr = null
      }
      if (
        jsonErr?.code === 'PRIVATE_NETWORK_CONFIRM_REQUIRED' ||
        jsonErr?.code === 'SELF_SIGNED_TLS_CONFIRM_REQUIRED' ||
        jsonErr?.code === 'BLOCKED_HIGH_RISK'
      ) {
        throw new RemoteFetchConsentError(
          jsonErr.code,
          origin,
          jsonErr.error || '원격 서버 보안 확인이 필요합니다.'
        )
      }
      if (proxyRes.status === 502) {
        throw new Error(jsonErr?.error || cloneText || '원격 서버에 연결할 수 없습니다.')
      }
    }
    return proxyRes
  }

  // Static production web hosting without proxy middleware cannot bypass CORS/private IPs;
  // only allow public HTTPS/HTTP direct fetch when proxy endpoint itself is absent.
  if (validated.classification !== 'public') {
    throw new RemoteFetchConsentError(
      'PRIVATE_NETWORK_CONFIRM_REQUIRED',
      origin,
      '브라우저 환경에서는 보안 프록시 없이 사설 네트워크 주소에 직접 연결할 수 없습니다.'
    )
  }

  const hasAuthHeader = Boolean(
    options.headers &&
      Object.keys(options.headers).some((key) => key.toLowerCase() === 'authorization')
  )
  if (hasAuthHeader) {
    if (validated.url.protocol !== 'https:') {
      throw new RemoteFetchConsentError(
        'INSECURE_AUTH_BLOCKED',
        origin,
        '보안 프록시가 없는 정적 웹 환경에서는 평문(HTTP) 인증 요청이 무조건 차단됩니다.'
      )
    }
    if (!options.allowDirectStaticAuth) {
      throw new RemoteFetchConsentError(
        'STATIC_WEB_AUTH_CONFIRM_REQUIRED',
        origin,
        '보안 프록시가 없는 정적 웹 환경에서 HTTPS 인증 요청을 직접 보내려면 위험 고지 확인 및 명시적 동의가 필요합니다.'
      )
    }
  }

  return fetch(validated.url.toString(), {
    method,
    headers: options.headers,
    body: proxyBody
  })
}
