import { EpubCFI, type Book, type NavItem } from 'epubjs'
import type { TocItem } from '@/types'

export interface SpineSectionMetric {
  index: number
  href: string
  cfiBase: string
  weight: number
  startRatio: number
  endRatio: number
  locations: string[]
}

export function normalizeToc(items: NavItem[], level = 0): TocItem[] {
  return (items || []).map((item, idx) => ({
    id: item.id || `toc-${level}-${idx}`,
    label: item.label.trim(),
    href: item.href,
    level,
    subitems: item.subitems && item.subitems.length > 0 ? normalizeToc(item.subitems, level + 1) : []
  }))
}

export function collapseCfiString(cfiStr: string, toStart = true): string {
  if (!cfiStr || !cfiStr.startsWith('epubcfi(')) return cfiStr
  try {
    const parsed = new EpubCFI(cfiStr)
    if (parsed.range) {
      parsed.collapse(toStart)
      return parsed.toString()
    }
  } catch {
    // Fallback if CFI parsing fails
  }
  return cfiStr
}

export function buildSectionMetrics(book: Book | null): SpineSectionMetric[] {
  const metrics: SpineSectionMetric[] = []
  if (!book) return metrics

  const spineItems = book.spine.spineItems || []
  if (spineItems.length === 0) return metrics

  const rawLocations: string[] = Array.isArray((book.locations as any)?._locations)
    ? ((book.locations as any)._locations as string[])
    : []

  const groupedBySpine = new Map<number, string[]>()
  for (const loc of rawLocations) {
    try {
      const parsed = new EpubCFI(loc)
      const spineIdx = parsed.spinePos
      if (typeof spineIdx === 'number' && spineIdx >= 0) {
        const collapsed = collapseCfiString(loc, true)
        const list = groupedBySpine.get(spineIdx) || []
        list.push(collapsed)
        groupedBySpine.set(spineIdx, list)
      }
    } catch {
      // Ignore malformed CFI
    }
  }

  const totalSections = spineItems.length
  const weights = spineItems.map((item) => Math.max(1, (groupedBySpine.get(item.index) || []).length))
  const totalWeight = weights.reduce((acc, w) => acc + w, 0) || 1

  let cumulative = 0
  for (let i = 0; i < totalSections; i++) {
    const item = spineItems[i]
    const weight = weights[i]
    const locs = groupedBySpine.get(item.index) || []
    const startRatio = cumulative / totalWeight
    cumulative += weight
    const endRatio = i === totalSections - 1 ? 1 : cumulative / totalWeight

    metrics.push({
      index: item.index,
      href: item.href,
      cfiBase: item.cfiBase,
      weight,
      startRatio,
      endRatio,
      locations: locs
    })
  }
  return metrics
}

export function resolveSectionIndex(
  metrics: SpineSectionMetric[],
  cfi?: string,
  href?: string,
  explicitIndex?: number
): number {
  if (typeof explicitIndex === 'number' && explicitIndex >= 0 && explicitIndex < metrics.length) {
    return explicitIndex
  }
  if (cfi && cfi.startsWith('epubcfi(')) {
    try {
      const parsed = new EpubCFI(cfi)
      if (typeof parsed.spinePos === 'number' && parsed.spinePos >= 0 && parsed.spinePos < metrics.length) {
        return parsed.spinePos
      }
    } catch {
      // Fallback to href matching
    }
  }
  if (href) {
    const cleanHref = href.split('#')[0]
    const found = metrics.find(
      (m) => m.href === cleanHref || m.href.endsWith(cleanHref) || cleanHref.endsWith(m.href)
    )
    if (found) return found.index
  }
  return 0
}

export function computeLocationPercentage(
  metrics: SpineSectionMetric[],
  cfiHelper: EpubCFI,
  location: any
): number {
  if (!location?.start || metrics.length === 0) return 0
  const totalSections = metrics.length
  const startCfi: string = location.start.cfi || ''
  const startHref: string = location.start.href || ''
  const sectionIdx = resolveSectionIndex(metrics, startCfi, startHref, location.start.index)
  const metric = metrics[sectionIdx] || metrics[0]

  const startPage = Math.max(1, Number(location.start?.displayed?.page) || 1)
  const totalPages = Math.max(1, Number(location.start?.displayed?.total) || 1)
  const endPage = Math.max(startPage, Number(location.end?.displayed?.page) || startPage)
  const endTotalPages = Math.max(totalPages, Number(location.end?.displayed?.total) || totalPages)

  let cfiIntraRatio = 0
  if (metric.locations.length > 1 && startCfi) {
    const pointCfi = collapseCfiString(startCfi, true)
    let matchedIdx = 0
    for (let i = 0; i < metric.locations.length; i++) {
      try {
        if (cfiHelper.compare(metric.locations[i], pointCfi) <= 0) matchedIdx = i
        else break
      } catch {
        // Ignore
      }
    }
    cfiIntraRatio = matchedIdx / Math.max(1, metric.locations.length - 1)
  }

  if (sectionIdx === 0 && startPage === 1 && cfiIntraRatio === 0) return 0
  if (
    location.atEnd ||
    (sectionIdx === totalSections - 1 &&
      endPage >= endTotalPages &&
      (totalSections > 1 || endTotalPages > 1))
  ) {
    return 100
  }

  let intraRatio = 0
  if (totalPages > 1) {
    intraRatio =
      sectionIdx === totalSections - 1
        ? (startPage - 1) / Math.max(1, totalPages - 1)
        : (startPage - 1) / totalPages
  } else {
    intraRatio = sectionIdx === totalSections - 1 ? cfiIntraRatio : cfiIntraRatio * 0.95
  }

  const globalRatio =
    metric.startRatio + (metric.endRatio - metric.startRatio) * Math.max(0, Math.min(1, intraRatio))
  return Math.min(100, Math.max(0, Math.round(globalRatio * 1000) / 10))
}

export function computeCfiPercentage(
  metrics: SpineSectionMetric[],
  cfiHelper: EpubCFI,
  cfi: string,
  fallbackSectionIdx = 0
): number {
  if (!cfi || metrics.length === 0) return 0
  const sectionIdx = resolveSectionIndex(metrics, cfi, undefined, fallbackSectionIdx)
  const metric = metrics[sectionIdx] || metrics[0]

  let cfiIntraRatio = 0
  if (metric.locations.length > 1) {
    const pointCfi = collapseCfiString(cfi, true)
    let matchedIdx = 0
    for (let i = 0; i < metric.locations.length; i++) {
      try {
        if (cfiHelper.compare(metric.locations[i], pointCfi) <= 0) matchedIdx = i
        else break
      } catch {
        // Ignore
      }
    }
    cfiIntraRatio = matchedIdx / Math.max(1, metric.locations.length)
  }

  const globalRatio = metric.startRatio + (metric.endRatio - metric.startRatio) * cfiIntraRatio
  return Math.min(100, Math.max(0, Math.round(globalRatio * 1000) / 10))
}

export function findSpineItem(book: Book | null, path: string): any | undefined {
  if (!book || !path) return undefined
  const cleanPath = path.split('#')[0].replace(/^(\.\.\/|\.\/)+/, '')
  if (!cleanPath) return undefined
  return (book.spine.spineItems || []).find(
    (item) =>
      item.href === cleanPath ||
      item.href.endsWith(cleanPath) ||
      cleanPath.endsWith(item.href) ||
      (item.canonical && item.canonical.endsWith(cleanPath))
  )
}

export function resolveTargetHref(book: Book | null, tocList: TocItem[], target: string): string {
  if (!target || target.startsWith('epubcfi(') || !book) return target
  if (book.spine.get(target)) return target
  const [rawPath, hash] = target.split('#')
  const matched = findSpineItem(book, rawPath)
  if (matched) return hash ? `${matched.href}#${hash}` : matched.href

  const flat: TocItem[] = []
  const walk = (items: TocItem[]) =>
    items.forEach((item) => {
      flat.push(item)
      walk(item.subitems || [])
    })
  walk(tocList)
  const idx = flat.findIndex((item) => item.href === target)
  if (idx < 0) return target

  let prevSpineIndex = -1
  for (let i = idx - 1; i >= 0; i--) {
    const item = findSpineItem(book, flat[i].href)
    if (item) {
      prevSpineIndex = item.index
      break
    }
  }
  const spineItems = book.spine.spineItems || []
  if (!spineItems.length) return target
  return spineItems[Math.min(prevSpineIndex + 1, spineItems.length - 1)]?.href ?? target
}

export function findChapterLabelByHref(
  tocList: TocItem[],
  href: string,
  spineIndex?: number
): string {
  if (href) {
    const cleanHref = href.split('#')[0]
    const searchTree = (items: TocItem[]): string | null => {
      for (const item of items) {
        const itemHref = item.href.split('#')[0]
        if (cleanHref.endsWith(itemHref) || itemHref.endsWith(cleanHref)) return item.label
        if (item.subitems?.length) {
          const subFound = searchTree(item.subitems)
          if (subFound) return subFound
        }
      }
      return null
    }
    const matched = searchTree(tocList)
    if (matched) return matched
  }
  if (typeof spineIndex === 'number' && tocList[spineIndex]) return tocList[spineIndex].label
  return '본문'
}
