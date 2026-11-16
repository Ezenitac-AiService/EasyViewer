import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RemoteFetchConsentError, remoteFetch } from '@/services/network/remoteFetch'

describe('remoteFetch proxy header & timeout forwarding (T061)', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('returns upstream 404 as-is when X-EasyViewer-Proxy: 1 header is present without falling back to direct fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response('upstream-not-found', {
        status: 404,
        headers: { 'X-EasyViewer-Proxy': '1' }
      })
    )
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const res = await remoteFetch('https://example.com/missing.epub', {
      timeoutMs: 15_000,
      maxResponseBytes: 1024 * 1024
    })

    expect(res.status).toBe(404)
    expect(await res.text()).toBe('upstream-not-found')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [calledUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(calledUrl).toBe('/__remote_proxy')
    const hdrs = init.headers as Record<string, string>
    expect(hdrs['x-request-timeout-ms']).toBe('15000')
    expect(hdrs['x-max-response-bytes']).toBe(String(1024 * 1024))
  })

  it('falls back to direct fetch ONLY for public URLs when proxy returns 404 without X-EasyViewer-Proxy header', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('Not Found', { status: 404 }))
      .mockResolvedValueOnce(new Response('direct-public-ok', { status: 200 }))
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const res = await remoteFetch('https://example.com/public.epub')
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('direct-public-ok')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://example.com/public.epub')
  })

  it('refuses direct fallback on unmounted proxy 404 for private-network URLs even with allowPrivateNas', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response('Not Found', { status: 404 }))
    globalThis.fetch = fetchMock as unknown as typeof fetch

    await expect(
      remoteFetch('http://192.168.1.50/library/book.epub', { allowPrivateNas: true })
    ).rejects.toMatchObject({
      name: RemoteFetchConsentError.name,
      code: 'PRIVATE_NETWORK_CONFIRM_REQUIRED'
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('rejects HTTP auth unconditionally on non-proxy static web (including SPA 200 HTML fallback) and allows HTTPS auth only with explicit session consent (T011)', async () => {
    const spaHtmlRes = new Response('<!doctype html><html><body>SPA</body></html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    })
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(spaHtmlRes.clone())
      .mockResolvedValueOnce(new Response('Not Found', { status: 404 }))
      .mockResolvedValueOnce(new Response('Not Found', { status: 404 }))
      .mockResolvedValueOnce(new Response('webdav-ok', { status: 200 }))
    globalThis.fetch = fetchMock as unknown as typeof fetch

    await expect(
      remoteFetch('http://nas.example.com/dav/', {
        headers: { Authorization: 'Basic dXNlcjpwYXNz' },
        allowDirectStaticAuth: true
      } as any)
    ).rejects.toMatchObject({
      code: 'INSECURE_AUTH_BLOCKED'
    })

    await expect(
      remoteFetch('https://nas.example.com/dav/', {
        headers: { Authorization: 'Basic dXNlcjpwYXNz' }
      })
    ).rejects.toMatchObject({
      code: 'STATIC_WEB_AUTH_CONFIRM_REQUIRED'
    })

    const consented = await remoteFetch('https://nas.example.com/dav/', {
      headers: { Authorization: 'Basic dXNlcjpwYXNz' },
      allowDirectStaticAuth: true
    } as any)
    expect(consented.status).toBe(200)
    expect(await consented.text()).toBe('webdav-ok')
  })

  it('blocks IPv6 transition/embedded-IPv4 bypass vectors (NAT64, 6to4, Teredo, IPv4-compatible) in SSRF validator (T050)', async () => {
    const blockedUrls = [
      'http://[64:ff9b::7f00:1]/secret.epub',
      'http://[64:ff9b:1::a9fe:a9fe]/latest/meta-data',
      'http://[2002:7f00:1::]/admin',
      'http://[2001:0000:4136:e378:8000:63bf:3fff:fdd2]/tunnel',
      'http://[::127.0.0.1]/loopback'
    ]
    for (const target of blockedUrls) {
      await expect(remoteFetch(target)).rejects.toMatchObject({
        name: RemoteFetchConsentError.name,
        code: 'BLOCKED_HIGH_RISK'
      })
    }

    // NAT64 / 6to4 embedding private LAN IPv4 (192.168.1.1 = c0a8:0101) should require private network consent
    await expect(remoteFetch('http://[64:ff9b::c0a8:101]/nas.epub')).rejects.toMatchObject({
      name: RemoteFetchConsentError.name,
      code: 'PRIVATE_NETWORK_CONFIRM_REQUIRED'
    })
  })
})
