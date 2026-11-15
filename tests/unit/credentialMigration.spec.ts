import { describe, expect, it, vi } from 'vitest'
import { mockIPC } from '@tauri-apps/api/mocks'

describe('PlatformCredentialPort & WebDav v1->v2 migration (US3 - TDD)', () => {
  it('keeps unremembered passwords strictly in session memory with zero persistence', async () => {
    vi.resetModules()
    const { platformCredential } = await import('@/services/platform/credentialService')
    const { platformStorage } = await import('@/services/storage/platformAdapter')
    const setSpy = vi.spyOn(platformStorage, 'setItem')

    await platformCredential.setPassword('conn-session', 'ephemeral-secret', { remember: false })
    expect(await platformCredential.getPassword('conn-session')).toBe('ephemeral-secret')
    expect(setSpy).not.toHaveBeenCalled()
  })

  it('stores remembered passwords in OS keyring via tauri-plugin-keyring-store in Tauri env', async () => {
    vi.resetModules()
    const keyring = new Map<string, string>()

    mockIPC((cmd, args) => {
      if (cmd === 'plugin:keyring-store|set_passwords') {
        const entries = (args as { entries: Array<{ account: string; secret: string }> }).entries
        for (const e of entries) keyring.set(e.account, e.secret)
        return null
      }
      if (cmd === 'plugin:keyring-store|get_passwords') {
        const accounts = (args as { accounts: string[] }).accounts
        return accounts.map((a) => keyring.get(a) ?? null)
      }
      if (cmd === 'plugin:keyring-store|delete_passwords') {
        const accounts = (args as { accounts: string[] }).accounts
        for (const a of accounts) keyring.delete(a)
        return null
      }
      return null
    })

    const { platformCredential } = await import('@/services/platform/credentialService')
    await platformCredential.setPassword('conn-1', 'native-secret-123', { remember: true })
    expect(keyring.size).toBe(1)

    // Clear in-memory cache by querying after remove/restore or direct keyring check
    expect(await platformCredential.getPassword('conn-1')).toBe('native-secret-123')
    await platformCredential.removePassword('conn-1')
    expect(keyring.size).toBe(0)
    expect(await platformCredential.getPassword('conn-1')).toBe('')
  })

  it('requires explicit webStorageConsent before persisting password in browser environment', async () => {
    vi.resetModules()
    const { platformCredential } = await import('@/services/platform/credentialService')

    await expect(
      platformCredential.setPassword('conn-web', 'web-secret', {
        remember: true,
        webStorageConsent: false
      })
    ).rejects.toThrow()

    await platformCredential.setPassword('conn-web', 'web-secret', {
      remember: true,
      webStorageConsent: true
    })
    expect(await platformCredential.getPassword('conn-web')).toBe('web-secret')
  })

  it('migrates legacy v1 webdav_history plaintext passwords to v2 without losing connection metadata', async () => {
    vi.resetModules()
    const { platformStorage } = await import('@/services/storage/platformAdapter')
    await platformStorage.setItem('webdav_history', [
      {
        id: 'dav-legacy-1',
        alias: '내 NAS',
        url: 'https://nas.example.com/dav',
        username: 'reader',
        password: 'legacy-plaintext-password',
        initialPath: '/ebooks',
        lastConnectedAt: 1700000000000
      }
    ])

    const { loadWebDavHistory } = await import('@/services/network/webdavService')
    const { platformCredential } = await import('@/services/platform/credentialService')

    const migrated = await loadWebDavHistory()
    expect(migrated).toHaveLength(1)
    expect(migrated[0]).toMatchObject({
      id: 'dav-legacy-1',
      alias: '내 NAS',
      url: 'https://nas.example.com/dav',
      username: 'reader',
      initialPath: '/ebooks',
      lastConnectedAt: 1700000000000
    })
    expect(migrated[0].password).toBeUndefined()

    const rawAfter = await platformStorage.getItem<Array<Record<string, unknown>>>('webdav_history', [])
    expect(rawAfter[0].password).toBeUndefined()
    expect(await platformCredential.getPassword('dav-legacy-1')).toBe('legacy-plaintext-password')
  })

  it('rejects WebDAV PROPFIND XML entries containing path traversal (..) or control chars', async () => {
    const { parseWebDavPropfindXml } = await import('@/services/network/webdavService')
    const { MALICIOUS_WEBDAV_PROPFIND_XML } = await import('../fixtures/bookFixtures')

    const parsed = parseWebDavPropfindXml(
      MALICIOUS_WEBDAV_PROPFIND_XML,
      'https://nas.example.com/books',
      'https://nas.example.com/books/'
    )
    expect(parsed.map((item) => item.name)).toEqual(['valid-novel.epub'])
  })
})
