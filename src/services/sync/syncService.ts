import type { BookmarkItem, ReadingLocation, SyncPayload, ViewerSettings } from '@/types'
import { platformStorage } from '@/services/storage/platformAdapter'
import { remoteFetch, RemoteFetchConsentError } from '@/services/network/remoteFetch'

const SYNC_CACHE_KEY = 'cloud_sync_snapshot'
const DEVICE_ID_KEY = 'device_id'

/** Non-transient 4xx HTTP rejection from the remote sync endpoint that must surface to the caller. */
class SyncHttpError extends Error {
  readonly status: number

  constructor(status: number) {
    super(`SYNC_HTTP_ERROR (${status}): 원격 동기화 서버가 요청을 거부했습니다.`)
    this.name = 'SyncHttpError'
    this.status = status
  }
}

function isFatalSyncError(err: unknown): boolean {
  return (
    err instanceof SyncHttpError ||
    (err instanceof RemoteFetchConsentError &&
      (err.code === 'BLOCKED_HIGH_RISK' ||
        err.code === 'PRIVATE_NETWORK_CONFIRM_REQUIRED' ||
        err.code === 'SELF_SIGNED_TLS_CONFIRM_REQUIRED'))
  )
}

function checkSyncResponseOk(res: Response): boolean {
  if (res.ok) return true
  if (res.status >= 400 && res.status < 500) {
    throw new SyncHttpError(res.status)
  }
  return false
}

export async function getOrCreateDeviceId(): Promise<string> {
  let id = await platformStorage.getItem<string>(DEVICE_ID_KEY, '')
  if (!id) {
    id = `dev-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`
    await platformStorage.setItem(DEVICE_ID_KEY, id)
  }
  return id
}

/**
 * Merges local and remote reading locations using latest timestamp (updatedAt) conflict resolution
 */
export function mergeReadingPositions(
  local: Record<string, ReadingLocation>,
  remote: Record<string, ReadingLocation>
): {
  merged: Record<string, ReadingLocation>
  updatedCount: number
} {
  const merged: Record<string, ReadingLocation> = { ...local }
  let updatedCount = 0

  for (const [bookId, remoteLoc] of Object.entries(remote || {})) {
    const localLoc = merged[bookId]
    if (!localLoc || remoteLoc.updatedAt > localLoc.updatedAt) {
      merged[bookId] = remoteLoc
      updatedCount++
    }
  }

  return { merged, updatedCount }
}

/**
 * Merges local and remote bookmarks by unique ID & locator deduplication
 */
export function mergeBookmarks(
  local: Record<string, BookmarkItem[]>,
  remote: Record<string, BookmarkItem[]>
): Record<string, BookmarkItem[]> {
  const merged: Record<string, BookmarkItem[]> = { ...local }

  for (const [bookId, remoteList] of Object.entries(remote || {})) {
    const existing = merged[bookId] || []
    const byLocator = new Map<string, BookmarkItem>()
    for (const item of existing) {
      byLocator.set(item.locator, item)
    }
    for (const item of remoteList || []) {
      if (!byLocator.has(item.locator)) {
        byLocator.set(item.locator, item)
      }
    }
    merged[bookId] = Array.from(byLocator.values()).sort((a, b) => b.createdAt - a.createdAt)
  }

  return merged
}

/**
 * Synchronizes reading progress and bookmarks with either a configured remote endpoint
 * or the cross-tab / local sync hub snapshot.
 */
export async function synchronizeReadingData(
  endpoint: string,
  localPositions: Record<string, ReadingLocation>,
  localBookmarks: Record<string, BookmarkItem[]>,
  settings: ViewerSettings
): Promise<{
  payload: SyncPayload
  updatedCount: number
  mode: 'remote' | 'local-hub'
}> {
  const deviceId = await getOrCreateDeviceId()
  let remotePayload: SyncPayload | null = null
  let mode: 'remote' | 'local-hub' = 'local-hub'

  const cleanEndpoint = endpoint.trim()
  if (cleanEndpoint && (cleanEndpoint.startsWith('http://') || cleanEndpoint.startsWith('https://'))) {
    try {
      const getRes = await remoteFetch(cleanEndpoint, {
        method: 'GET',
        headers: { Accept: 'application/json' }
      })
      if (checkSyncResponseOk(getRes)) {
        remotePayload = (await getRes.json()) as SyncPayload
      }
    } catch (err) {
      if (isFatalSyncError(err)) throw err
      // Fallback to local sync hub only on transient offline or 5xx server errors
    }
  }

  if (!remotePayload) {
    remotePayload = await platformStorage.getItem<SyncPayload | null>(SYNC_CACHE_KEY, null)
  }

  const { merged: mergedPositions, updatedCount } = mergeReadingPositions(
    localPositions,
    remotePayload?.positions || {}
  )
  const mergedBookmarks = mergeBookmarks(localBookmarks, remotePayload?.bookmarks || {})

  const nextPayload: SyncPayload = {
    version: 1,
    exportedAt: Date.now(),
    deviceId,
    positions: mergedPositions,
    bookmarks: mergedBookmarks,
    settings
  }

  await platformStorage.setItem(SYNC_CACHE_KEY, nextPayload)

  if (cleanEndpoint && (cleanEndpoint.startsWith('http://') || cleanEndpoint.startsWith('https://'))) {
    try {
      const postRes = await remoteFetch(cleanEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextPayload)
      })
      if (checkSyncResponseOk(postRes)) {
        mode = 'remote'
      }
    } catch (err) {
      if (isFatalSyncError(err)) throw err
      // Saved locally in sync hub on transient offline or 5xx server errors
    }
  }

  return {
    payload: nextPayload,
    updatedCount,
    mode
  }
}

