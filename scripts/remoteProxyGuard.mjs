import http from 'node:http'
import https from 'node:https'
import {
  classifyIpAddress,
  collectRequestBody,
  resolveAndValidateHost,
  timingSafeTokenMatch,
  validateRemoteUrlSyntax,
  validateSameOrigin
} from './remoteProxyDns.mjs'

export { classifyIpAddress, resolveAndValidateHost, validateRemoteUrlSyntax }

const ALLOWED_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'PROPFIND', 'POST'])
const DEFAULT_MAX_REQUEST_BODY_BYTES = 1024 * 1024
const HARD_MAX_RESPONSE_BODY_BYTES = 256 * 1024 * 1024
const DEFAULT_MAX_RESPONSE_BODY_BYTES = HARD_MAX_RESPONSE_BODY_BYTES
const DEFAULT_TIMEOUT_MS = 30_000
const MIN_CLIENT_TIMEOUT_MS = 1_000
const MAX_CLIENT_TIMEOUT_MS = 120_000
const MAX_REDIRECTS = 5
const PROXY_MARKER_HEADER = 'X-EasyViewer-Proxy'

function clampMaxResponseBytes(rawHeader, serverCap) {
  const ceiling = Math.min(Math.max(1, Number(serverCap) || HARD_MAX_RESPONSE_BODY_BYTES), HARD_MAX_RESPONSE_BODY_BYTES)
  const parsed = Number(rawHeader)
  if (typeof rawHeader === 'string' && rawHeader.trim() !== '' && Number.isFinite(parsed) && parsed > 0) {
    return Math.min(Math.floor(parsed), ceiling)
  }
  return ceiling
}

function clampTimeoutMs(rawHeader, defaultMs) {
  const parsed = Number(rawHeader)
  if (typeof rawHeader === 'string' && rawHeader.trim() !== '' && Number.isFinite(parsed) && parsed > 0) {
    return Math.min(MAX_CLIENT_TIMEOUT_MS, Math.max(MIN_CLIENT_TIMEOUT_MS, Math.floor(parsed)))
  }
  return defaultMs
}

function sendJsonError(res, statusCode, message, code) {
  if (res.headersSent) {
    res.destroy()
    return
  }
  res.statusCode = statusCode
  res.setHeader(PROXY_MARKER_HEADER, '1')
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify({ error: message, code }))
}

/**
 * Creates a fail-closed, SSRF/DNS-pinning remote proxy handler for Vite Dev & Preview.
 */
export function createRemoteProxyHandler({
  sessionToken = '',
  maxRequestBodyBytes = DEFAULT_MAX_REQUEST_BODY_BYTES,
  maxResponseBodyBytes = DEFAULT_MAX_RESPONSE_BODY_BYTES,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  testDnsOverride
} = {}) {
  return async (req, res, next) => {
    if (!req.url || !req.url.startsWith('/__remote_proxy')) {
      next()
      return
    }

    res.setHeader(PROXY_MARKER_HEADER, '1')

    if (!validateSameOrigin(req)) {
      sendJsonError(res, 403, '허용되지 않은 교차 출처 요청입니다.', 'FORBIDDEN_ORIGIN')
      return
    }

    const reqMethod = String(req.method || 'GET').toUpperCase()
    const overrideMethod =
      typeof req.headers['x-target-method'] === 'string' && req.headers['x-target-method']
        ? req.headers['x-target-method'].toUpperCase()
        : reqMethod

    if (!ALLOWED_METHODS.has(reqMethod) || !ALLOWED_METHODS.has(overrideMethod)) {
      sendJsonError(res, 405, `허용되지 않은 HTTP 메서드입니다: ${overrideMethod}`, 'METHOD_NOT_ALLOWED')
      return
    }

    const rawTargetUrl = req.headers['x-target-url']
    if (typeof rawTargetUrl !== 'string' || !rawTargetUrl.trim()) {
      sendJsonError(res, 400, '대상 URL(x-target-url)이 필요합니다.', 'INVALID_URL')
      return
    }

    const wantPrivate = req.headers['x-allow-private-nas'] === '1'
    const wantInsecureTls = req.headers['x-allow-insecure-tls'] === '1'
    const clientToken = req.headers['x-proxy-session-token']
    const hasValidToken = timingSafeTokenMatch(sessionToken, typeof clientToken === 'string' ? clientToken : '')

    if ((wantPrivate || wantInsecureTls) && !hasValidToken) {
      sendJsonError(res, 403, '사설망 또는 예외 TLS 요청에는 유효한 세션 토큰이 필요합니다.', 'INVALID_SESSION_TOKEN')
      return
    }

    const effectiveMaxResponseBytes = clampMaxResponseBytes(req.headers['x-max-response-bytes'], maxResponseBodyBytes)
    const effectiveTimeoutMs = clampTimeoutMs(req.headers['x-request-timeout-ms'], timeoutMs)
    const deadlineAt = Date.now() + effectiveTimeoutMs

    let finalized = false
    let activeUpstreamReq = null
    let activeUpstreamRes = null
    let deadlineTimer = null

    const cleanup = () => {
      if (deadlineTimer) {
        clearTimeout(deadlineTimer)
        deadlineTimer = null
      }
    }

    const failAndFinish = (statusCode, message, code) => {
      if (finalized) return
      finalized = true
      cleanup()
      if (activeUpstreamRes && !activeUpstreamRes.destroyed) activeUpstreamRes.destroy()
      if (activeUpstreamReq && !activeUpstreamReq.destroyed) activeUpstreamReq.destroy()
      sendJsonError(res, statusCode, message, code)
    }

    deadlineTimer = setTimeout(() => {
      failAndFinish(504, '원격 요청 전체 처리 시간이 초과되었습니다.', 'TIMEOUT')
    }, effectiveTimeoutMs)

    res.on('close', () => {
      finalized = true
      cleanup()
      if (activeUpstreamRes && !activeUpstreamRes.destroyed) activeUpstreamRes.destroy()
      if (activeUpstreamReq && !activeUpstreamReq.destroyed) activeUpstreamReq.destroy()
    })

    let requestBody
    try {
      requestBody = await collectRequestBody(req, maxRequestBodyBytes)
    } catch (err) {
      failAndFinish(err.statusCode || 413, err.message, err.code || 'PAYLOAD_TOO_LARGE')
      return
    }
    if (finalized) return

    const baseHeaders = {}
    if (typeof req.headers['x-target-auth'] === 'string' && req.headers['x-target-auth']) {
      baseHeaders.Authorization = req.headers['x-target-auth']
    }
    if (typeof req.headers['x-target-depth'] === 'string' && req.headers['x-target-depth']) {
      baseHeaders.Depth = req.headers['x-target-depth']
    }
    if (typeof req.headers['content-type'] === 'string' && req.headers['content-type']) {
      baseHeaders['Content-Type'] = req.headers['content-type']
    }

    let initialOrigin = ''
    try {
      initialOrigin = new URL(rawTargetUrl).origin
    } catch {
      failAndFinish(400, '유효하지 않은 원격 URL입니다.', 'INVALID_URL')
      return
    }

    const forward = async (currentUrlStr, method, redirectCount = 0) => {
      if (finalized) return
      if (redirectCount > MAX_REDIRECTS) {
        failAndFinish(508, '리다이렉트 횟수(5회)를 초과했습니다.', 'TOO_MANY_REDIRECTS')
        return
      }

      const remainingMs = deadlineAt - Date.now()
      if (remainingMs <= 0) {
        failAndFinish(504, '원격 요청 전체 처리 시간이 초과되었습니다.', 'TIMEOUT')
        return
      }

      let resolved
      try {
        resolved = await resolveAndValidateHost(currentUrlStr, {
          allowPrivateNetwork: wantPrivate && hasValidToken,
          testDnsOverride
        })
      } catch (err) {
        failAndFinish(err.statusCode || 403, err.message, err.code || 'BLOCKED_HIGH_RISK')
        return
      }
      if (finalized) return

      const parsedUrl = resolved.url
      const isHttps = parsedUrl.protocol === 'https:'
      const transport = isHttps ? https : http

      const outHeaders = {
        Host: parsedUrl.host,
        'User-Agent': 'Pagelight-WebDAV/1.0',
        Accept: '*/*',
        ...baseHeaders
      }
      if (parsedUrl.origin !== initialOrigin) {
        delete outHeaders.Authorization
        delete outHeaders.Cookie
      }
      if (requestBody.length > 0 && method !== 'GET' && method !== 'HEAD') {
        outHeaders['Content-Length'] = requestBody.length
      } else {
        delete outHeaders['Content-Length']
      }

      const reqOpts = {
        protocol: parsedUrl.protocol,
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: `${parsedUrl.pathname}${parsedUrl.search}`,
        method,
        headers: outHeaders,
        lookup: resolved.pinnedLookup,
        timeout: Math.max(1, remainingMs)
      }
      if (isHttps) {
        reqOpts.rejectUnauthorized = !(wantInsecureTls && hasValidToken)
        reqOpts.servername = parsedUrl.hostname
      }

      const proxyReq = transport.request(reqOpts, (proxyRes) => {
        activeUpstreamRes = proxyRes
        if (finalized) {
          proxyRes.destroy()
          return
        }
        const statusCode = proxyRes.statusCode || 500
        const locationHeader = proxyRes.headers.location
        if ([301, 302, 303, 307, 308].includes(statusCode) && typeof locationHeader === 'string' && locationHeader) {
          let nextUrl
          try {
            nextUrl = new URL(locationHeader, parsedUrl).toString()
          } catch {
            proxyRes.resume()
            failAndFinish(502, '잘못된 리다이렉트 Location입니다.', 'INVALID_REDIRECT')
            return
          }
          const nextMethod = statusCode === 303 ? 'GET' : method
          proxyRes.resume()
          void forward(nextUrl, nextMethod, redirectCount + 1)
          return
        }

        const declaredLength = Number(proxyRes.headers['content-length'] || '0')
        if (declaredLength > effectiveMaxResponseBytes) {
          proxyRes.destroy()
          failAndFinish(413, '원격 응답 크기가 허용 상한을 초과했습니다.', 'RESPONSE_TOO_LARGE')
          return
        }

        const chunks = []
        let totalReceived = 0
        proxyRes.on('data', (chunk) => {
          if (finalized) return
          totalReceived += chunk.length
          if (totalReceived > effectiveMaxResponseBytes) {
            failAndFinish(413, '원격 응답 크기가 허용 상한을 초과했습니다.', 'RESPONSE_TOO_LARGE')
            return
          }
          chunks.push(chunk)
        })
        proxyRes.on('end', () => {
          if (finalized) return
          finalized = true
          cleanup()
          res.statusCode = statusCode
          res.setHeader(PROXY_MARKER_HEADER, '1')
          if (proxyRes.headers['content-type']) {
            res.setHeader('Content-Type', proxyRes.headers['content-type'])
          }
          const payload = Buffer.concat(chunks)
          res.setHeader('Content-Length', payload.length)
          res.end(payload)
        })
        proxyRes.on('error', (err) => {
          if (!finalized) {
            failAndFinish(502, `원격 응답 수신 오류: ${err.message}`, 'REMOTE_STREAM_FAILED')
          }
        })
      })
      activeUpstreamReq = proxyReq

      proxyReq.on('timeout', () => {
        if (!finalized) {
          failAndFinish(504, '원격 요청 시간이 초과되었습니다.', 'TIMEOUT')
        }
      })

      proxyReq.on('error', (err) => {
        if (finalized) return
        const msg = String(err?.message || '')
        const lower = msg.toLowerCase()
        if (
          isHttps &&
          !(wantInsecureTls && hasValidToken) &&
          (lower.includes('certificate') ||
            lower.includes('self signed') ||
            lower.includes('self-signed') ||
            lower.includes('unable to verify') ||
            String(err?.code || '').includes('CERT'))
        ) {
          failAndFinish(502, '자체 서명 또는 신뢰할 수 없는 TLS 인증서입니다.', 'SELF_SIGNED_TLS_CONFIRM_REQUIRED')
          return
        }
        failAndFinish(err.statusCode || 502, `원격 서버 연결 실패: ${msg}`, err.code || 'REMOTE_FETCH_FAILED')
      })

      if (requestBody.length > 0 && method !== 'GET' && method !== 'HEAD') {
        proxyReq.write(requestBody)
      }
      proxyReq.end()
    }

    await forward(rawTargetUrl, overrideMethod, 0)
  }
}
