import crypto from 'node:crypto'
import dns from 'node:dns'
import {
  classifyIpAddress,
  parseIpv4Bytes,
  validateRemoteUrlSyntax as validateSharedUrlSyntax
} from './ssrfRules.mjs'

export { classifyIpAddress }

export function makeProxyError(message, statusCode, code) {
  const err = new Error(message)
  err.statusCode = statusCode
  err.code = code
  return err
}

export function validateRemoteUrlSyntax(rawUrl) {
  let result
  try {
    result = validateSharedUrlSyntax(rawUrl)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('허용되지 않은 프로토콜')) {
      throw makeProxyError(msg, 403, 'BLOCKED_SCHEME')
    }
    throw makeProxyError(msg, 400, 'INVALID_URL')
  }
  return {
    url: result.url,
    hostname: result.hostname,
    classification: result.classification
  }
}

/**
 * Resolves DNS records once, classifies every returned IP, and binds a pinned lookup callback for http(s).request.
 */
export async function resolveAndValidateHost(
  urlStr,
  { allowPrivateNetwork = false, dnsLookup, testDnsOverride } = {}
) {
  const validated = validateRemoteUrlSyntax(urlStr)
  const { hostname, url, classification: syntaxClass } = validated

  if (syntaxClass === 'blocked-high-risk') {
    throw makeProxyError('보안 정책에 의해 차단된 내부 네트워크 주소입니다.', 403, 'BLOCKED_HIGH_RISK')
  }

  const isIpLiteral = Boolean(
    parseIpv4Bytes(hostname) || hostname.startsWith('[') || hostname.includes(':')
  )

  let records
  if (isIpLiteral) {
    const cleanLiteral = hostname.replace(/^\[|\]$/g, '')
    records = [{ address: cleanLiteral, family: cleanLiteral.includes(':') ? 6 : 4 }]
  } else if (typeof testDnsOverride === 'function') {
    records = await testDnsOverride(hostname)
  } else if (typeof dnsLookup === 'function') {
    records = await dnsLookup(hostname, { all: true })
  } else {
    records = await dns.promises.lookup(hostname, { all: true })
  }

  if (!Array.isArray(records) || records.length === 0) {
    throw makeProxyError('원격 호스트의 IP 주소를 해석할 수 없습니다.', 502, 'DNS_RESOLUTION_FAILED')
  }

  let overallClass = syntaxClass
  for (const record of records) {
    const recordClass = record.simulatedClassification || classifyIpAddress(record.address)
    if (recordClass === 'blocked-high-risk') {
      throw makeProxyError('보안 정책에 의해 차단된 내부 네트워크 주소입니다.', 403, 'BLOCKED_HIGH_RISK')
    }
    if (recordClass === 'private-network') {
      overallClass = 'private-network'
    }
  }

  if (overallClass === 'private-network' && !allowPrivateNetwork) {
    throw makeProxyError(
      '사설 네트워크(NAS) 접근에는 사용자 승인이 필요합니다.',
      403,
      'PRIVATE_NETWORK_CONFIRM_REQUIRED'
    )
  }

  const pinned = records[0]
  const pinnedLookup = (_hostname, optionsOrCb, maybeCb) => {
    const cb = typeof optionsOrCb === 'function' ? optionsOrCb : maybeCb
    const opts = typeof optionsOrCb === 'object' && optionsOrCb !== null ? optionsOrCb : {}
    if (opts.all) {
      cb(null, [{ address: pinned.address, family: pinned.family }])
    } else {
      cb(null, pinned.address, pinned.family)
    }
  }

  return {
    url,
    hostname,
    address: pinned.address,
    family: pinned.family,
    classification: overallClass,
    pinnedLookup
  }
}

export function timingSafeTokenMatch(expected, actual) {
  if (!expected || typeof actual !== 'string' || !actual) return false
  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(actual, 'utf8')
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

export function validateSameOrigin(req) {
  const hostHeader = req.headers.host
  if (!hostHeader) return false
  const fetchSite = req.headers['sec-fetch-site']
  if (typeof fetchSite === 'string' && fetchSite !== 'same-origin') return false

  const originHeader = req.headers.origin
  const refererHeader = req.headers.referer
  if (typeof originHeader === 'string' && originHeader) {
    try {
      return new URL(originHeader).host === hostHeader
    } catch {
      return false
    }
  }
  if (typeof refererHeader === 'string' && refererHeader) {
    try {
      return new URL(refererHeader).host === hostHeader
    } catch {
      return false
    }
  }
  return false
}

export function collectRequestBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let received = 0
    let finished = false
    req.on('data', (chunk) => {
      if (finished) return
      received += chunk.length
      if (received > maxBytes) {
        finished = true
        req.resume()
        reject(makeProxyError('요청 본문이 허용 상한(1 MiB)을 초과했습니다.', 413, 'PAYLOAD_TOO_LARGE'))
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (!finished) {
        finished = true
        resolve(Buffer.concat(chunks))
      }
    })
    req.on('error', (err) => {
      if (!finished) {
        finished = true
        reject(err)
      }
    })
  })
}
