import { ref, type Ref } from 'vue'
import type { BookmarkItem, SearchResultItem, TocItem, ViewerSettings } from '@/types'
import type { DocumentReaderPort } from '@/engines/types'
import { parseOffsetLocator, searchTxtDocument, type TxtParagraph } from '@/engines/txt/txtEngine'
import type { DrawerTab } from '@/components/viewer/ViewerSideDrawer.vue'

export interface ReaderNavigationOptions {
  bookFormat: Ref<'epub' | 'txt' | undefined>
  bookTitle: Ref<string>
  bookId: Ref<string>
  settings: Ref<ViewerSettings>
  readerCanvasRef: Ref<HTMLElement | null>
  isLoading: Ref<boolean>
  loadError: Ref<string>
  currentLocator: Ref<string>
  currentPercentage: Ref<number>
  currentChapterTitle: Ref<string>
  bookmarks: Ref<BookmarkItem[]>
  txtParagraphs: Ref<TxtParagraph[]>
  txtTotalLength: Ref<number>
  getEpubEngine: () => DocumentReaderPort | null
  txtGoToOffset: (offset: number) => Promise<void>
  txtPrev: () => void
  txtNext: () => void
  addBookmark: (locator: string, percentage: number, title: string, excerpt: string) => Promise<void>
  removeBookmark: (bookmarkId: string) => Promise<void>
  syncNow: () => Promise<{ message: string }>
  getSyncedLocator: () => string | undefined
  showToast: (msg: string) => void
}

/**
 * Coordinates reader tap zones, keyboard shortcuts, TOC/bookmark/search navigation,
 * and quick sync across both EPUB and TXT engines.
 */
export function useReaderNavigation(opts: ReaderNavigationOptions) {
  const drawerOpen = ref(false)
  const drawerTab = ref<DrawerTab>('toc')
  const settingsOpen = ref(false)
  const menuVisible = ref(true)
  const isSearching = ref(false)
  const searchResults = ref<SearchResultItem[]>([])
  const highlightedKeyword = ref('')
  const highlightedParaIndex = ref<number | null>(null)

  async function prevPage(): Promise<void> {
    const epub = opts.getEpubEngine()
    if (opts.bookFormat.value === 'epub') {
      if (opts.settings.value.viewMode === 'paginated') await epub?.prev()
      else epub?.scrollByScreen(-1)
      return
    }
    opts.txtPrev()
  }

  async function nextPage(): Promise<void> {
    const epub = opts.getEpubEngine()
    if (opts.bookFormat.value === 'epub') {
      if (opts.settings.value.viewMode === 'paginated') await epub?.next()
      else epub?.scrollByScreen(1)
      return
    }
    opts.txtNext()
  }

  function handleReaderTap(clientX: number, clientY: number): void {
    if (opts.isLoading.value || opts.loadError.value || drawerOpen.value || settingsOpen.value) return
    const el = opts.readerCanvasRef.value
    if (!el) return
    const rect = el.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return
    if (opts.settings.value.viewMode !== 'paginated') {
      menuVisible.value = !menuVisible.value
      return
    }
    const rx = (clientX - rect.left) / rect.width
    const ry = (clientY - rect.top) / rect.height
    if (ry >= 2 / 3) void nextPage()
    else if (ry >= 1 / 3 && rx < 1 / 3) void prevPage()
    else if (ry >= 1 / 3 && rx > 2 / 3) void nextPage()
    else menuVisible.value = !menuVisible.value
  }

  function handleCanvasClick(e: MouseEvent): void {
    const target = e.target as HTMLElement | null
    if (target?.closest('a[href], button, input, textarea, select, label')) return
    const sel = window.getSelection()
    if (sel && !sel.isCollapsed && sel.toString().trim()) return
    handleReaderTap(e.clientX, e.clientY)
  }

  async function handleProgressSliderChange(e: Event): Promise<void> {
    const pct = Number((e.target as HTMLInputElement).value)
    opts.currentPercentage.value = pct
    if (opts.bookFormat.value === 'epub') {
      await opts.getEpubEngine()?.goToPercentage(pct)
    } else {
      await opts.txtGoToOffset(Math.round((pct / 100) * opts.txtTotalLength.value))
    }
  }

  function openDrawerTab(tab: DrawerTab): void {
    drawerTab.value = tab
    drawerOpen.value = true
  }

  async function navigateToLocator(locator: string): Promise<void> {
    if (opts.bookFormat.value === 'epub') await opts.getEpubEngine()?.goTo(locator)
    else await opts.txtGoToOffset(parseOffsetLocator(locator))
  }

  async function handleSelectToc(item: TocItem): Promise<void> {
    drawerOpen.value = false
    await navigateToLocator(item.href)
  }

  async function handleAddBookmark(): Promise<void> {
    let excerpt = `${opts.currentChapterTitle.value} (${opts.currentPercentage.value.toFixed(1)}%)`
    if (opts.bookFormat.value === 'txt') {
      const offset = parseOffsetLocator(opts.currentLocator.value)
      const para = opts.txtParagraphs.value.find((p) => p.startOffset >= offset && p.text.trim().length > 0)
      if (para) excerpt = para.text.trim().slice(0, 100)
    }
    await opts.addBookmark(
      opts.currentLocator.value || 'offset:0',
      opts.currentPercentage.value,
      opts.currentChapterTitle.value || opts.bookTitle.value,
      excerpt
    )
    opts.showToast('현재 위치를 책갈피에 저장했습니다.')
  }

  async function handleToggleBookmark(): Promise<void> {
    const existing = opts.bookmarks.value.find((b) => b.locator === opts.currentLocator.value)
    if (existing) {
      await opts.removeBookmark(existing.id)
      opts.showToast('현재 위치의 책갈피를 해제했습니다.')
      return
    }
    await handleAddBookmark()
  }

  async function handleSelectBookmark(bm: BookmarkItem): Promise<void> {
    drawerOpen.value = false
    await navigateToLocator(bm.locator)
  }

  async function handleUnifiedSearch(query: string): Promise<void> {
    const q = query.trim()
    if (!q || !opts.bookFormat.value) return
    isSearching.value = true
    highlightedKeyword.value = q
    try {
      searchResults.value =
        opts.bookFormat.value === 'epub'
          ? (await opts.getEpubEngine()?.search(q)) || []
          : searchTxtDocument(opts.txtParagraphs.value, opts.txtTotalLength.value, q)
    } finally {
      isSearching.value = false
    }
  }

  async function handleSelectSearchResult(hit: SearchResultItem, query: string): Promise<void> {
    drawerOpen.value = false
    highlightedKeyword.value = query
    if (opts.bookFormat.value === 'epub') {
      await opts.getEpubEngine()?.goTo(hit.locator)
      opts.getEpubEngine()?.highlightSearchResult(hit.locator)
      return
    }
    highlightedParaIndex.value = hit.matchIndex ?? null
    await opts.txtGoToOffset(parseOffsetLocator(hit.locator))
    if (opts.settings.value.viewMode === 'scroll') {
      document.getElementById(`txt-para-${hit.matchIndex}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  async function handleQuickSync(): Promise<void> {
    const res = await opts.syncNow()
    const syncedLocator = opts.getSyncedLocator()
    if (syncedLocator && syncedLocator !== opts.currentLocator.value) {
      await navigateToLocator(syncedLocator)
    }
    opts.showToast(res.message)
  }

  function handleKeydown(e: KeyboardEvent): void {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); openDrawerTab('search'); return }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); void handleToggleBookmark(); return }
    if (e.key === 'Escape') { drawerOpen.value = false; settingsOpen.value = false; return }
    if (drawerOpen.value || settingsOpen.value || e.altKey || e.ctrlKey || e.metaKey) return
    const isScroll = opts.settings.value.viewMode !== 'paginated'
    if (e.key === (isScroll ? 'ArrowUp' : 'ArrowLeft') || e.key === 'PageUp') { e.preventDefault(); void prevPage() }
    else if (e.key === (isScroll ? 'ArrowDown' : 'ArrowRight') || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); void nextPage() }
  }

  return {
    drawerOpen,
    drawerTab,
    settingsOpen,
    menuVisible,
    isSearching,
    searchResults,
    highlightedKeyword,
    highlightedParaIndex,
    handleReaderTap,
    handleCanvasClick,
    handleProgressSliderChange,
    openDrawerTab,
    handleSelectToc,
    handleAddBookmark,
    handleToggleBookmark,
    handleSelectBookmark,
    handleUnifiedSearch,
    handleSelectSearchResult,
    handleQuickSync,
    handleKeydown
  }
}
