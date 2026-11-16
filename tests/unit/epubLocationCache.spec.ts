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

  it('renders first page via rendition.display() BEFORE starting background locations.generate() even when contentHash is absent or uncached (T053)', async () => {
    const { vi } = await import('vitest')
    vi.resetModules()
    const events: string[] = []
    let resolveGenerate: ((locs: string[]) => void) | null = null

    vi.doMock('epubjs', () => {
      class FakeEpubCFI {
        compare() {
          return 0
        }
      }
      const fakeEpub = () => ({
        ready: Promise.resolve(),
        loaded: {
          metadata: Promise.resolve({ title: 'Test EPUB', creator: 'Author' }),
          navigation: Promise.resolve({ toc: [] })
        },
        spine: {
          spineItems: [{ index: 0, href: 'ch1.xhtml' }],
          hooks: { content: { register: () => {} } }
        },
        locations: {
          generate: () => {
            events.push('locations.generate:start')
            return new Promise<string[]>((resolve) => {
              resolveGenerate = resolve
            })
          },
          load: () => {
            events.push('locations.load:cache')
          },
          length: () => 2
        },
        renderTo: () => ({
          themes: { default: () => {} },
          hooks: { content: { register: () => {} } },
          on: () => {},
          display: async () => {
            events.push('rendition.display')
          },
          destroy: () => {}
        }),
        destroy: () => {}
      })
      return { default: fakeEpub, EpubCFI: FakeEpubCFI }
    })

    const { EpubViewerEngine } = await import('@/engines/epub/epubEngine')
    const { createCleanEpubBuffer } = await import('../fixtures/bookFixtures')
    const buffer = await createCleanEpubBuffer()
    const container = document.createElement('div')

    let indexReadyValue: boolean | null = null
    const engine = new EpubViewerEngine({
      load: async () => null,
      save: async () => {}
    })

    const res = await engine.loadBook({
      buffer,
      container,
      settings: {
        theme: 'light',
        fontFamily: 'sans',
        fontSize: 16,
        lineHeight: 1.6,
        pageMargin: 24,
        viewMode: 'paginated',
        syncEndpoint: ''
      },
      onIndexReady: (ready) => {
        indexReadyValue = ready
        events.push(`onIndexReady:${ready}`)
      }
    })
    events.push(`loadBookResolved:${res.precisionReady}`)

    expect(res.precisionReady).toBe(false)
    expect(events.indexOf('rendition.display')).toBeGreaterThanOrEqual(0)
    expect(events.indexOf('locations.generate:start')).toBeGreaterThan(
      events.indexOf('rendition.display')
    )

    resolveGenerate?.(['epubcfi(/6/2)', 'epubcfi(/6/4)'])
    await new Promise((r) => setTimeout(r, 10))
    expect(indexReadyValue).toBe(true)

    engine.destroy()
    vi.doUnmock('epubjs')
  })
})
