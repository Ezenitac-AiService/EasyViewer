import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import type { BookmarkItem, SearchResultItem, ViewerSettings } from '@/types'
import type { DocumentReaderPort } from '@/engines/types'
import { useReaderNavigation } from '@/composables/reader/useReaderNavigation'

function createDefaultSettings(viewMode: 'scroll' | 'paginated' = 'paginated'): ViewerSettings {
  return {
    theme: 'light',
    fontFamily: 'sans',
    fontSize: 18,
    lineHeight: 1.7,
    pageMargin: 24,
    viewMode,
    syncEndpoint: ''
  }
}

describe('useReaderNavigation & DocumentReaderPort orchestration (T036)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('routes EPUB pagination, bookmarks, search, highlight, and quick sync through DocumentReaderPort', async () => {
    const epubPort: DocumentReaderPort = {
      setTapHandler: vi.fn(),
      setKeyHandler: vi.fn(),
      loadBook: vi.fn(),
      goTo: vi.fn().mockResolvedValue(undefined),
      goToPercentage: vi.fn().mockResolvedValue(undefined),
      next: vi.fn().mockResolvedValue(undefined),
      prev: vi.fn().mockResolvedValue(undefined),
      scrollByScreen: vi.fn(),
      search: vi.fn().mockResolvedValue([
        { id: 'hit-1', locator: 'epubcfi(/6/4)', excerpt: 'found text', chapterTitle: 'Ch 2', percentage: 42 }
      ] satisfies SearchResultItem[]),
      highlightSearchResult: vi.fn(),
      applySettings: vi.fn().mockResolvedValue(undefined),
      destroy: vi.fn()
    }

    const bookmarks = ref<BookmarkItem[]>([])
    const currentLocator = ref('epubcfi(/6/2)')
    const showToast = vi.fn()
    const addBookmark = vi.fn().mockResolvedValue(undefined)
    const removeBookmark = vi.fn().mockResolvedValue(undefined)
    const syncNow = vi.fn().mockResolvedValue({ message: '동기화 완료' })

    const nav = useReaderNavigation({
      bookFormat: ref('epub'),
      bookTitle: ref('Sample EPUB'),
      bookId: ref('book-1'),
      settings: ref(createDefaultSettings('paginated')),
      readerCanvasRef: ref(null),
      isLoading: ref(false),
      loadError: ref(''),
      currentLocator,
      currentPercentage: ref(25),
      currentChapterTitle: ref('Ch 1'),
      bookmarks,
      txtParagraphs: ref([]),
      txtTotalLength: ref(0),
      getEpubEngine: () => epubPort,
      txtGoToOffset: vi.fn().mockResolvedValue(undefined),
      txtPrev: vi.fn(),
      txtNext: vi.fn(),
      addBookmark,
      removeBookmark,
      syncNow,
      getSyncedLocator: () => 'epubcfi(/6/8)',
      showToast
    })

    // Keyboard shortcuts: Ctrl+F opens search drawer, Ctrl+B adds bookmark, ArrowRight calls epubPort.next()
    nav.handleKeydown(new KeyboardEvent('keydown', { key: 'f', ctrlKey: true }))
    expect(nav.drawerOpen.value).toBe(true)
    expect(nav.drawerTab.value).toBe('search')

    nav.handleKeydown(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(nav.drawerOpen.value).toBe(false)

    nav.handleKeydown(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    expect(epubPort.next).toHaveBeenCalledTimes(1)

    await nav.handleToggleBookmark()
    expect(addBookmark).toHaveBeenCalledWith('epubcfi(/6/2)', 25, 'Ch 1', 'Ch 1 (25.0%)')
    expect(addBookmark).toHaveBeenCalledTimes(1)

    await nav.handleUnifiedSearch('found')
    expect(epubPort.search).toHaveBeenCalledWith('found')
    expect(nav.searchResults.value).toHaveLength(1)

    await nav.handleSelectSearchResult(nav.searchResults.value[0], 'found')
    expect(epubPort.goTo).toHaveBeenCalledWith('epubcfi(/6/4)')
    expect(epubPort.highlightSearchResult).toHaveBeenCalledWith('epubcfi(/6/4)')

    await nav.handleQuickSync()
    expect(syncNow).toHaveBeenCalledTimes(1)
    expect(epubPort.goTo).toHaveBeenCalledWith('epubcfi(/6/8)')
    expect(showToast).toHaveBeenCalledWith('동기화 완료')
  })

  it('routes TXT navigation and scroll/page handlers correctly', async () => {
    const txtGoToOffset = vi.fn().mockResolvedValue(undefined)
    const txtPrev = vi.fn()
    const txtNext = vi.fn()

    const nav = useReaderNavigation({
      bookFormat: ref('txt'),
      bookTitle: ref('Sample TXT'),
      bookId: ref('txt-1'),
      settings: ref(createDefaultSettings('paginated')),
      readerCanvasRef: ref(null),
      isLoading: ref(false),
      loadError: ref(''),
      currentLocator: ref('offset:10'),
      currentPercentage: ref(10),
      currentChapterTitle: ref('1장'),
      bookmarks: ref([]),
      txtParagraphs: ref([{ index: 0, text: 'hello world', startOffset: 0, endOffset: 11, isHeading: false }]),
      txtTotalLength: ref(100),
      getEpubEngine: () => null,
      txtGoToOffset,
      txtPrev,
      txtNext,
      addBookmark: vi.fn().mockResolvedValue(undefined),
      removeBookmark: vi.fn().mockResolvedValue(undefined),
      syncNow: vi.fn().mockResolvedValue({ message: 'ok' }),
      getSyncedLocator: () => undefined,
      showToast: vi.fn()
    })

    nav.handleKeydown(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))
    nav.handleKeydown(new KeyboardEvent('keydown', { key: ' ' }))
    expect(txtPrev).toHaveBeenCalledTimes(1)
    expect(txtNext).toHaveBeenCalledTimes(1)

    await nav.handleSelectToc({ id: 't1', label: '2장', href: 'offset:50', level: 0 })
    expect(txtGoToOffset).toHaveBeenCalledWith(50)
  })
})
