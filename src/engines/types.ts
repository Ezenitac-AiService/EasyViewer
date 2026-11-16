import type { SearchResultItem, TocItem, ViewerSettings } from '@/types'

export interface ReaderLocationChange {
  locator: string
  percentage: number
  chapterTitle?: string
  precisionReady?: boolean
}

export interface ReaderLoadOptions {
  buffer: ArrayBuffer
  container: HTMLElement
  settings: ViewerSettings
  contentHash?: string
  initialLocator?: string
  initialPercentage?: number
  signal?: AbortSignal
  onRelocated?: (loc: ReaderLocationChange) => void
  onIndexReady?: (precisionReady: boolean) => void
}

export interface ExtractedEpubMetadata {
  title?: string
  author?: string
  coverBlob?: Blob | null
  coverBytes?: Uint8Array | null
  coverMime?: string | null
}

export type EpubMetadataExtractor = (buffer: ArrayBuffer) => Promise<ExtractedEpubMetadata>

export interface DocumentReaderPort {
  setTapHandler(handler: ((clientX: number, clientY: number) => void) | null): void
  setKeyHandler(handler: ((event: KeyboardEvent) => void) | null): void
  loadBook(options: ReaderLoadOptions): Promise<{
    title: string
    author: string
    toc: TocItem[]
    precisionReady: boolean
    sectionCount: number
  }>
  goTo(target: string): Promise<void>
  goToPercentage(percentage: number): Promise<void>
  next(): Promise<void>
  prev(): Promise<void>
  scrollByScreen(direction: 1 | -1): void
  search(query: string): Promise<SearchResultItem[]>
  highlightSearchResult(locator: string): void
  applySettings(settings: ViewerSettings): Promise<void>
  destroy(): void
}
