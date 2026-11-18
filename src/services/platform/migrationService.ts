// SPDX-License-Identifier: GPL-3.0-only
/**
 * Platform port over the one-time desktop migration (spec 003 US6, contracts/data-migration.md
 * §2–3). Upper layers never call `@tauri-apps/api` directly (constitution V).
 */
import type { WebDavConnection } from '@/types'
import { isDesktopApp, isTauriEnv, platformStorage } from '@/services/storage/platformAdapter'

export const LEGACY_IDENTIFIER = 'com.edith.easyviewer'
export const NEW_IDENTIFIER = 'com.ezenitac.easyviewer'

/** Persisted keys owned by the library store and the storage adapter (relinked, never renamed). */
export const LIBRARY_BOOKS_KEY = 'library_books_v1'
export const STORAGE_DIR_KEY = 'storage_dir_v1'

export type MigrationState =
  | 'migrated'
  | 'skipped_target_not_empty'
  | 'skipped_no_source'
  | 'partial'
  | 'failed'
  | 'declined'
  | 'discard_pending'
  | 'discarded'

export type MigrationErrorKind = 'io' | 'permission' | 'space' | 'boundary' | 'busy'

export interface CredentialOutcome {
  migrated: number
  missing: number
  failed: number
}

export interface MigrationRecord {
  schema: 1
  state: MigrationState
  sourceIdentifier: string
  startedAt: string
  finishedAt: string
  copied: { dataDir: boolean; webviewStore: boolean }
  skippedEntries: number
  error?: MigrationErrorKind
  credentials?: CredentialOutcome & { skipped?: boolean }
  reconstructed: boolean
  noticeAcknowledged: boolean
}

export type MigrationNoticeKind = 'migrated' | 'partial' | 'failed' | 'declined' | 'kept-new'

const ACCOUNT_ID_RE = /^[A-Za-z0-9_-]{1,128}$/
const ZERO: CredentialOutcome = { migrated: 0, missing: 0, failed: 0 }

async function invokeCommand<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(cmd, args)
}

/** Which notice (contracts §2 table) a record asks for; `null` once acknowledged or not needed. */
export function describeMigrationNotice(record: MigrationRecord | null): MigrationNoticeKind | null {
  if (!record || record.noticeAcknowledged) return null
  switch (record.state) {
    case 'migrated':
    case 'partial':
    case 'failed':
    case 'declined':
      return record.state
    case 'skipped_target_not_empty':
      return 'kept-new'
    default:
      return null
  }
}

/** Maps a path inside the legacy app folder to the same relative path in the new folder. */
export function relinkLegacyPath(
  path: string | null | undefined,
  legacyRoot: string,
  newRoot: string
): string | null {
  if (!path) return null
  if (path === legacyRoot) return newRoot
  return path.startsWith(`${legacyRoot}/`) ? `${newRoot}${path.slice(legacyRoot.length)}` : null
}

function migratableAccountKeys(connections: WebDavConnection[]): string[] {
  const ids = connections
    .filter((c) => c.credentialScope === 'native-secure' && ACCOUNT_ID_RE.test(c.id))
    .map((c) => c.id)
  return [...new Set(ids)].map((id) => `easyviewer:webdav:${id}`)
}

class DefaultMigrationService {
  private credentialRun: Promise<CredentialOutcome> | null = null

  private async isDesktop(): Promise<boolean> {
    return isTauriEnv() && (await isDesktopApp())
  }

  async getRecord(): Promise<MigrationRecord | null> {
    if (!(await this.isDesktop())) return null
    try {
      return (await invokeCommand<MigrationRecord | null>('get_migration_record')) ?? null
    } catch {
      return null
    }
  }

  async acknowledge(): Promise<void> {
    if (await this.isDesktop()) await invokeCommand('acknowledge_migration_notice')
  }

  async markReconstructed(): Promise<void> {
    if (await this.isDesktop()) await invokeCommand('mark_library_reconstructed')
  }

  /**
   * macOS asks for the login password once per legacy keychain item (research R2, F26), so the
   * user is warned and may skip. Linux Secret Service has no per-item prompt.
   */
  needsKeychainPrompt(): boolean {
    return typeof navigator !== 'undefined' && /Macintosh|Mac OS X/.test(navigator.userAgent)
  }

  countMigratableCredentials(connections: WebDavConnection[]): number {
    return migratableAccountKeys(connections).length
  }

  /** One call per app run; the Rust command itself is one-shot per record. */
  migrateCredentials(connections: WebDavConnection[]): Promise<CredentialOutcome> {
    if (!this.credentialRun) {
      const keys = migratableAccountKeys(connections)
      this.credentialRun =
        keys.length === 0
          ? Promise.resolve({ ...ZERO })
          : invokeCommand<CredentialOutcome>('migrate_legacy_credentials', { accountKeys: keys })
    }
    return this.credentialRun
  }

  async skipCredentials(): Promise<void> {
    if (await this.isDesktop()) await invokeCommand('skip_legacy_credentials')
  }

  /** Records `discard_pending` and restarts; the folders are emptied before the next window. */
  async requestDiscardRestart(): Promise<void> {
    if (await this.isDesktop()) await invokeCommand('request_restart_for_discard')
  }

  /**
   * Book paths and a custom storage folder copied from the legacy app still point into the
   * legacy folder. Re-point them to the copy so removing a book can never touch the original.
   * Must run before the library store loads. Returns how many values were changed.
   */
  async relinkLegacyLibraryPaths(): Promise<number> {
    const record = await this.getRecord()
    if (!record || !['migrated', 'partial'].includes(record.state) || !record.copied.dataDir) return 0
    const { appDataDir } = await import('@tauri-apps/api/path')
    const newRoot = (await appDataDir()).replace(/\/+$/, '')
    const cut = newRoot.lastIndexOf('/')
    if (cut < 0 || newRoot.slice(cut + 1) !== NEW_IDENTIFIER) return 0
    const legacyRoot = `${newRoot.slice(0, cut)}/${LEGACY_IDENTIFIER}`

    let changed = 0
    const books = await platformStorage.getItem<Array<{ storedPath?: string }>>(LIBRARY_BOOKS_KEY, [])
    const relinked = (Array.isArray(books) ? books : []).map((book) => {
      const next = relinkLegacyPath(book.storedPath, legacyRoot, newRoot)
      if (next === null) return book
      changed += 1
      return { ...book, storedPath: next }
    })
    if (relinked.some((b, i) => b !== books[i])) await platformStorage.setItem(LIBRARY_BOOKS_KEY, relinked)

    const storageDir = await platformStorage.getItem<string | null>(STORAGE_DIR_KEY, null)
    const nextDir = relinkLegacyPath(storageDir, legacyRoot, newRoot)
    if (nextDir !== null) {
      await platformStorage.setItem(STORAGE_DIR_KEY, nextDir)
      changed += 1
    }
    return changed
  }
}

export type PlatformMigrationPort = DefaultMigrationService
export const platformMigration: PlatformMigrationPort = new DefaultMigrationService()
