// SPDX-License-Identifier: GPL-3.0-only
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearMocks, mockIPC } from '@tauri-apps/api/mocks'
import type { WebDavConnection } from '@/types'

/** spec 003 US6 / T066: migration port over the Rust record commands (contracts/data-migration.md §2–3). */

const RECORD = {
  schema: 1,
  state: 'migrated',
  sourceIdentifier: 'com.edith.easyviewer',
  startedAt: '2026-11-18T00:00:00Z',
  finishedAt: '2026-11-18T00:00:01Z',
  copied: { dataDir: true, webviewStore: true },
  skippedEntries: 0,
  reconstructed: false,
  noticeAcknowledged: false
}

function conn(id: string, scope: WebDavConnection['credentialScope']): WebDavConnection {
  return { id, alias: id, url: 'https://dav.example', username: 'u', initialPath: '/', lastConnectedAt: 0, credentialScope: scope }
}

beforeEach(() => vi.resetModules())
afterEach(() => {
  clearMocks()
  vi.restoreAllMocks()
})

function desktopIpc(handlers: Record<string, (args: unknown) => unknown> = {}) {
  const calls: Array<{ cmd: string; args: unknown }> = []
  mockIPC((cmd, args) => {
    calls.push({ cmd, args })
    if (cmd === 'is_desktop') return true
    if (cmd === 'plugin:path|resolve_directory') return '/Users/u/Library/Application Support/com.ezenitac.easyviewer'
    const h = handlers[cmd]
    return h ? h(args) : null
  })
  return calls
}

describe('platformMigration.getRecord / acknowledge', () => {
  it('returns null on the web without any IPC', async () => {
    const { platformMigration } = await import('@/services/platform/migrationService')
    expect(await platformMigration.getRecord()).toBeNull()
  })

  it('returns null on mobile Tauri', async () => {
    mockIPC((cmd) => (cmd === 'is_desktop' ? false : RECORD))
    const { platformMigration } = await import('@/services/platform/migrationService')
    expect(await platformMigration.getRecord()).toBeNull()
  })

  it('returns the desktop record and acknowledges it', async () => {
    const calls = desktopIpc({ get_migration_record: () => RECORD })
    const { platformMigration } = await import('@/services/platform/migrationService')
    expect(await platformMigration.getRecord()).toEqual(RECORD)
    await platformMigration.acknowledge()
    await platformMigration.markReconstructed()
    expect(calls.map((c) => c.cmd)).toEqual(
      expect.arrayContaining(['get_migration_record', 'acknowledge_migration_notice', 'mark_library_reconstructed'])
    )
  })
})

describe('platformMigration credentials', () => {
  it('builds account keys from keychain-backed WebDAV connections and calls the command once', async () => {
    const calls = desktopIpc({
      migrate_legacy_credentials: () => ({ migrated: 2, missing: 0, failed: 0 })
    })
    const { platformMigration } = await import('@/services/platform/migrationService')
    const connections = [
      conn('webdav-1', 'native-secure'),
      conn('webdav-2', 'native-secure'),
      conn('webdav-1', 'native-secure'),
      conn('session-only', 'session'),
      conn('bad id/../x', 'native-secure')
    ]
    expect(platformMigration.countMigratableCredentials(connections)).toBe(2)
    const first = await platformMigration.migrateCredentials(connections)
    const second = await platformMigration.migrateCredentials(connections)
    expect(first).toEqual({ migrated: 2, missing: 0, failed: 0 })
    expect(second).toEqual(first)
    const invocations = calls.filter((c) => c.cmd === 'migrate_legacy_credentials')
    expect(invocations).toHaveLength(1)
    expect(invocations[0].args).toEqual({ accountKeys: ['easyviewer:webdav:webdav-1', 'easyviewer:webdav:webdav-2'] })
  })

  it('does not call the command when there is nothing to migrate', async () => {
    const calls = desktopIpc()
    const { platformMigration } = await import('@/services/platform/migrationService')
    expect(await platformMigration.migrateCredentials([conn('s', 'session')])).toEqual({ migrated: 0, missing: 0, failed: 0 })
    expect(calls.some((c) => c.cmd === 'migrate_legacy_credentials')).toBe(false)
  })

  it('records a skip without touching the legacy keychain', async () => {
    const calls = desktopIpc()
    const { platformMigration } = await import('@/services/platform/migrationService')
    await platformMigration.skipCredentials()
    expect(calls.map((c) => c.cmd)).toContain('skip_legacy_credentials')
    expect(calls.some((c) => c.cmd === 'migrate_legacy_credentials')).toBe(false)
  })
})

describe('legacy path relinking (contracts §2: storage folder inside the old app folder)', () => {
  const OLD = '/Users/u/Library/Application Support/com.edith.easyviewer'
  const NEW = '/Users/u/Library/Application Support/com.ezenitac.easyviewer'

  it('maps paths inside the legacy app folder to the same relative path in the new folder', async () => {
    const { relinkLegacyPath } = await import('@/services/platform/migrationService')
    expect(relinkLegacyPath(`${OLD}/books/a.epub`, OLD, NEW)).toBe(`${NEW}/books/a.epub`)
    expect(relinkLegacyPath(OLD, OLD, NEW)).toBe(NEW)
    expect(relinkLegacyPath('/Users/u/Books/a.epub', OLD, NEW)).toBeNull()
    expect(relinkLegacyPath(`${OLD}-other/a.epub`, OLD, NEW)).toBeNull()
    expect(relinkLegacyPath(undefined, OLD, NEW)).toBeNull()
  })

  it('rewrites stored book paths and the storage folder before the library loads', async () => {
    desktopIpc({ get_migration_record: () => RECORD })
    const { platformStorage } = await import('@/services/storage/platformAdapter')
    const store = new Map<string, unknown>([
      ['library_books_v1', [
        { id: 'a', storedPath: `${OLD}/books/a.epub` },
        { id: 'b', storedPath: '/Users/u/Books/b.txt' },
        { id: 'c' }
      ]],
      ['storage_dir_v1', `${OLD}/books`]
    ])
    vi.spyOn(platformStorage, 'getItem').mockImplementation(async (key: string, fallback?: unknown) =>
      (store.has(key) ? store.get(key) : fallback) as never
    )
    vi.spyOn(platformStorage, 'setItem').mockImplementation(async (key: string, value: unknown) => {
      store.set(key, value)
    })
    const { platformMigration } = await import('@/services/platform/migrationService')
    expect(await platformMigration.relinkLegacyLibraryPaths()).toBe(2)
    expect(store.get('library_books_v1')).toEqual([
      { id: 'a', storedPath: `${NEW}/books/a.epub` },
      { id: 'b', storedPath: '/Users/u/Books/b.txt' },
      { id: 'c' }
    ])
    expect(store.get('storage_dir_v1')).toBe(`${NEW}/books`)
    // idempotent
    expect(await platformMigration.relinkLegacyLibraryPaths()).toBe(0)
  })

  it('does not relink when the data folder was not migrated', async () => {
    desktopIpc({ get_migration_record: () => ({ ...RECORD, state: 'declined', copied: { dataDir: false, webviewStore: false } }) })
    const { platformStorage } = await import('@/services/storage/platformAdapter')
    const setSpy = vi.spyOn(platformStorage, 'setItem')
    const { platformMigration } = await import('@/services/platform/migrationService')
    expect(await platformMigration.relinkLegacyLibraryPaths()).toBe(0)
    expect(setSpy).not.toHaveBeenCalled()
  })
})

describe('describeMigrationNotice (contracts §2 table)', () => {
  it('maps record states to notice kinds and hides acknowledged notices', async () => {
    const { describeMigrationNotice } = await import('@/services/platform/migrationService')
    expect(describeMigrationNotice(null)).toBeNull()
    expect(describeMigrationNotice({ ...RECORD, state: 'migrated' } as never)).toBe('migrated')
    expect(describeMigrationNotice({ ...RECORD, state: 'partial' } as never)).toBe('partial')
    expect(describeMigrationNotice({ ...RECORD, state: 'failed', error: 'busy' } as never)).toBe('failed')
    expect(describeMigrationNotice({ ...RECORD, state: 'declined' } as never)).toBe('declined')
    expect(describeMigrationNotice({ ...RECORD, state: 'skipped_target_not_empty' } as never)).toBe('kept-new')
    expect(describeMigrationNotice({ ...RECORD, state: 'skipped_no_source' } as never)).toBeNull()
    expect(describeMigrationNotice({ ...RECORD, state: 'discarded' } as never)).toBeNull()
    expect(describeMigrationNotice({ ...RECORD, noticeAcknowledged: true } as never)).toBeNull()
  })
})

describe('relink keys stay in sync with their owners', () => {
  it('uses the same keys as the library store and the storage adapter', async () => {
    const { createPinia, setActivePinia } = await import('pinia')
    setActivePinia(createPinia())
    const { platformStorage } = await import('@/services/storage/platformAdapter')
    // Report samples as already seeded so initLibrary only reads its keys (no EPUB parsing).
    const getSpy = vi
      .spyOn(platformStorage, 'getItem')
      .mockImplementation(async (key: string, fallback?: unknown) =>
        (key.includes('seeded') ? true : fallback) as never
      )
    const { useBookStore } = await import('@/stores/useBookStore')
    const { LIBRARY_BOOKS_KEY, STORAGE_DIR_KEY } = await import('@/services/platform/migrationService')
    vi.spyOn(platformStorage, 'setItem').mockResolvedValue()
    await useBookStore().initLibrary().catch(() => undefined)
    await platformStorage.isCustomStorageDir()
    const keys = getSpy.mock.calls.map((c) => c[0])
    expect(keys).toContain(LIBRARY_BOOKS_KEY)
    expect(keys).toContain(STORAGE_DIR_KEY)
  })
})

describe('needsKeychainPrompt', () => {
  it('is true only on macOS', async () => {
    const { platformMigration } = await import('@/services/platform/migrationService')
    const ua = vi.spyOn(navigator, 'userAgent', 'get')
    ua.mockReturnValue('Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0) AppleWebKit/605.1.15')
    expect(platformMigration.needsKeychainPrompt()).toBe(true)
    ua.mockReturnValue('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/605.1.15')
    expect(platformMigration.needsKeychainPrompt()).toBe(false)
  })
})
