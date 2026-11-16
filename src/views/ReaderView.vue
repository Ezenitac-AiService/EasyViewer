<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useBookStore } from '@/stores/useBookStore'
import { useSettingsStore } from '@/stores/useSettingsStore'
import type { DocumentReaderPort } from '@/engines/types'
import { EpubViewerEngine } from '@/engines/epub/epubEngine'
import { parseOffsetLocator } from '@/engines/txt/txtEngine'
import { TXT_PAGE_HEADING_CLASS, TXT_PAGE_PARA_CLASS } from '@/engines/txt/txtMeasuredPagination'
import { useToast } from '@/composables/ui/useToast'
import { useReaderSession } from '@/composables/reader/useReaderSession'
import { useTxtReaderController } from '@/composables/reader/useTxtReaderController'
import { useReaderNavigation } from '@/composables/reader/useReaderNavigation'
import type { TocItem } from '@/types'
import ViewerSettingsPanel from '@/components/viewer/ViewerSettingsPanel.vue'
import ViewerSideDrawer from '@/components/viewer/ViewerSideDrawer.vue'
import { ArrowLeft, Bookmark, BookmarkCheck, ListTree, Loader2, RefreshCw, Search, Settings } from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const bookStore = useBookStore()
const settingsStore = useSettingsStore()

const bookId = computed(() => String(route.params.id || ''))
const currentBook = computed(() => bookStore.books.find((b) => b.id === bookId.value))
const bookBookmarks = computed(() => bookStore.getBookBookmarks(bookId.value))

const readerCanvasRef = ref<HTMLElement | null>(null)
const epubContainerRef = ref<HTMLElement | null>(null)
const txtScrollContainerRef = ref<HTMLElement | null>(null)
const txtPaginatedViewportRef = ref<HTMLElement | null>(null)
const txtPageContentRef = ref<HTMLElement | null>(null)

const tocItems = ref<TocItem[]>([])
const currentLocator = ref('')
const currentPercentage = ref(0)
const currentChapterTitle = ref('본문')
const { toastMessage, showToast } = useToast(2600)
let epubEngine: DocumentReaderPort | null = null

const fontFamilyCss = computed(() => {
  const map: Record<string, string> = {
    sans: '"Pretendard Variable", Pretendard, "Noto Sans KR", sans-serif',
    serif: '"Nanum Myeongjo", "Noto Serif KR", Georgia, serif',
    mono: '"D2Coding", Consolas, monospace',
    system: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif'
  }
  return map[settingsStore.settings.fontFamily] || map.sans
})

const currentTocId = computed<string | undefined>(() => {
  if (!tocItems.value.length || currentBook.value?.format !== 'txt') return undefined
  const offset = parseOffsetLocator(currentLocator.value)
  let activeId: string | undefined
  for (const item of tocItems.value) {
    if (parseOffsetLocator(item.href) <= offset) activeId = item.id
    else break
  }
  return activeId
})

const isCurrentPositionBookmarked = computed(() =>
  bookBookmarks.value.some((b) => b.locator === currentLocator.value)
)

const txt = useTxtReaderController({
  bookId,
  isTxtBook: computed(() => currentBook.value?.format === 'txt'),
  settings: computed(() => settingsStore.settings),
  fontFamilyCss,
  tocItems,
  scrollContainerRef: txtScrollContainerRef,
  paginatedViewportRef: txtPaginatedViewportRef,
  pageContentRef: txtPageContentRef,
  onLocationChange: (locator, percentage, chapterTitle) => {
    currentLocator.value = locator
    currentPercentage.value = percentage
    currentChapterTitle.value = chapterTitle
    void bookStore.saveReadingLocation(bookId.value, locator, percentage, chapterTitle)
  }
})

const { isLoading, loadError } = useReaderSession({
  bookId,
  ensureContentHash: async (id) => {
    await settingsStore.initSettings()
    await bookStore.initLibrary()
    await bookStore.ensureBookContentHash(id)
  },
  loadBook: async (id, signal) => {
    epubEngine?.destroy()
    epubEngine = null
    txt.destroy()
    const book = bookStore.books.find((b) => b.id === id)
    if (!book) throw new Error('요청한 문서를 서재에서 찾을 수 없습니다.')
    const buffer = await bookStore.loadBookBinary(book.id)
    if (signal.aborted) return
    if (!buffer) throw new Error('문서 원본 데이터가 로컬 캐시에 존재하지 않습니다.')

    const saved = bookStore.positions[book.id]
    currentLocator.value = saved?.locator || ''
    currentPercentage.value = saved?.percentage ?? 0
    currentChapterTitle.value = saved?.chapterTitle || '본문'

    if (book.format === 'epub') {
      isLoading.value = false
      await nextTick()
      if (signal.aborted || !epubContainerRef.value) return
      epubEngine = new EpubViewerEngine(bookStore.locationIndexCachePort)
      epubEngine.setTapHandler(nav.handleReaderTap)
      epubEngine.setKeyHandler(nav.handleKeydown)
      const info = await epubEngine.loadBook({
        buffer,
        container: epubContainerRef.value,
        settings: settingsStore.settings,
        contentHash: book.contentHash,
        initialLocator: currentLocator.value,
        initialPercentage: currentPercentage.value,
        signal,
        onRelocated: (loc) => {
          currentLocator.value = loc.locator
          currentPercentage.value = loc.percentage
          currentChapterTitle.value = loc.chapterTitle || '본문'
          void bookStore.saveReadingLocation(book.id, loc.locator, loc.percentage, loc.chapterTitle)
        }
      })
      if (!signal.aborted) tocItems.value = info.toc
    } else {
      tocItems.value = await txt.loadBuffer(buffer, currentLocator.value)
      isLoading.value = false
      if (!signal.aborted) await txt.mountInitialView(currentLocator.value)
    }
  },
  flushLocation: () => bookStore.flushReadingLocation()
})

const nav = useReaderNavigation({
  bookFormat: computed(() => currentBook.value?.format),
  bookTitle: computed(() => currentBook.value?.title || ''),
  bookId,
  settings: computed(() => settingsStore.settings),
  readerCanvasRef,
  isLoading,
  loadError,
  currentLocator,
  currentPercentage,
  currentChapterTitle,
  bookmarks: bookBookmarks,
  txtParagraphs: txt.txtParagraphs,
  txtTotalLength: txt.txtTotalLength,
  getEpubEngine: () => epubEngine,
  txtGoToOffset: txt.goToOffset,
  txtPrev: txt.prev,
  txtNext: txt.next,
  addBookmark: async (locator, pct, title, excerpt) => {
    await bookStore.addBookmark(bookId.value, locator, pct, title, excerpt)
  },
  removeBookmark: (bmId) => bookStore.removeBookmark(bookId.value, bmId),
  syncNow: () => bookStore.syncNow(),
  getSyncedLocator: () => bookStore.positions[bookId.value]?.locator,
  showToast
})

const handleResize = () =>
  currentBook.value?.format === 'txt' ? txt.scheduleLayoutUpdate(parseOffsetLocator(currentLocator.value)) : txt.updateViewport()

watch(() => settingsStore.settings, (s) => {
  if (currentBook.value?.format === 'epub') void epubEngine?.applySettings(s)
}, { deep: true })

watch(
  () => [settingsStore.settings.viewMode, settingsStore.settings.fontSize, settingsStore.settings.lineHeight, settingsStore.settings.pageMargin, settingsStore.settings.fontFamily],
  () => { if (currentBook.value?.format === 'txt') txt.scheduleLayoutUpdate(parseOffsetLocator(currentLocator.value)) }
)

onMounted(() => {
  window.addEventListener('keydown', nav.handleKeydown)
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', nav.handleKeydown)
  window.removeEventListener('resize', handleResize)
  txt.destroy()
  epubEngine?.destroy()
})
</script>

<template>
  <div class="relative h-full w-full overflow-hidden select-none" :style="{ backgroundColor: 'var(--ev-reader-bg)', color: 'var(--ev-reader-fg)' }">
    <Transition enter-active-class="transition-transform duration-200 ease-out" leave-active-class="transition-transform duration-150 ease-in" enter-from-class="-translate-y-full" leave-to-class="-translate-y-full">
      <header
        v-show="nav.menuVisible.value"
        class="absolute top-0 inset-x-0 px-3 sm:px-5 border-b shadow-sm flex items-center justify-between gap-3 z-20"
        :style="{ paddingTop: 'env(safe-area-inset-top, 0px)', height: 'calc(env(safe-area-inset-top, 0px) + 3.25rem)', backgroundColor: 'var(--ev-surface)', borderColor: 'var(--ev-border)' }"
      >
        <div class="flex items-center gap-2 min-w-0">
          <button type="button" class="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors" title="서재로 돌아가기" aria-label="서재로 돌아가기" @click="router.push({ name: 'library' })">
            <ArrowLeft class="w-5 h-5" />
          </button>
          <div class="min-w-0">
            <h1 class="text-sm font-bold truncate">{{ currentBook?.title || '문서 뷰어' }}</h1>
            <p class="text-[11px] opacity-60 truncate">{{ currentChapterTitle }} · {{ currentPercentage.toFixed(1) }}%</p>
          </div>
        </div>
        <div class="flex items-center gap-1 sm:gap-1.5 shrink-0">
          <button type="button" class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/10 transition-colors" title="목차 및 챕터 이동" aria-label="목차 및 챕터 이동" @click="nav.openDrawerTab('toc')">
            <ListTree class="w-4 h-4 text-indigo-500" /><span class="hidden md:inline">목차</span>
          </button>
          <button type="button" class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/10 transition-colors" title="통합 본문 검색 (Ctrl+F)" aria-label="통합 본문 검색 (Ctrl+F)" @click="nav.openDrawerTab('search')">
            <Search class="w-4 h-4 text-indigo-500" /><span class="hidden md:inline">검색</span>
          </button>
          <button type="button" class="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors" :title="isCurrentPositionBookmarked ? '책갈피 해제 (Ctrl+B)' : '현재 위치 책갈피 추가 (Ctrl+B)'" :aria-label="isCurrentPositionBookmarked ? '책갈피 해제 (Ctrl+B)' : '현재 위치 책갈피 추가 (Ctrl+B)'" @click="nav.handleToggleBookmark">
            <BookmarkCheck v-if="isCurrentPositionBookmarked" class="w-4 h-4 text-amber-500 fill-amber-500" /><Bookmark v-else class="w-4 h-4" />
          </button>
          <button type="button" class="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/10 transition-colors" title="책갈피 목록 보기" aria-label="책갈피 목록 보기" @click="nav.openDrawerTab('bookmarks')">
            <span class="text-xs font-mono px-1.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-500">{{ bookBookmarks.length }}</span>
          </button>
          <button type="button" class="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors" title="마지막 읽은 위치 동기화" aria-label="마지막 읽은 위치 동기화" @click="nav.handleQuickSync">
            <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': bookStore.isSyncing }" />
          </button>
          <button type="button" class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs transition-colors" title="글꼴·테마·보기 방식 옵션" aria-label="글꼴·테마·보기 방식 옵션" @click="nav.settingsOpen.value = true">
            <Settings class="w-3.5 h-3.5" /><span class="hidden sm:inline">옵션</span>
          </button>
        </div>
      </header>
    </Transition>

    <div ref="readerCanvasRef" class="absolute inset-0 z-0 overflow-hidden flex flex-col" :style="{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }" @click="nav.handleCanvasClick">
      <div v-if="isLoading" class="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3" :style="{ backgroundColor: 'var(--ev-reader-bg)' }">
        <Loader2 class="w-8 h-8 animate-spin text-indigo-500" /><p class="text-sm font-medium opacity-75">문서를 불러오고 있습니다...</p>
      </div>
      <div v-else-if="loadError" class="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <p class="text-sm font-bold text-red-500 mb-3">{{ loadError }}</p>
        <button type="button" class="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold" @click="router.push({ name: 'library' })">서재로 돌아가기</button>
      </div>
      <template v-else-if="currentBook?.format === 'epub'">
        <div class="relative flex-1 w-full h-full overflow-hidden"><div ref="epubContainerRef" class="w-full h-full" /></div>
      </template>
      <template v-else-if="currentBook?.format === 'txt'">
        <div v-if="settingsStore.settings.viewMode === 'scroll'" ref="txtScrollContainerRef" class="flex-1 overflow-y-auto" style="overflow-anchor: none" @scroll.passive="txt.handleScroll">
          <article class="max-w-4xl mx-auto py-8" :style="{ fontFamily: fontFamilyCss, fontSize: `${settingsStore.settings.fontSize}px`, lineHeight: settingsStore.settings.lineHeight, paddingLeft: `${settingsStore.settings.pageMargin}px`, paddingRight: `${settingsStore.settings.pageMargin}px` }">
            <div v-if="txt.virtualTopSpacerPx.value > 0" :style="{ height: `${txt.virtualTopSpacerPx.value}px` }" />
            <p v-for="para in txt.virtualVisibleParagraphs.value" :id="`txt-para-${para.index}`" :key="para.index" class="mb-3 break-words rounded-lg" :class="[para.isHeading ? 'font-bold text-[1.2em] mt-6 mb-3 text-indigo-600 dark:text-indigo-400' : '', nav.highlightedParaIndex.value === para.index ? 'bg-amber-400/25 px-2 py-1 ring-1 ring-amber-400' : '']">
              {{ para.text || '\u00A0' }}
            </p>
            <div v-if="txt.virtualBottomSpacerPx.value > 0" :style="{ height: `${txt.virtualBottomSpacerPx.value}px` }" />
          </article>
        </div>
        <div v-else ref="txtPaginatedViewportRef" class="relative flex-1 flex flex-col justify-between overflow-hidden select-text">
          <div ref="txtPageContentRef" class="flex-1 max-w-4xl w-full mx-auto py-6 overflow-hidden" :style="{ fontFamily: fontFamilyCss, fontSize: `${settingsStore.settings.fontSize}px`, lineHeight: settingsStore.settings.lineHeight, paddingLeft: `${settingsStore.settings.pageMargin}px`, paddingRight: `${settingsStore.settings.pageMargin}px` }">
            <template v-if="txt.txtCurrentPage.value">
              <p v-for="para in txt.txtCurrentPage.value.paragraphs" :key="para.index" class="rounded-md" :class="[TXT_PAGE_PARA_CLASS, para.isHeading ? `${TXT_PAGE_HEADING_CLASS} text-indigo-600 dark:text-indigo-400` : '', nav.highlightedParaIndex.value === para.index ? 'bg-amber-400/25 ring-1 ring-amber-400/60' : '']" :style="para.continued ? { marginTop: '0' } : undefined">
                {{ para.text || '\u00A0' }}
              </p>
            </template>
          </div>
        </div>
      </template>
    </div>

    <Transition enter-active-class="transition-transform duration-200 ease-out" leave-active-class="transition-transform duration-150 ease-in" enter-from-class="translate-y-full" leave-to-class="translate-y-full">
      <footer v-show="nav.menuVisible.value" class="absolute bottom-0 inset-x-0 px-4 sm:px-6 border-t shadow-sm flex items-center justify-between gap-4 text-xs z-20" :style="{ paddingBottom: 'env(safe-area-inset-bottom, 0px)', height: 'calc(env(safe-area-inset-bottom, 0px) + 3rem)', backgroundColor: 'var(--ev-surface)', borderColor: 'var(--ev-border)' }">
        <div class="flex items-center gap-2 shrink-0">
          <span class="font-semibold uppercase px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/10">{{ settingsStore.settings.viewMode === 'paginated' ? '가로 페이지' : '세로 스크롤' }}</span>
          <span v-if="currentBook?.format === 'txt'" class="hidden sm:inline font-mono text-[11px] opacity-65">{{ txt.txtEncoding.value }}</span>
        </div>
        <div class="flex-1 max-w-xl flex items-center gap-3"><input type="range" min="0" max="100" step="0.5" :value="currentPercentage" class="w-full accent-indigo-600 cursor-pointer" @change="nav.handleProgressSliderChange" /></div>
        <div class="flex items-center gap-2 font-mono shrink-0">
          <span v-if="currentBook?.format === 'txt' && settingsStore.settings.viewMode === 'paginated'" class="opacity-70">
            <template v-if="txt.txtPageState.value.totalPages !== null">{{ txt.txtPageState.value.pageNumber }} / {{ txt.txtPageState.value.totalPages }}p ·</template>
            <template v-else>페이지 계산 중 {{ Math.round(txt.txtPageState.value.progress * 100) }}% ·</template>
          </span>
          <span class="font-bold text-indigo-600 dark:text-indigo-400">{{ currentPercentage.toFixed(1) }}%</span>
        </div>
      </footer>
    </Transition>

    <ViewerSideDrawer :open="nav.drawerOpen.value" :active-tab="nav.drawerTab.value" :toc="tocItems" :bookmarks="bookBookmarks" :search-results="nav.searchResults.value" :is-searching="nav.isSearching.value" :current-chapter="currentChapterTitle" :current-toc-id="currentTocId" @close="nav.drawerOpen.value = false" @update:active-tab="nav.drawerTab.value = $event" @select-toc="nav.handleSelectToc" @select-bookmark="nav.handleSelectBookmark" @add-bookmark="nav.handleAddBookmark" @remove-bookmark="(bmId) => currentBook && bookStore.removeBookmark(currentBook.id, bmId)" @search="nav.handleUnifiedSearch" @select-search="nav.handleSelectSearchResult" />
    <ViewerSettingsPanel :open="nav.settingsOpen.value" @close="nav.settingsOpen.value = false" />
    <div v-if="toastMessage" class="fixed bottom-16 right-5 z-50 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-medium shadow-xl">{{ toastMessage }}</div>
  </div>
</template>
