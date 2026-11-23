import ePub, { EpubCFI, type Book, type Rendition } from 'epubjs'
import type { SearchResultItem, TocItem, ViewerSettings } from '@/types'
import type { DocumentReaderPort, ReaderLoadOptions } from '@/engines/types'
import { getStableScrollManager } from './stableScrollManager'
import { CONTENT_CSP, sanitizeSectionDocument, validateEpubArchiveBounds } from './sanitizer'
import {
  loadOrBuildLocationIndex,
  tryLoadCachedLocationIndex,
  type LocationIndexCachePort
} from './locationIndexer'
import { TouchTapController } from './touchTapController'
import { anySignal } from './abortSignals'
import {
  buildSectionMetrics,
  collapseCfiString,
  computeCfiPercentage,
  computeLocationPercentage,
  findChapterLabelByHref,
  normalizeToc,
  resolveTargetHref,
  type SpineSectionMetric
} from './epubCfiMetrics'

export { CONTENT_CSP, sanitizeSectionDocument, validateEpubArchiveBounds }

export interface EpubLocationChange {
  cfi: string
  percentage: number
  chapterTitle: string
  href: string
}

const FONT_STACK_MAP: Record<string, string> = {
  sans: '"Pretendard Variable", Pretendard, "Noto Sans KR", -apple-system, BlinkMacSystemFont, sans-serif',
  serif: '"Nanum Myeongjo", "Noto Serif KR", Georgia, serif',
  mono: '"D2Coding", Consolas, monospace',
  system: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif'
}

const THEME_PALETTE_MAP: Record<string, { bg: string; fg: string; link: string }> = {
  light: { bg: '#ffffff', fg: '#1e293b', link: '#4f46e5' },
  dark: { bg: '#111827', fg: '#e5e7eb', link: '#818cf8' },
  sepia: { bg: '#f4ecd8', fg: '#433422', link: '#8c5828' }
}

/**
 * EPUB rendition engine implementing DocumentReaderPort with sandboxed CSP sections,
 * non-blocking location indexing, and WebKit-safe touch/tap handling.
 */
export class EpubViewerEngine implements DocumentReaderPort {
  private book: Book | null = null
  private rendition: Rendition | null = null
  private tocList: TocItem[] = []
  private locationsReady = false
  private sectionMetrics: SpineSectionMetric[] = []
  private activeHighlights: string[] = []
  private cfiHelper = new EpubCFI()
  private tapController = new TouchTapController()
  private keyHandler: ((event: KeyboardEvent) => void) | null = null
  private container: HTMLElement | null = null
  private onRelocated: ((loc: EpubLocationChange) => void) | null = null
  private renderedViewMode: ViewerSettings['viewMode'] | null = null
  private rebuildPromise: Promise<void> | null = null
  private activeAbortController: AbortController | null = null

  constructor(private readonly cachePort?: LocationIndexCachePort) {}

  setTapHandler(handler: ((clientX: number, clientY: number) => void) | null): void {
    this.tapController.setTapHandler(handler)
  }

  setKeyHandler(handler: ((event: KeyboardEvent) => void) | null): void {
    this.keyHandler = handler
  }

  private scrollPosition(): { top: number; left: number } {
    const el: HTMLElement | undefined = (this.rendition as any)?.manager?.container
    return { top: el?.scrollTop ?? 0, left: el?.scrollLeft ?? 0 }
  }

  async loadBook(options: ReaderLoadOptions): Promise<{
    title: string
    author: string
    toc: TocItem[]
    precisionReady: boolean
    sectionCount: number
  }>
  async loadBook(
    buffer: ArrayBuffer,
    container: HTMLElement,
    settings: ViewerSettings,
    initialLocator?: string,
    onRelocated?: (loc: EpubLocationChange) => void,
    initialPercentage?: number
  ): Promise<{ title: string; author: string; toc: TocItem[] }>
  async loadBook(
    bufferOrOptions: ArrayBuffer | ReaderLoadOptions,
    containerArg?: HTMLElement,
    settingsArg?: ViewerSettings,
    initialLocatorArg?: string,
    onRelocatedArg?: (loc: EpubLocationChange) => void,
    initialPercentageArg?: number
  ): Promise<any> {
    const opts: ReaderLoadOptions =
      bufferOrOptions instanceof ArrayBuffer
        ? {
            buffer: bufferOrOptions,
            container: containerArg!,
            settings: settingsArg!,
            initialLocator: initialLocatorArg,
            initialPercentage: initialPercentageArg,
            onRelocated: onRelocatedArg
              ? (loc) =>
                  onRelocatedArg({
                    cfi: loc.locator,
                    percentage: loc.percentage,
                    chapterTitle: loc.chapterTitle || '본문',
                    href: ''
                  })
              : undefined
          }
        : bufferOrOptions

    this.destroy()
    await validateEpubArchiveBounds(opts.buffer)

    const book = ePub(opts.buffer.slice(0))
    this.book = book
    ;(book.spine as any).hooks.content.register(sanitizeSectionDocument)
    await book.ready

    const metadata = await book.loaded.metadata
    const navigation = await book.loaded.navigation
    this.tocList = normalizeToc(navigation?.toc || [])
    this.sectionMetrics = buildSectionMetrics(book)

    const isLegacyPositionalCall = bufferOrOptions instanceof ArrayBuffer
    const abortController = new AbortController()
    this.activeAbortController = abortController
    const signal = opts.signal
      ? anySignal([opts.signal, abortController.signal])
      : abortController.signal

    // Fast path: restore cached locations before display if already indexed
    if (await tryLoadCachedLocationIndex(book as any, opts.contentHash, signal, this.cachePort)) {
      this.locationsReady = true
      this.sectionMetrics = buildSectionMetrics(book)
      opts.onIndexReady?.(true)
    }

    this.container = opts.container
    opts.container.addEventListener('scroll', this.tapController.handleContainerScroll, {
      capture: true,
      passive: true
    })
    this.onRelocated = (loc) => opts.onRelocated?.({ locator: loc.cfi, percentage: loc.percentage, chapterTitle: loc.chapterTitle, precisionReady: this.locationsReady })
    const rendition = this.createRendition(opts.settings, opts.initialLocator, opts.initialPercentage)

    if (opts.initialLocator && opts.initialLocator.startsWith('epubcfi(')) {
      await rendition.display(collapseCfiString(opts.initialLocator, true)).catch(() => rendition.display())
    } else if (opts.initialLocator) {
      const target = resolveTargetHref(book, this.tocList, opts.initialLocator)
      await rendition.display(target).catch(() => rendition.display())
    } else {
      await rendition.display()
    }

    if (!this.locationsReady) {
      const indexPromise = loadOrBuildLocationIndex(
        book as any,
        opts.contentHash,
        150,
        signal,
        this.cachePort
      )
        .then((res) => {
          if (this.book === book && !signal.aborted) {
            this.locationsReady = res.precisionReady
            if (res.precisionReady) this.sectionMetrics = buildSectionMetrics(book)
            opts.onIndexReady?.(res.precisionReady)
          }
          return res.precisionReady
        })
        .catch(() => false)

      if (isLegacyPositionalCall) {
        await indexPromise
      }
    }

    return {
      title: metadata?.title || '제목 없는 EPUB',
      author: metadata?.creator || '작자 미상',
      toc: this.tocList,
      precisionReady: this.locationsReady,
      sectionCount: this.sectionMetrics.length
    }
  }

  private createRendition(settings: ViewerSettings, initialLocator?: string, initialPercentage?: number): Rendition {
    if (!this.book || !this.container) throw new Error('EPUB book is not loaded')
    const isScroll = settings.viewMode === 'scroll'
    const rendition = this.book.renderTo(this.container, {
      width: '100%',
      height: '100%',
      manager: isScroll ? getStableScrollManager() : 'default',
      flow: isScroll ? 'scrolled' : 'paginated',
      spread: 'none',
      allowScriptedContent: true
    })
    this.rendition = rendition
    this.renderedViewMode = settings.viewMode
    this.applyTheme(settings)

    rendition.on('touchstart', (e: TouchEvent, c: any) => this.tapController.handleTouchStart(e, c, this.scrollPosition()))
    rendition.on('touchend', (e: TouchEvent, c: any) => this.tapController.handleTouchEnd(e, c, this.scrollPosition()))
    rendition.on('click', (e: MouseEvent, c: any) => this.tapController.handleClick(e, c))
    ;(rendition as any).hooks.content.register((contents: any) => {
      contents?.document?.addEventListener('keydown', (e: KeyboardEvent) => this.keyHandler?.(e))
    })

    let isFirstRelocation = Boolean(initialLocator)
    rendition.on('relocated', (location: any) => {
      if (!location?.start) return
      const cfi: string = location.start.cfi || ''
      const href: string = location.start.href || ''
      let percentage = computeLocationPercentage(this.sectionMetrics, this.cfiHelper, location)
      if (isFirstRelocation && initialLocator && typeof initialPercentage === 'number' && initialPercentage > 0 && percentage === 0 && !location.atStart) {
        percentage = Math.min(100, Math.max(0, Math.round(initialPercentage * 10) / 10))
      }
      isFirstRelocation = false
      const chapterTitle = findChapterLabelByHref(this.tocList, href, location.start.index)
      this.onRelocated?.({ cfi, percentage, chapterTitle, href })
    })
    return rendition
  }

  private async rebuildRendition(settings: ViewerSettings): Promise<void> {
    if (!this.book || !this.container || !this.rendition) return
    const currentCfi: string | undefined = (this.rendition as any).location?.start?.cfi
    try { this.rendition.destroy() } catch { /* Ignore */ }
    this.activeHighlights = []
    const rendition = this.createRendition(settings)
    await rendition.display(currentCfi ? collapseCfiString(currentCfi, true) : undefined).catch(() => rendition.display())
  }

  async applySettings(settings: ViewerSettings): Promise<void> {
    if (!this.rendition) return
    if (settings.viewMode !== this.renderedViewMode) {
      const prev = this.rebuildPromise || Promise.resolve()
      this.rebuildPromise = prev.then(() => (settings.viewMode !== this.renderedViewMode ? this.rebuildRendition(settings) : undefined)).catch(() => undefined)
      await this.rebuildPromise
      return
    }
    this.applyTheme(settings)
    this.rendition.flow(settings.viewMode === 'scroll' ? 'scrolled' : 'paginated')
  }

  private applyTheme(settings: ViewerSettings): void {
    if (!this.rendition) return
    const palette = THEME_PALETTE_MAP[settings.theme] || THEME_PALETTE_MAP.light
    const fontStack = FONT_STACK_MAP[settings.fontFamily] || FONT_STACK_MAP.sans
    this.rendition.themes.default({
      body: { 'background-color': `${palette.bg} !important`, color: `${palette.fg} !important`, 'font-family': `${fontStack} !important`, 'font-size': `${settings.fontSize}px !important`, 'line-height': `${settings.lineHeight} !important`, padding: `12px ${settings.pageMargin}px !important` },
      p: { 'font-family': `${fontStack} !important`, 'line-height': `${settings.lineHeight} !important`, color: `${palette.fg} !important` },
      a: { color: `${palette.link} !important` }
    })
  }

  async next(): Promise<void> { await this.rendition?.next() }
  async prev(): Promise<void> { await this.rendition?.prev() }
  scrollByScreen(direction: 1 | -1): void {
    const el: HTMLElement | undefined = (this.rendition as any)?.manager?.container
    el?.scrollBy({ top: direction * el.clientHeight * 0.85, behavior: 'smooth' })
  }

  async goTo(target: string): Promise<void> {
    if (!this.rendition || !target) return
    const normalized = target.startsWith('epubcfi(') ? collapseCfiString(target, true) : resolveTargetHref(this.book, this.tocList, target)
    try { await this.rendition.display(normalized) } catch (err) {
      const sectionOnly = normalized.startsWith('epubcfi(') ? '' : normalized.split('#')[0]
      if (!sectionOnly || sectionOnly === normalized) throw err
      await this.rendition.display(sectionOnly)
    }
  }

  async goToPercentage(percentage: number): Promise<void> {
    if (!this.book || !this.rendition) return
    const clamped = Math.max(0, Math.min(100, percentage))
    if (this.sectionMetrics.length === 0) this.sectionMetrics = buildSectionMetrics(this.book)
    if (this.sectionMetrics.length === 0) return
    if (clamped <= 0) { await this.rendition.display(this.sectionMetrics[0].href); return }
    if (clamped >= 100) {
      const lastMetric = this.sectionMetrics[this.sectionMetrics.length - 1]
      const target = lastMetric.locations.length > 0 ? collapseCfiString(lastMetric.locations[lastMetric.locations.length - 1], false) : lastMetric.href
      await this.rendition.display(target); return
    }
    const targetRatio = clamped / 100
    const metric = this.sectionMetrics.find((m) => targetRatio >= m.startRatio && targetRatio < m.endRatio) || this.sectionMetrics[this.sectionMetrics.length - 1]
    const span = Math.max(0.0001, metric.endRatio - metric.startRatio)
    const localRatio = Math.max(0, Math.min(0.999, (targetRatio - metric.startRatio) / span))
    if (metric.locations.length > 1 && localRatio > 0.02) {
      const locIdx = Math.min(metric.locations.length - 1, Math.max(0, Math.floor(localRatio * metric.locations.length)))
      await this.rendition.display(collapseCfiString(metric.locations[locIdx], true))
    } else {
      await this.rendition.display(metric.href)
    }
  }

  highlightSearchResult(locator: string): void { this.highlightSearchCfi(locator) }
  highlightSearchCfi(cfi: string): void {
    if (!this.rendition) return
    for (const oldCfi of this.activeHighlights) { try { this.rendition.annotations.remove(oldCfi, 'highlight') } catch { /* Ignore */ } }
    this.activeHighlights = []
    if (cfi && cfi.startsWith('epubcfi(')) {
      try {
        this.rendition.annotations.highlight(cfi, {}, undefined, 'easyviewer-epub-highlight', { fill: '#facc15', 'fill-opacity': '0.45', 'mix-blend-mode': 'multiply' })
        this.activeHighlights.push(cfi)
      } catch { /* Ignore */ }
    }
  }

  async search(query: string, maxResults = 100): Promise<SearchResultItem[]> {
    const keyword = query.trim()
    if (!this.book || !keyword) return []
    const results: SearchResultItem[] = []
    for (const item of this.book.spine.spineItems || []) {
      try {
        await item.load(this.book.load.bind(this.book))
        const matches = item.find(keyword) || []
        const chapterTitle = findChapterLabelByHref(this.tocList, item.href, item.index)
        for (let i = 0; i < matches.length; i++) {
          results.push({ id: `epub-hit-${item.index}-${i}`, locator: matches[i].cfi, excerpt: matches[i].excerpt?.trim() || keyword, chapterTitle, percentage: computeCfiPercentage(this.sectionMetrics, this.cfiHelper, matches[i].cfi, item.index) })
          if (results.length >= maxResults) { item.unload(); return results }
        }
        item.unload()
      } catch { /* Continue */ }
    }
    return results
  }

  destroy(): void {
    this.activeAbortController?.abort()
    this.activeAbortController = null
    try { this.rendition?.destroy() } catch { /* Ignore */ }
    try { this.book?.destroy() } catch { /* Ignore */ }
    this.rendition = null
    this.book = null
    this.container?.removeEventListener('scroll', this.tapController.handleContainerScroll, { capture: true })
    this.container = null
    this.tapController.reset()
    this.renderedViewMode = null
    this.rebuildPromise = null
    this.locationsReady = false
    this.sectionMetrics = []
    this.activeHighlights = []
  }
}

export { extractEpubMetadata } from './metadataExtractor'
