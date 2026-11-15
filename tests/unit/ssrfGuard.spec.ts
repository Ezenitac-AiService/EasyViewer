import { describe, expect, it } from 'vitest'
import {
  classifyIpAddress as classifyClientIp,
  validateRemoteUrlSyntax
} from '@/services/network/ssrfValidator'
import {
  classifyIpAddress as classifyProxyIp,
  resolveAndValidateHost
} from '../../scripts/remoteProxyGuard.mjs'

describe('SSRF validator & Node DNS Pinning (US3 - TDD)', () => {
  it('always blocks high-risk loopback, unspecified, and link-local / cloud metadata IPs', () => {
    expect(classifyClientIp('127.0.0.1')).toBe('blocked-high-risk')
    expect(classifyClientIp('127.255.0.1')).toBe('blocked-high-risk')
    expect(classifyClientIp('0.0.0.0')).toBe('blocked-high-risk')
    expect(classifyClientIp('169.254.169.254')).toBe('blocked-high-risk')
    expect(classifyClientIp('::1')).toBe('blocked-high-risk')
    expect(classifyClientIp('::')).toBe('blocked-high-risk')
    expect(classifyClientIp('fe80::1')).toBe('blocked-high-risk')
    expect(classifyClientIp('::ffff:127.0.0.1')).toBe('blocked-high-risk')
    expect(classifyClientIp('::ffff:169.254.169.254')).toBe('blocked-high-risk')
    expect(classifyClientIp('::ffff:7f00:1')).toBe('blocked-high-risk')
  })

  it('classifies RFC 1918, ULA IPv6, and .local as private-network requiring explicit consent', () => {
    expect(classifyClientIp('10.0.0.5')).toBe('private-network')
    expect(classifyClientIp('172.16.4.12')).toBe('private-network')
    expect(classifyClientIp('192.168.1.100')).toBe('private-network')
    expect(classifyClientIp('fc00::1')).toBe('private-network')
    expect(classifyClientIp('fd12:3456:789a::1')).toBe('private-network')
    expect(classifyClientIp('::ffff:192.168.1.50')).toBe('private-network')
    expect(classifyClientIp('93.184.216.34')).toBe('public')

    expect(validateRemoteUrlSyntax('http://synology.local:5005/books').classification).toBe('private-network')
    expect(validateRemoteUrlSyntax('http://0x7f000001/latest/meta-data').classification).toBe('blocked-high-risk')
    expect(validateRemoteUrlSyntax('http://2852039166/latest/meta-data').classification).toBe('blocked-high-risk')
    expect(() => validateRemoteUrlSyntax('file:///etc/passwd')).toThrow()
  })

  it('maintains 3-way equivalence with Proxy and Rust SSRF vectors across CIDR, Zone ID, octal/int/hex, and mapped IPv6 (T064)', () => {
    const vectors: Array<[string, 'blocked-high-risk' | 'private-network' | 'public']> = [
      ['127.0.0.1', 'blocked-high-risk'],
      ['0.0.0.0', 'blocked-high-risk'],
      ['169.254.169.254', 'blocked-high-risk'],
      ['240.0.0.1', 'blocked-high-risk'],
      ['::1', 'blocked-high-risk'],
      ['fe80::1%en0', 'blocked-high-risk'],
      ['[fe80::1%en0]', 'blocked-high-risk'],
      ['0177.0.0.1', 'blocked-high-risk'],
      ['2130706433', 'blocked-high-risk'],
      ['0x7f000001', 'blocked-high-risk'],
      ['::ffff:169.254.169.254', 'blocked-high-risk'],
      ['::ffff:192.168.1.50', 'private-network'],
      ['10.0.0.1', 'private-network'],
      ['172.16.0.1', 'private-network'],
      ['192.168.1.1', 'private-network'],
      ['100.64.0.1', 'private-network'],
      ['0300.0250.0.1', 'private-network'],
      ['fc00::1', 'private-network'],
      ['fd12:3456:789a::1', 'private-network'],
      ['8.8.8.8', 'public'],
      ['2001:4860:4860::8888', 'public']
    ]

    for (const [ip, expected] of vectors) {
      expect(classifyClientIp(ip), `client ${ip}`).toBe(expected)
      expect(classifyProxyIp(ip), `proxy ${ip}`).toBe(expected)
    }

    expect(validateRemoteUrlSyntax('http://0177.0.0.1/secret').classification).toBe('blocked-high-risk')
    expect(validateRemoteUrlSyntax('http://2130706433/secret').classification).toBe('blocked-high-risk')
    expect(validateRemoteUrlSyntax('http://[::ffff:169.254.169.254]/latest').classification).toBe('blocked-high-risk')
  })

  it('pins validated single IP in lookup callback to defeat DNS rebinding (TOCTOU)', async () => {
    let resolverCalls = 0
    const fakeLookup = async () => {
      resolverCalls++
      // First call returns public IP; rebinding second call would return loopback if invoked directly
      if (resolverCalls === 1) {
        return [{ address: '93.184.216.34', family: 4 }]
      }
      return [{ address: '127.0.0.1', family: 4 }]
    }

    const pinned = await resolveAndValidateHost('https://books.example.com/a.epub', {
      allowPrivateNetwork: false,
      dnsLookup: fakeLookup
    })

    expect(pinned.address).toBe('93.184.216.34')
    expect(pinned.family).toBe(4)

    const resolvedViaSocketLookup = await new Promise<{ err: unknown; address?: string }>((resolve) => {
      pinned.pinnedLookup('books.example.com', {}, (err: unknown, address?: string) => {
        resolve({ err, address })
      })
    })
    expect(resolvedViaSocketLookup.err).toBeNull()
    expect(resolvedViaSocketLookup.address).toBe('93.184.216.34')
    // Must not re-query DNS during socket connection
    expect(resolverCalls).toBe(1)
  })
})
