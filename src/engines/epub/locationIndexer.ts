import type { LocationIndexCacheRecord } from '@/types'

export interface SpineMetricEntry {
  index: number
  href: string
  weight: number
  startPct: number
  endPct: number
}

export interface LocationIndexCachePort {
  load(contentHash: string): Promise<LocationIndexCacheRecord | null>
  save(contentHash: string, record: LocationIndexCacheRecord): Promise<void>
}

export interface LocationIndexResult {
  precisionReady: boolean
  fromCache: boolean
}

const memoryIndexCache = new Map<string, LocationIndexCacheRecord>()

export function computeApproximatePercentage(
  metrics: SpineMetricEntry[],
  sectionIndex: number,
  sectionFraction = 0
): number {
  if (metrics.length === 0) return 0
  const metric = metrics[Math.max(0, Math.min(metrics.length - 1, sectionIndex))]
  if (!metric) return 0
  const clamped = Math.max(0, Math.min(1, sectionFraction))
  return metric.startPct + (metric.endPct - metric.startPct) * clamped
}

export async function tryLoadCachedLocationIndex(
  book: { locations?: { load?: (locs: string[]) => void } },
  contentHash?: string,
  signal?: AbortSignal,
  cachePort?: LocationIndexCachePort
): Promise<boolean> {
  if (!contentHash || signal?.aborted || !book?.locations) return false
  const mem = memoryIndexCache.get(contentHash)
  if (mem && mem.locations.length > 0) {
    book.locations.load?.(mem.locations)
    return true
  }
  if (cachePort) {
    try {
      const cached = await cachePort.load(contentHash)
      if (signal?.aborted) return false
      if (cached && cached.locations.length > 0) {
        memoryIndexCache.set(contentHash, cached)
        book.locations.load?.(cached.locations)
        return true
      }
    } catch {
      return false
    }
  }
  return false
}

export async function loadOrBuildLocationIndex(
  book: { locations?: { generate: (chars: number) => Promise<string[]>; load?: (locs: string[]) => void } },
  contentHash?: string,
  stepChars = 150,
  signal?: AbortSignal,
  cachePort?: LocationIndexCachePort
): Promise<LocationIndexResult> {
  if (signal?.aborted || !book?.locations) {
    return { precisionReady: false, fromCache: false }
  }

  if (await tryLoadCachedLocationIndex(book, contentHash, signal, cachePort)) {
    return { precisionReady: true, fromCache: true }
  }

  if (signal?.aborted) return { precisionReady: false, fromCache: false }
  const locations = await book.locations.generate(stepChars)
  if (signal?.aborted) return { precisionReady: false, fromCache: false }

  if (contentHash && Array.isArray(locations) && locations.length > 0) {
    const record: LocationIndexCacheRecord = {
      schemaVersion: 1,
      stepChars,
      locations,
      sectionCounts: [],
      updatedAt: Date.now()
    }
    memoryIndexCache.set(contentHash, record)
    await cachePort?.save(contentHash, record).catch(() => {})
  }

  return { precisionReady: true, fromCache: false }
}

export async function resetLocationIndexCacheForTest(): Promise<void> {
  memoryIndexCache.clear()
}
