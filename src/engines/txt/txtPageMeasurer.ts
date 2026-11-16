import type { TxtPage, TxtPageFragment, TxtParagraph } from './txtEngine'
import { renderMeasureWindow, type MeasureWindow, type Pos } from './txtLineBox'

export interface StepResult {
  pages: TxtPage[]
  next: Pos
  atEnd: boolean
  atStop: boolean
}

/**
 * Measures TXT pages against the real layout of the page element using line boxes.
 */
export class TxtPageMeasurer {
  readonly valid: boolean
  private readonly contentWidth: number
  private readonly pageHeight: number
  private readonly n: number
  private measurerEl: HTMLDivElement | null = null
  private range: Range | null = null

  constructor(
    private readonly paragraphs: TxtParagraph[],
    readonly totalLength: number,
    private readonly pageEl: HTMLElement
  ) {
    const cs = getComputedStyle(pageEl)
    this.contentWidth =
      pageEl.clientWidth - parseFloat(cs.paddingLeft || '0') - parseFloat(cs.paddingRight || '0')
    this.pageHeight =
      pageEl.clientHeight - parseFloat(cs.paddingTop || '0') - parseFloat(cs.paddingBottom || '0')
    this.n = paragraphs.length
    this.valid = this.contentWidth >= 40 && this.pageHeight >= 40 && this.n > 0
  }

  posOf(offset: number): Pos {
    const paras = this.paragraphs
    if (offset >= this.totalLength || this.n === 0) return { para: this.n, char: 0 }
    let low = 0
    let high = this.n - 1
    while (low < high) {
      const mid = (low + high + 1) >>> 1
      if (paras[mid].startOffset <= offset) low = mid
      else high = mid - 1
    }
    const para = paras[low]
    const char = Math.max(0, offset - para.startOffset)
    if (char > 0 && char >= para.text.length) return { para: low + 1, char: 0 }
    return { para: low, char }
  }

  absOf(pos: Pos): number {
    if (pos.para >= this.n) return this.totalLength
    return this.paragraphs[pos.para].startOffset + pos.char
  }

  nextStartOf(page: TxtPage): number {
    const last = page.paragraphs[page.paragraphs.length - 1]
    if (!last) return page.endOffset
    const para = this.paragraphs[last.index]
    if (para && last.endOffset < para.endOffset) return last.endOffset
    return para ? Math.min(this.totalLength, para.endOffset + 1) : last.endOffset
  }

  private attach(): void {
    if (this.measurerEl) return
    const el = document.createElement('div')
    el.setAttribute('aria-hidden', 'true')
    el.style.cssText = [
      'position:absolute',
      'left:0',
      'top:0',
      `width:${this.contentWidth}px`,
      'padding:0',
      'margin:0',
      'border:0',
      'visibility:hidden',
      'pointer-events:none',
      'contain:layout style'
    ].join(';')
    this.pageEl.appendChild(el)
    this.measurerEl = el
    this.range = document.createRange()
  }

  private detach(): void {
    this.measurerEl?.remove()
    this.measurerEl = null
    this.range = null
  }

  private withMeasurer<T>(fn: () => T): T {
    this.attach()
    try {
      return fn()
    } finally {
      this.detach()
    }
  }

  private renderWindow(from: Pos, toParaExcl: number, lastChar = -1): MeasureWindow {
    return renderMeasureWindow(
      this.measurerEl!,
      this.range!,
      this.paragraphs,
      from,
      toParaExcl,
      lastChar
    )
  }

  private buildPage(from: Pos, to: Pos): TxtPage {
    const fragments: TxtPageFragment[] = []
    const lastPara = Math.min(to.para, this.n - 1)
    for (let p = from.para; p <= lastPara; p++) {
      const para = this.paragraphs[p]
      const start = p === from.para ? from.char : 0
      let end = para.text.length
      if (p === to.para) {
        if (to.char === 0) break
        end = to.char
      }
      fragments.push({
        index: para.index,
        text: para.text.slice(start, end),
        startOffset: para.startOffset + start,
        endOffset: para.startOffset + end,
        isHeading: para.isHeading,
        continued: start > 0
      })
    }
    const startOffset = fragments.length ? fragments[0].startOffset : this.absOf(from)
    const endOffset = fragments.length ? fragments[fragments.length - 1].endOffset : startOffset
    return {
      pageNumber: 0,
      paragraphs: fragments,
      startOffset,
      endOffset,
      percentage:
        to.para >= this.n
          ? 100
          : Math.min(100, Math.round((endOffset / Math.max(1, this.totalLength)) * 1000) / 10)
    }
  }

  step(from: Pos, stopOffset: number | null, windowSize: number): StepResult {
    return this.withMeasurer(() => {
      let size = Math.max(8, windowSize)
      for (;;) {
        const res = this.stepOnce(from, stopOffset, size)
        if (res.pages.length > 0 || res.atEnd || res.atStop) return res
        size *= 2
      }
    })
  }

  private stepOnce(from: Pos, stopOffset: number | null, windowSize: number): StepResult {
    const pages: TxtPage[] = []
    if (from.para >= this.n) return { pages, next: from, atEnd: true, atStop: false }
    const stop = stopOffset !== null && stopOffset > this.absOf(from) ? stopOffset : null
    const stopPos = stop !== null ? this.posOf(stop) : null
    const winEnd = Math.min(this.n, from.para + windowSize)
    const w = this.renderWindow(from, winEnd)
    const H = this.pageHeight
    const posAt = (k: number, char: number): Pos => ({ para: from.para + k, char })

    const emit = (end: Pos, start: Pos): boolean => {
      if (stop !== null && stop <= this.absOf(end)) {
        pages.push(this.buildPage(start, stopPos!))
        return true
      }
      pages.push(this.buildPage(start, end))
      return false
    }

    let i = 0
    let char = from.char
    let pageTop = 0
    while (i < w.els.length) {
      const limit = pageTop + H
      let j = i
      while (j < w.els.length && w.bottoms[j] <= limit + 0.5) j++
      if (j === w.els.length) {
        const windowEnd: Pos = { para: winEnd, char: 0 }
        if (winEnd === this.n) {
          const cut = emit(windowEnd, posAt(i, char))
          return cut ? { pages, next: stopPos!, atEnd: false, atStop: true } : { pages, next: windowEnd, atEnd: true, atStop: false }
        }
        if (stop !== null && stop <= this.absOf(windowEnd)) {
          emit(windowEnd, posAt(i, char))
          return { pages, next: stopPos!, atEnd: false, atStop: true }
        }
        return { pages, next: posAt(i, char), atEnd: false, atStop: false }
      }

      const lines = w.lineBoxes(j)
      let firstLine = 0
      while (firstLine < lines.length && lines[firstLine].top < pageTop - 1) firstLine++
      let fit = firstLine
      while (fit < lines.length && lines[fit].bottom <= limit + 0.5) fit++

      let end: Pos
      let nextTop: number
      if (fit === firstLine && j > i) {
        end = posAt(j, 0)
        nextTop = w.tops[j] - w.marginTop(j)
      } else {
        if (fit === firstLine) fit = firstLine + 1
        if (fit >= lines.length) {
          end = posAt(j + 1, 0)
          nextTop = j + 1 < w.els.length ? w.tops[j + 1] - w.marginTop(j + 1) : w.bottoms[j]
        } else {
          const base = j === 0 ? from.char : 0
          const splitChar = base + w.charAtLine(j, lines, fit)
          if (j === i && splitChar <= char) {
            end = posAt(j + 1, 0)
            nextTop = j + 1 < w.els.length ? w.tops[j + 1] - w.marginTop(j + 1) : w.bottoms[j]
          } else {
            end = posAt(j, splitChar)
            nextTop = (lines[fit - 1].bottom + lines[fit].top) / 2
          }
        }
      }
      if (emit(end, posAt(i, char))) return { pages, next: stopPos!, atEnd: false, atStop: true }
      i = end.para - from.para
      char = end.char
      pageTop = nextTop
    }
    return { pages, next: { para: winEnd, char: 0 }, atEnd: winEnd >= this.n, atStop: false }
  }

  pageEndingAt(endOffset: number): TxtPage | null {
    if (endOffset <= 0) return null
    const end = this.posOf(endOffset)
    const lastPara = end.char > 0 ? end.para : end.para - 1
    if (lastPara < 0) return null
    const lastChar = end.char > 0 ? end.char : -1

    return this.withMeasurer(() => {
      let count = 40
      for (;;) {
        const p0 = Math.max(0, lastPara - count + 1)
        const w = this.renderWindow({ para: p0, char: 0 }, lastPara + 1, lastChar)
        const last = w.els.length - 1
        const lastLines = w.lineBoxes(last)
        const threshold = lastLines[lastLines.length - 1].bottom - this.pageHeight - 0.5
        if (w.tops[0] - w.marginTop(0) < threshold || p0 === 0) {
          let start: Pos | null = w.tops[0] - w.marginTop(0) >= threshold ? { para: p0, char: 0 } : null
          for (let k = 0; !start && k <= last; k++) {
            if (w.tops[k] - w.marginTop(k) >= threshold) { start = { para: p0 + k, char: 0 }; break }
            if (w.bottoms[k] <= threshold) continue
            const lines = k === last ? lastLines : w.lineBoxes(k)
            for (let l = 1; l < lines.length; l++) {
              if ((lines[l - 1].bottom + lines[l].top) / 2 >= threshold) {
                start = { para: p0 + k, char: w.charAtLine(k, lines, l) }
                break
              }
            }
          }
          if (!start || this.absOf(start) >= endOffset) {
            start = { para: lastPara, char: w.charAtLine(last, lastLines, lastLines.length - 1) }
          }
          return this.buildPage(start, end)
        }
        count *= 2
      }
    })
  }

  snapToLineStart(offset: number): number {
    const pos = this.posOf(offset)
    if (pos.para >= this.n || pos.char === 0) return this.absOf(pos)
    return this.withMeasurer(() => {
      const w = this.renderWindow({ para: pos.para, char: 0 }, pos.para + 1)
      const lines = w.lineBoxes(0)
      const line = w.lineOfChar(0, lines, pos.char)
      return this.absOf({ para: pos.para, char: w.charAtLine(0, lines, line) })
    })
  }
}
