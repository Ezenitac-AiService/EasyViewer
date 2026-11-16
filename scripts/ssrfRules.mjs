/**
 * Pure ECMAScript SSRF IP & URL classification rules shared between Node proxy guard and browser client.
 * MUST NOT import any `node:*` built-in modules.
 */

export function parseIpv4Part(part) {
  if (/^0x[0-9a-f]+$/i.test(part)) return Number.parseInt(part.slice(2), 16)
  if (/^0[0-7]+$/.test(part)) return Number.parseInt(part, 8)
  if (/^(0|[1-9]\d*)$/.test(part)) return Number.parseInt(part, 10)
  return null
}

export function parseIpv4Bytes(host) {
  if (host.includes('.')) {
    const parts = host.split('.')
    if (parts.length !== 4) return null
    const octets = []
    for (const part of parts) {
      const val = parseIpv4Part(part)
      if (val === null || !Number.isFinite(val) || val < 0 || val > 255) return null
      octets.push(val)
    }
    return [octets[0], octets[1], octets[2], octets[3]]
  }

  const intVal = parseIpv4Part(host)
  if (intVal !== null && Number.isFinite(intVal) && intVal >= 0 && intVal <= 0xffffffff) {
    return [
      (intVal >>> 24) & 0xff,
      (intVal >>> 16) & 0xff,
      (intVal >>> 8) & 0xff,
      intVal & 0xff
    ]
  }
  return null
}

export function classifyIpv4Bytes([a, b]) {
  if (a === 0 || a === 127 || (a === 169 && b === 254) || a >= 224) {
    return 'blocked-high-risk'
  }
  if (
    a === 10 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  ) {
    return 'private-network'
  }
  return 'public'
}

export function expandIpv6Groups(raw) {
  let addr = raw.replace(/^\[|\]$/g, '').split('%')[0].toLowerCase()
  if (!addr.includes(':')) return null

  const lastColon = addr.lastIndexOf(':')
  const tail = addr.slice(lastColon + 1)
  let embeddedV4Groups = null
  if (tail.includes('.')) {
    const v4 = parseIpv4Bytes(tail)
    if (!v4) return null
    embeddedV4Groups = [(v4[0] << 8) | v4[1], (v4[2] << 8) | v4[3]]
    addr = addr.slice(0, lastColon)
    if (addr.endsWith(':') && !addr.endsWith('::')) {
      addr = `${addr}0`
    } else if (!addr.includes(':')) {
      addr = addr === '' ? '::' : `${addr}:`
    }
  }

  const parts = addr.split('::')
  if (parts.length > 2) return null

  const parseSegmentList = (seg) => {
    if (!seg) return []
    const items = seg.split(':')
    const out = []
    for (const item of items) {
      if (!/^[0-9a-f]{1,4}$/.test(item)) return null
      out.push(Number.parseInt(item, 16))
    }
    return out
  }

  const head = parseSegmentList(parts[0])
  if (!head) return null
  const tailGroups = parts.length === 2 ? parseSegmentList(parts[1]) : []
  if (!tailGroups) return null

  const totalExplicit = head.length + tailGroups.length + (embeddedV4Groups ? 2 : 0)
  if (parts.length === 1 && totalExplicit !== 8) return null
  if (parts.length === 2 && totalExplicit > 8) return null

  const zeros = new Array(8 - totalExplicit).fill(0)
  return [...head, ...zeros, ...tailGroups, ...(embeddedV4Groups || [])]
}

/**
 * Classifies an IPv4 or IPv6 literal according to Zero-Trust SSRF rules.
 */
export function classifyIpAddress(rawIp) {
  const cleaned = String(rawIp || '').trim().replace(/^\[|\]$/g, '').split('%')[0]
  if (!cleaned) return 'blocked-high-risk'

  const v4 = parseIpv4Bytes(cleaned)
  if (v4) return classifyIpv4Bytes(v4)

  const v6 = expandIpv6Groups(cleaned)
  if (v6) {
    const isMapped =
      v6[0] === 0 && v6[1] === 0 && v6[2] === 0 && v6[3] === 0 && v6[4] === 0 && v6[5] === 0xffff
    if (isMapped) {
      const mappedBytes = [
        (v6[6] >>> 8) & 0xff,
        v6[6] & 0xff,
        (v6[7] >>> 8) & 0xff,
        v6[7] & 0xff
      ]
      return classifyIpv4Bytes(mappedBytes)
    }

    const allZero = v6.every((g) => g === 0)
    const isLoopback = v6.slice(0, 7).every((g) => g === 0) && v6[7] === 1
    const isLinkLocal = (v6[0] & 0xffc0) === 0xfe80
    const isMulticast = (v6[0] & 0xff00) === 0xff00
    if (allZero || isLoopback || isLinkLocal || isMulticast) {
      return 'blocked-high-risk'
    }

    if ((v6[0] & 0xfe00) === 0xfc00) {
      return 'private-network'
    }
    return 'public'
  }

  return 'public'
}

/**
 * Validates HTTP(S) URL syntax and classifies explicit host literals / local domains.
 */
export function validateRemoteUrlSyntax(rawUrl) {
  const trimmed = String(rawUrl || '').trim()
  if (!trimmed) {
    throw new Error('원격 URL이 비어 있습니다.')
  }

  let parsed
  try {
    parsed = new URL(trimmed)
  } catch {
    throw new Error('올바른 HTTP/HTTPS URL 형식이 아닙니다.')
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`허용되지 않은 프로토콜입니다: ${parsed.protocol}`)
  }

  if (parsed.username || parsed.password) {
    throw new Error('URL에 내장된 자격 증명은 보안상 허용되지 않습니다.')
  }

  const normalizedHost = parsed.hostname.replace(/\.$/, '').toLowerCase()
  if (!normalizedHost) {
    throw new Error('원격 URL에 유효한 호스트명이 없습니다.')
  }

  const port = parsed.port
    ? Number.parseInt(parsed.port, 10)
    : parsed.protocol === 'https:'
      ? 443
      : 80

  let classification = 'public'
  if (normalizedHost === 'localhost' || normalizedHost.endsWith('.localhost')) {
    classification = 'blocked-high-risk'
  } else if (
    parseIpv4Bytes(normalizedHost) !== null ||
    normalizedHost.startsWith('[') ||
    normalizedHost.includes(':')
  ) {
    classification = classifyIpAddress(normalizedHost)
  } else if (normalizedHost.endsWith('.local')) {
    classification = 'private-network'
  }

  return {
    url: parsed,
    hostname: normalizedHost,
    port,
    classification
  }
}
