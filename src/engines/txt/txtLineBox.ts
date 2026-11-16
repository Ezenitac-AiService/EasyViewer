import type { TxtParagraph } from './txtEngine'

/**
 * Layout-affecting classes of a paragraph on a TXT page. The page template and the off-screen
 * measurer must use exactly the same ones, otherwise the measured line breaks won't match what
 * is displayed.
 */
export const TXT_PAGE_PARA_CLASS = 'mb-2.5 break-words'
export const TXT_PAGE_HEADING_CLASS = 'font-bold text-[1.15em] mt-2 mb-2'

export interface Pos {
  para: number
  char: number
}

export interface LineBox {
  top: number
  bottom: number
}

export interface MeasureWindow {
  els: HTMLParagraphElement[]
  tops: number[]
  bottoms: number[]
  marginTop(k: number): number
  lineBoxes(k: number): LineBox[]
  charAtLine(k: number, lines: LineBox[], lineIdx: number): number
  lineOfChar(k: number, lines: LineBox[], c: number): number
}

export function renderMeasureWindow(
  measurer: HTMLDivElement,
  range: Range,
  paragraphs: TxtParagraph[],
  from: Pos,
  toParaExcl: number,
  lastChar = -1
): MeasureWindow {
  measurer.textContent = ''
  const els: HTMLParagraphElement[] = []
  const frag = document.createDocumentFragment()
  for (let p = from.para; p < toParaExcl; p++) {
    const para = paragraphs[p]
    const el = document.createElement('p')
    el.className = para.isHeading
      ? `${TXT_PAGE_PARA_CLASS} ${TXT_PAGE_HEADING_CLASS}`
      : TXT_PAGE_PARA_CLASS
    let text = para.text
    if (p === toParaExcl - 1 && lastChar >= 0) text = text.slice(0, lastChar)
    if (p === from.para && from.char > 0) {
      text = text.slice(from.char)
      el.style.marginTop = '0'
    }
    el.textContent = text || '\u00a0'
    frag.appendChild(el)
    els.push(el)
  }
  measurer.appendChild(frag)

  const originTop = measurer.getBoundingClientRect().top
  const tops: number[] = []
  const bottoms: number[] = []
  for (const el of els) {
    const r = el.getBoundingClientRect()
    tops.push(r.top - originTop)
    bottoms.push(r.bottom - originTop)
  }
  const marginCache = new Map<string, number>()
  const marginTop = (k: number): number => {
    const el = els[k]
    if (el.style.marginTop === '0') return 0
    let v = marginCache.get(el.className)
    if (v === undefined) {
      v = parseFloat(getComputedStyle(el).marginTop) || 0
      marginCache.set(el.className, v)
    }
    return v
  }
  const lineBoxes = (k: number): LineBox[] => {
    range.selectNodeContents(els[k])
    const lines: LineBox[] = []
    for (const r of Array.from(range.getClientRects())) {
      if (r.height <= 0) continue
      const top = r.top - originTop
      const bottom = r.bottom - originTop
      const last = lines[lines.length - 1]
      if (last && top < last.bottom - 1) {
        last.top = Math.min(last.top, top)
        last.bottom = Math.max(last.bottom, bottom)
      } else {
        lines.push({ top, bottom })
      }
    }
    return lines.length > 0 ? lines : [{ top: tops[k], bottom: bottoms[k] }]
  }
  const charTop = (k: number, c: number): number => {
    const node = els[k].firstChild
    if (!node) return Infinity
    const len = node.textContent?.length ?? 0
    for (let i = c; i < len; i++) {
      range.setStart(node, i)
      range.setEnd(node, i + 1)
      const r = range.getBoundingClientRect()
      if (r.height > 0) return r.top - originTop
    }
    return Infinity
  }
  const charAtLine = (k: number, lines: LineBox[], lineIdx: number): number => {
    const node = els[k].firstChild
    if (!node || lineIdx <= 0) return 0
    const text = node.textContent || ''
    const threshold = lines[lineIdx].top - 1
    let lo = 0
    let hi = text.length
    while (lo < hi) {
      const mid = (lo + hi) >>> 1
      if (charTop(k, mid) >= threshold) hi = mid
      else lo = mid + 1
    }
    if (lo > 0 && lo < text.length) {
      const code = text.charCodeAt(lo)
      if (code >= 0xdc00 && code <= 0xdfff) lo--
    }
    return lo
  }
  const lineOfChar = (k: number, lines: LineBox[], c: number): number => {
    const top = charTop(k, c)
    let idx = 0
    for (let l = 0; l < lines.length; l++) if (lines[l].top <= top + 1) idx = l
    return idx
  }
  return { els, tops, bottoms, marginTop, lineBoxes, charAtLine, lineOfChar }
}

export function distinctChars(paragraphs: TxtParagraph[]): string {
  const seen = new Set<string>()
  for (const p of paragraphs) for (const ch of p.text) seen.add(ch)
  return Array.from(seen).join('')
}

export function preloadFontsForText(
  fontFamily: string,
  fontSizePx: number,
  chars: string
): Promise<boolean> {
  const fonts = typeof document !== 'undefined' ? document.fonts : undefined
  if (!fonts?.load || !chars) return Promise.resolve(false)
  const loadedCount = () => {
    let n = 0
    fonts.forEach((f) => {
      if (f.status === 'loaded') n++
    })
    return n
  }
  const before = loadedCount()
  const changed = () => loadedCount() > before
  return Promise.all([
    fonts.load(`${fontSizePx}px ${fontFamily}`, chars),
    fonts.load(`bold ${Math.round(fontSizePx * 1.15)}px ${fontFamily}`, chars)
  ]).then(changed, changed)
}
