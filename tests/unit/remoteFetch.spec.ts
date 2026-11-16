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
})
