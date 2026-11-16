import type { TxtPage, TxtParagraph } from './txtEngine'
import {
  TXT_PAGE_HEADING_CLASS,
  TXT_PAGE_PARA_CLASS,
  distinctChars,
  preloadFontsForText,
  type Pos
} from './txtLineBox'
import { TxtPageMeasurer } from './txtPageMeasurer'

export { TXT_PAGE_HEADING_CLASS, TXT_PAGE_PARA_CLASS, TxtPageMeasurer, distinctChars, preloadFontsForText }

export interface TxtPaginationState {
  page: TxtPage | null
  pageNumber: number | null
  totalPages: number | null
  progress: number
  hasPrev: boolean
  hasNext: boolean
}

const BG_TICK_MS = 16
const SYNC_WINDOW = 40

/**
 * Paginated TXT reading session with immediate first-page measurement and incremental
 * background indexing.
 */
export class TxtPaginationSession {
  private readonly measurer: TxtPageMeasurer
  private destroyed = false
  private timer: ReturnType<typeof setTimeout> | null = null
  private bgWindow = 60
  private allPages: TxtPage[] | null = null
  private currentIdx = 0
  private pinStart = 0
  private pins: number[] = []
  private bPages: TxtPage[] = []
  private bCursor: Pos = { para: 0, char: 0 }
  private bCursorAbs = 0
  private detached: TxtPage[] = []
  private fPages: TxtPage[] = []
  private fCursor: Pos = { para: 0, char: 0 }
  private fDone = false
  private current: TxtPage | null = null
  private backgroundEnabled: boolean

  constructor(
    _paragraphs: TxtParagraph[],
    private readonly totalLength: number,
    pageEl: HTMLElement,
    targetOffset: number,
    private readonly onChange: (state: TxtPaginationState) => void,
    fallback: () => TxtPage[],
    options: { deferBackground?: boolean } = {}
  ) {
    this.backgroundEnabled = !options.deferBackground
    this.measurer = new TxtPageMeasurer(_paragraphs, totalLength, pageEl)
    if (!this.measurer.valid) {
      this.useIndex(fallback(), targetOffset)
      return
    }
    this.startAt(targetOffset)
  }

  get state(): TxtPaginationState {
    const ready = this.allPages !== null
    const page = this.current
    const progressed =
      this.bCursorAbs + Math.max(0, this.measurer.absOf(this.fCursor) - this.pinStart)
    return {
      page,
      pageNumber: ready ? this.currentIdx + 1 : null,
      totalPages: ready ? this.allPages!.length : null,
      progress: ready ? 1 : Math.min(0.99, progressed / Math.max(1, this.totalLength)),
      hasPrev: !!page && page.startOffset > 0,
      hasNext: !!page && this.measurer.nextStartOf(page) < this.totalLength
    }
  }

  startBackground(): void {
    this.backgroundEnabled = true
    this.schedule()
  }

  get currentStartOffset(): number | null {
    return this.current?.startOffset ?? null
  }

  destroy(): void {
    this.destroyed = true
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
  }

  next(): boolean {
    const page = this.current
    if (!page) return false
    if (this.allPages) {
      if (this.currentIdx >= this.allPages.length - 1) return false
      this.current = this.allPages[++this.currentIdx]
      this.emit()
      return true
    }
    const start = this.measurer.nextStartOf(page)
    if (start >= this.totalLength) return false
    let found = this.findByStart(start)
    while (!found) {
      if (start >= this.pinStart) {
        if (this.fDone) break
        this.stepF(SYNC_WINDOW)
      } else {
        if (this.bCursorAbs >= this.pinStart) break
        this.stepB(SYNC_WINDOW)
      }
      found = this.findByStart(start)
    }
    if (!found) return false
    this.current = found
    this.checkReady()
    this.emit()
    return true
  }

  prev(): boolean {
    const page = this.current
    if (!page || page.startOffset <= 0) return false
    if (this.allPages) {
      if (this.currentIdx <= 0) return false
      this.current = this.allPages[--this.currentIdx]
      this.emit()
      return true
    }
    const s = page.startOffset
    let found = this.findEndingAt(s)
    if (!found) {
      const back = this.measurer.pageEndingAt(s)
      if (!back) return false
      if (back.startOffset <= this.bCursorAbs) {
        while (this.bCursorAbs < s && this.bCursorAbs < this.pinStart) this.stepB(SYNC_WINDOW)
        found = this.findEndingAt(s)
      } else {
        this.addPin(back.startOffset)
        this.detached.unshift(back)
        found = back
      }
    }
    if (!found) return false
    this.current = found
    this.checkReady()
    this.emit()
    return true
  }

  goToOffset(offset: number): void {
    if (this.allPages) {
      this.currentIdx = indexByStart(this.allPages, offset)
      this.current = this.allPages[this.currentIdx]
      this.emit()
      return
    }
    const known = this.findContaining(offset)
    if (known) {
      this.current = known
      this.emit()
      return
    }
    this.startAt(offset)
  }

  private useIndex(pages: TxtPage[], offset: number): void {
    pages.forEach((p, idx) => (p.pageNumber = idx + 1))
    this.allPages = pages
    this.currentIdx = indexByStart(pages, offset)
    this.current = pages[this.currentIdx] ?? null
    this.emit()
  }

  private startAt(targetOffset: number): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    const clamped = Math.max(0, Math.min(targetOffset, Math.max(0, this.totalLength - 1)))
    const p = this.measurer.snapToLineStart(clamped)
    this.allPages = null
    this.pinStart = p
    this.pins = [p]
    this.bPages = []
    this.bCursor = { para: 0, char: 0 }
    this.bCursorAbs = 0
    this.detached = []
    this.fPages = []
    this.fCursor = this.measurer.posOf(p)
    this.fDone = false
    this.stepF(SYNC_WINDOW)
    this.current = this.fPages[0] ?? null
    this.checkReady()
    this.emit()
    this.schedule()
  }

  private addPin(offset: number): void {
    this.pins.push(offset)
    this.pins.sort((a, b) => a - b)
  }

  private stepB(windowSize: number): void {
    if (this.bCursorAbs >= this.pinStart) return
    const stop = this.pins.find((pin) => pin > this.bCursorAbs) ?? this.pinStart
    const res = this.measurer.step(this.bCursor, stop, windowSize)
    this.bPages.push(...res.pages)
    this.bCursor = res.next
    this.bCursorAbs = this.measurer.absOf(res.next)
    while (this.detached.length && this.detached[0].startOffset < this.bCursorAbs) {
      this.detached.shift()
    }
  }

  private stepF(windowSize: number): void {
    if (this.fDone) return
    const res = this.measurer.step(this.fCursor, null, windowSize)
    this.fPages.push(...res.pages)
    this.fCursor = res.next
    if (res.atEnd) this.fDone = true
  }

  private checkReady(): void {
    if (this.allPages || this.bCursorAbs < this.pinStart || !this.fDone) return
    const pages = this.bPages.concat(this.fPages)
    pages.forEach((p, idx) => (p.pageNumber = idx + 1))
    if (pages.length) pages[pages.length - 1].percentage = 100
    this.allPages = pages
    const start = this.current?.startOffset ?? this.pinStart
    this.currentIdx = indexByStart(pages, start)
    this.current = pages[this.currentIdx] ?? null
    this.bPages = []
    this.fPages = []
    this.detached = []
  }

  private findByStart(start: number): TxtPage | null {
    return findIn(this.bPages, start) ?? this.detached.find((p) => p.startOffset === start) ?? findIn(this.fPages, start)
  }

  private findEndingAt(start: number): TxtPage | null {
    for (const pages of [this.bPages, this.detached, this.fPages]) {
      for (let k = pages.length - 1; k >= 0; k--) {
        const p = pages[k]
        if (p.startOffset < start && this.measurer.nextStartOf(p) === start) return p
        if (p.startOffset < start) break
      }
    }
    return null
  }

  private findContaining(offset: number): TxtPage | null {
    for (const pages of [this.bPages, this.detached, this.fPages]) {
      if (!pages.length) continue
      const p = pages[indexByStart(pages, offset)]
      if (p.startOffset <= offset && offset < this.measurer.nextStartOf(p)) return p
    }
    return null
  }

  private schedule(): void {
    if (this.timer || this.allPages || this.destroyed || !this.backgroundEnabled) return
    this.timer = setTimeout(() => {
      this.timer = null
      if (this.destroyed || this.allPages) return
      const t0 = performance.now()
      if (this.bCursorAbs < this.pinStart) this.stepB(this.bgWindow)
      else if (!this.fDone) this.stepF(this.bgWindow)
      const elapsed = performance.now() - t0
      if (elapsed > 0) this.bgWindow = Math.round(Math.max(20, Math.min(800, (this.bgWindow * BG_TICK_MS) / elapsed)))
      this.checkReady()
      this.emit()
      this.schedule()
    }, 0)
  }

  private emit(): void {
    if (!this.destroyed) this.onChange(this.state)
  }
}

function findIn(pages: TxtPage[], start: number): TxtPage | null {
  if (!pages.length) return null
  const p = pages[indexByStart(pages, start)]
  return p && p.startOffset === start ? p : null
}

function indexByStart(pages: TxtPage[], offset: number): number {
  let low = 0
  let high = pages.length - 1
  while (low < high) {
    const mid = (low + high + 1) >>> 1
    if (pages[mid].startOffset <= offset) low = mid
    else high = mid - 1
  }
  return Math.max(0, low)
}
