import { describe, expect, it } from 'vitest'
import { platformStorage } from '@/services/storage/platformAdapter'

describe('Non-blocking EPUB locationIndexer, cache reuse & destroy cancellation (T019)', () => {
  it('computes spine-proportional approximate percentages immediately, caches locations by contentHash, and cancels cleanly on destroy', async () => {
    const {
      computeApproximatePercentage,
      loadOrBuildLocationIndex,
      resetLocationIndexCacheForTest
    } = await import('@/engines/epub/locationIndexer')

    await resetLocationIndexCacheForTest()

    const metrics = [
      { index: 0, href: 'ch1.xhtml', weight: 100, startPct: 0, endPct: 25 },
      { index: 1, href: 'ch2.xhtml', weight: 300, startPct: 25, endPct: 100 }
    ]
    expect(computeApproximatePercentage(metrics, 1, 0.5)).toBeCloseTo(62.5, 1)

    let generateCalls = 0
    const mockBook = {
      locations: {
        generate: async () => {
          generateCalls++
          return ['epubcfi(/6/2)', 'epubcfi(/6/4)']
        },
        load: () => {}
      }
    } as any

    const cachePort = {
      load: (hash: string) => platformStorage.loadLocationIndex(hash),
      save: (hash: string, rec: any) => platformStorage.saveLocationIndex(hash, rec)
    }

    const first = await loadOrBuildLocationIndex(mockBook, 'sha256-cache-test', 150, undefined, cachePort)
    expect(first.precisionReady).toBe(true)
    expect(first.fromCache).toBe(false)
    expect(generateCalls).toBe(1)

    // Clear in-memory cache to verify IndexedDB persistence works across reloads
    await resetLocationIndexCacheForTest()
    const second = await loadOrBuildLocationIndex(mockBook, 'sha256-cache-test', 150, undefined, cachePort)
    expect(second.precisionReady).toBe(true)
    expect(second.fromCache).toBe(true)
    expect(generateCalls).toBe(1)

    const ac = new AbortController()
    ac.abort()
    const cancelled = await loadOrBuildLocationIndex(mockBook, 'sha256-cancelled', 150, ac.signal, cachePort)
    expect(cancelled.precisionReady).toBe(false)
    expect(generateCalls).toBe(1)
  })
})
