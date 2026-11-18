// SPDX-License-Identifier: GPL-3.0-only
import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearMocks, mockIPC } from '@tauri-apps/api/mocks'
import { isAllowedExternalUrl, openExternalLink } from '@/services/platform/externalLink'

afterEach(() => {
  clearMocks()
  vi.restoreAllMocks()
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__
})

describe('External link allow-list (contracts/about-screen.md §3)', () => {
  it.each([
    'https://github.com/Ezenitac-AiService/EasyViewer',
    'https://github.com/Ezenitac-AiService/EasyViewer/blob/main/LICENSE',
    'https://github.com/edith2580/EasyViewer',
    'https://github.com/edith2580/EasyViewer/releases'
  ])('allows %s', (url) => {
    expect(isAllowedExternalUrl(url)).toBe(true)
  })

  it.each([
    'https://github.com.evil/Ezenitac-AiService/EasyViewer',
    'https://github.com/edith2580/EasyViewerX',
    'https://github.com/edith2580/EasyViewer-fake/x',
    'http://github.com/Ezenitac-AiService/EasyViewer',
    'https://evil@github.com/edith2580/EasyViewer',
    'https://github.com:8443/edith2580/EasyViewer',
    'https://github.com/edith2580/EasyViewer/../../attacker/repo',
    'javascript:alert(1)',
    'file:///etc/passwd',
    'not a url',
    ''
  ])('rejects %s', (url) => {
    expect(isAllowedExternalUrl(url)).toBe(false)
  })
})

describe('openExternalLink', () => {
  it('refuses disallowed URLs without calling any opener', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    await expect(openExternalLink('https://example.com')).resolves.toBe(false)
    expect(open).not.toHaveBeenCalled()
  })

  it('uses window.open with noopener on the web fallback', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    await expect(openExternalLink('https://github.com/edith2580/EasyViewer')).resolves.toBe(true)
    expect(open).toHaveBeenCalledWith('https://github.com/edith2580/EasyViewer', '_blank', 'noopener,noreferrer')
  })

  it('uses the opener plugin inside Tauri', async () => {
    const calls: Array<{ cmd: string; args: unknown }> = []
    mockIPC((cmd, args) => {
      calls.push({ cmd, args })
      return null
    })
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    await expect(
      openExternalLink('https://github.com/Ezenitac-AiService/EasyViewer')
    ).resolves.toBe(true)
    expect(open).not.toHaveBeenCalled()
    expect(calls).toEqual([
      {
        cmd: 'plugin:opener|open_url',
        args: expect.objectContaining({ url: 'https://github.com/Ezenitac-AiService/EasyViewer' })
      }
    ])
  })
})
