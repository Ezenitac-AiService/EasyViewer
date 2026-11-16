import { computed, nextTick, ref, shallowRef, watch, type Ref } from 'vue'
import type { TocItem, ViewerSettings } from '@/types'
import {
  detectAndDecodeText,
  paginateTxtDocument,
  parseOffsetLocator,
  parseTxtDocument,
  type TxtParagraph
} from '@/engines/txt/txtEngine'
import {
  distinctChars,
  preloadFontsForText,
  TxtPaginationSession,
  type TxtPaginationState
} from '@/engines/txt/txtMeasuredPagination'

export interface TxtControllerOptions {
  bookId: Ref<string>
  isTxtBook: Ref<boolean>
  settings: Ref<ViewerSettings>
  fontFamilyCss: Ref<string>
  tocItems: Ref<TocItem[]>
  scrollContainerRef: Ref<HTMLElement | null>
  paginatedViewportRef: Ref<HTMLElement | null>
  pageContentRef: Ref<HTMLElement | null>
  onLocationChange: (locator: string, percentage: number, chapterTitle: string) => void
}

const VIRTUAL_OVERSCAN = 35

/**
 * Manages TXT document decoding, virtualized scroll measurement, and background pagination.
 */
export function useTxtReaderController(options: TxtControllerOptions) {
  const txtEncoding = ref('UTF-8')
  const txtParagraphs = shallowRef<TxtParagraph[]>([])
  const txtTotalLength = ref(1)
  const viewportSize = ref({ width: 900, height: 680 })
  const txtPageState = shallowRef<TxtPaginationState>({
    page: null,
    pageNumber: null,
    totalPages: null,
    progress: 0,
    hasPrev: false,
    hasNext: false
  })
  const txtCurrentPage = computed(() => txtPageState.value.page)

  let txtSession: TxtPaginationSession | null = null
  let txtPaginationGen = 0
  let txtCharsCache: { paragraphs: TxtParagraph[]; chars: string } | null = null
  let txtParaOffsets = new Float64Array(0)
  let txtParaHeights = new Float64Array(0)
  let isMeasuringTxt = false
  let txtNavigating = false
  let layoutRafId: number | null = null

  const virtualMetricsVersion = ref(0)
  const virtualTotalHeight = ref(0)
  const virtualStartIdx = ref(0)
  const virtualEndIdx = ref(80)

  const virtualVisibleParagraphs = computed(() =>
    txtParagraphs.value.slice(virtualStartIdx.value, virtualEndIdx.value)
  )
  const virtualTopSpacerPx = computed(() =>
    virtualMetricsVersion.value >= 0 ? txtParaOffsets[virtualStartIdx.value] || 0 : 0
  )
  const virtualBottomSpacerPx = computed(() => {
    void virtualMetricsVersion.value
    const endOffset = txtParaOffsets[virtualEndIdx.value] ?? virtualTotalHeight.value
    return Math.max(0, virtualTotalHeight.value - endOffset)
  })

  function findChapter(offset: number): string {
    let active = '본문'
    for (const item of options.tocItems.value) {
      if (parseOffsetLocator(item.href) <= offset) active = item.label
      else break
    }
    return active
  }

  function findParaAtY(y: number): number {
    const n = txtParagraphs.value.length
    if (n <= 1 || y <= 0) return 0
    let low = 0
    let high = n - 1
    while (low < high) {
      const mid = (low + high + 1) >>> 1
      if (txtParaOffsets[mid] <= y) low = mid
      else high = mid - 1
    }
    return low
  }

  function findParaByOffset(charOffset: number): number {
    const paras = txtParagraphs.value
    const n = paras.length
    if (n <= 1 || charOffset <= 0) return 0
    let low = 0
    let high = n - 1
    while (low < high) {
      const mid = (low + high + 1) >>> 1
      if (paras[mid].startOffset <= charOffset) low = mid
      else high = mid - 1
    }
    return low
  }

  function recalculateVirtualMetrics(): void {
    const paras = txtParagraphs.value
    const n = paras.length
    const offsets = new Float64Array(n + 1)
    if (n === 0) {
      txtParaOffsets = offsets
      virtualTotalHeight.value = 0
      virtualStartIdx.value = 0
      virtualEndIdx.value = 0
      virtualMetricsVersion.value++
      return
    }
    const maxW = Math.min(viewportSize.value.width || 880, 896)
    const usableW = Math.max(200, maxW - options.settings.value.pageMargin * 2)
    const fs = options.settings.value.fontSize
    const linePx = fs * options.settings.value.lineHeight
    const charsPerLine = Math.max(12, Math.floor(usableW / (fs * 0.92)))
    const heights = new Float64Array(n)
    let y = 0
    for (let i = 0; i < n; i++) {
      offsets[i] = y
      const p = paras[i]
      const lines = p.text.length === 0 ? 1 : Math.ceil(p.text.length / charsPerLine)
      const h = lines * linePx + 12 + (p.isHeading ? 36 : 0)
      heights[i] = h
      y += h
    }
    offsets[n] = y
    txtParaHeights = heights
    txtParaOffsets = offsets
    virtualTotalHeight.value = y
    virtualMetricsVersion.value++
  }

  async function measureRenderedParagraphs(): Promise<boolean> {
    if (isMeasuringTxt) return false
    const container = options.scrollContainerRef.value
    const n = txtParagraphs.value.length
    if (!container || n === 0 || txtParaHeights.length !== n) return false
    const start = virtualStartIdx.value
    const end = virtualEndIdx.value
    if (end - start < 2) return false
    isMeasuringTxt = true
    try {
      let changed = false
      const newHeights = txtParaHeights.slice()
      let prevTop = -1
      let prevIdx = -1
      for (let i = start; i < end; i++) {
        const el = document.getElementById(`txt-para-${i}`)
        if (!el) { prevIdx = -1; continue }
        const top = el.offsetTop
        if (prevIdx >= 0 && prevIdx === i - 1) {
          const h = top - prevTop
          if (h > 0 && Math.abs(h - newHeights[prevIdx]) > 0.5) {
            newHeights[prevIdx] = h
            changed = true
          }
        }
        prevTop = top
        prevIdx = i
      }
      if (!changed) return false
      const oldOffsets = txtParaOffsets
      const scrollTop = container.scrollTop
      const anchor = findParaAtY(scrollTop)
      const anchorDelta = scrollTop - (oldOffsets[anchor] || 0)
      const offsets = new Float64Array(n + 1)
      let y = 0
      for (let i = 0; i < n; i++) { offsets[i] = y; y += newHeights[i] }
      offsets[n] = y
      txtParaHeights = newHeights
      txtParaOffsets = offsets
      virtualTotalHeight.value = y
      virtualMetricsVersion.value++
      await nextTick()
      if (scrollTop > 0 && !txtNavigating) container.scrollTop = Math.round(offsets[anchor] + anchorDelta)
      return true
    } finally {
      isMeasuringTxt = false
    }
  }

  watch([virtualStartIdx, virtualEndIdx, virtualMetricsVersion], () => measureRenderedParagraphs(), { flush: 'post' })

  function updateVirtualWindow(scrollTop: number, force = false): void {
    const n = txtParagraphs.value.length
    if (n === 0) { virtualStartIdx.value = 0; virtualEndIdx.value = 0; return }
    const first = findParaAtY(scrollTop)
    const last = findParaAtY(scrollTop + (viewportSize.value.height || 700))
    const nextStart = Math.max(0, first - VIRTUAL_OVERSCAN)
    const nextEnd = Math.min(n, last + VIRTUAL_OVERSCAN + 1)
    if (force || Math.abs(nextStart - virtualStartIdx.value) >= 8 || Math.abs(nextEnd - virtualEndIdx.value) >= 8) {
      virtualStartIdx.value = nextStart
      virtualEndIdx.value = nextEnd
    }
  }

  async function scrollToOffset(offset: number): Promise<void> {
    const n = txtParagraphs.value.length
    if (n === 0) return
    if (txtParaOffsets.length !== n + 1) recalculateVirtualMetrics()
    const targetIdx = findParaByOffset(offset)
    txtNavigating = true
    try {
      for (let pass = 0; pass < 4; pass++) {
        virtualStartIdx.value = Math.max(0, targetIdx - VIRTUAL_OVERSCAN)
        virtualEndIdx.value = Math.min(n, targetIdx + VIRTUAL_OVERSCAN + 25)
        await nextTick()
        while (isMeasuringTxt) await nextTick()
        const container = options.scrollContainerRef.value
        if (!container) return
        const changed = await measureRenderedParagraphs()
        container.scrollTop = Math.round(txtParaOffsets[targetIdx] || 0)
        if (!changed) break
      }
      if (options.scrollContainerRef.value) updateVirtualWindow(options.scrollContainerRef.value.scrollTop, true)
    } finally {
      txtNavigating = false
    }
  }

  function handleScroll(): void {
    if (!options.isTxtBook.value || options.settings.value.viewMode !== 'scroll') return
    const c = options.scrollContainerRef.value
    if (!c) return
    updateVirtualWindow(c.scrollTop)
    const para = txtParagraphs.value[findParaAtY(c.scrollTop)]
    const offset = para ? para.startOffset : 0
    const pct = Math.round(Math.max(0, Math.min(1, c.scrollTop / Math.max(1, c.scrollHeight - c.clientHeight))) * 1000) / 10
    options.onLocationChange(`offset:${offset}`, pct, findChapter(offset))
  }

  function createSession(offset: number, deferBg: boolean): TxtPaginationSession | null {
    const el = options.pageContentRef.value
    if (!el) return null
    return new TxtPaginationSession(
      txtParagraphs.value,
      txtTotalLength.value,
      el,
      offset,
      (s) => { txtPageState.value = s },
      () => paginateTxtDocument(txtParagraphs.value, txtTotalLength.value, {
        containerWidth: viewportSize.value.width,
        containerHeight: viewportSize.value.height,
        fontSize: options.settings.value.fontSize,
        lineHeight: options.settings.value.lineHeight,
        pageMargin: options.settings.value.pageMargin
      }),
      { deferBackground: deferBg }
    )
  }

  function syncPaginatedLocation(): void {
    const page = txtCurrentPage.value
    if (!options.isTxtBook.value || options.settings.value.viewMode !== 'paginated' || !page) return
    options.onLocationChange(`offset:${page.startOffset}`, page.percentage, findChapter(page.startOffset))
  }

  function recalculatePages(targetOffset = 0): void {
    if (!options.isTxtBook.value) return
    txtSession?.destroy()
    const gen = ++txtPaginationGen
    if (txtCharsCache?.paragraphs !== txtParagraphs.value) {
      txtCharsCache = { paragraphs: txtParagraphs.value, chars: distinctChars(txtParagraphs.value) }
    }
    const fontsReady = preloadFontsForText(options.fontFamilyCss.value, options.settings.value.fontSize, txtCharsCache.chars)
    txtSession = createSession(targetOffset, true)
    syncPaginatedLocation()
    void fontsReady.then((changed) => {
      if (gen !== txtPaginationGen || !txtSession) return
      if (!changed) { txtSession.startBackground(); return }
      const start = txtSession.currentStartOffset ?? targetOffset
      txtSession.destroy()
      txtSession = createSession(start, false)
      syncPaginatedLocation()
    })
  }

  function goToOffset(offset: number): Promise<void> {
    if (options.settings.value.viewMode === 'paginated') {
      if (!txtSession) recalculatePages(offset)
      else { txtSession.goToOffset(offset); syncPaginatedLocation() }
      return Promise.resolve()
    }
    return scrollToOffset(offset)
  }

  function updateViewport(): void {
    const el = options.paginatedViewportRef.value || options.scrollContainerRef.value
    if (el) viewportSize.value = { width: el.clientWidth || 880, height: el.clientHeight || 660 }
  }

  async function loadBuffer(buffer: ArrayBuffer, initialLocator: string): Promise<TocItem[]> {
    const decoded = detectAndDecodeText(buffer)
    txtEncoding.value = decoded.encoding
    const parsed = parseTxtDocument(decoded.text)
    txtParagraphs.value = parsed.paragraphs
    txtTotalLength.value = parsed.totalLength
    return parsed.toc
  }

  async function mountInitialView(initialLocator: string): Promise<void> {
    await nextTick()
    updateViewport()
    const offset = parseOffsetLocator(initialLocator)
    if (options.settings.value.viewMode === 'scroll') { recalculateVirtualMetrics(); await scrollToOffset(offset) }
    else recalculatePages(offset)
  }

  function scheduleLayoutUpdate(offset: number): void {
    if (layoutRafId !== null) cancelAnimationFrame(layoutRafId)
    layoutRafId = requestAnimationFrame(async () => {
      layoutRafId = null
      updateViewport()
      if (options.settings.value.viewMode === 'paginated') recalculatePages(offset)
      else { txtSession?.destroy(); txtSession = null; recalculateVirtualMetrics(); await scrollToOffset(offset) }
    })
  }

  function prev(): void {
    if (options.settings.value.viewMode === 'paginated') { if (txtSession?.prev()) syncPaginatedLocation() }
    else options.scrollContainerRef.value?.scrollBy({ top: -options.scrollContainerRef.value.clientHeight * 0.85, behavior: 'smooth' })
  }

  function next(): void {
    if (options.settings.value.viewMode === 'paginated') { if (txtSession?.next()) syncPaginatedLocation() }
    else options.scrollContainerRef.value?.scrollBy({ top: options.scrollContainerRef.value.clientHeight * 0.85, behavior: 'smooth' })
  }

  function destroy(): void {
    if (layoutRafId !== null) cancelAnimationFrame(layoutRafId)
    layoutRafId = null
    txtSession?.destroy()
    txtSession = null
  }

  return {
    txtEncoding,
    txtParagraphs,
    txtTotalLength,
    txtPageState,
    txtCurrentPage,
    virtualVisibleParagraphs,
    virtualTopSpacerPx,
    virtualBottomSpacerPx,
    loadBuffer,
    mountInitialView,
    handleScroll,
    goToOffset,
    updateViewport,
    scheduleLayoutUpdate,
    prev,
    next,
    destroy
  }
}
