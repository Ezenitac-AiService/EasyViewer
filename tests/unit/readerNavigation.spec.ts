// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { ViewerSettings } from '@/types'
import { useReaderNavigation } from '@/composables/reader/useReaderNavigation'

/**
 * Spec 005 T013 (FR-005): every control listed in the README "조작 방법" / "Controls" table is
 * backed by a test. Covers the keys and tap zones not already exercised by readerViewOrchestration.
 */

function settings(viewMode: 'scroll' | 'paginated'): ViewerSettings {
  return { theme: 'light', fontFamily: 'sans', fontSize: 18, lineHeight: 1.7, pageMargin: 24, viewMode, syncEndpoint: '' }
}

/** A reader canvas whose layout box is 300×300 at the origin (DOM layout is the only stubbed boundary). */
function canvas(): HTMLElement {
  const el = document.createElement('div')
  el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 300, height: 300, right: 300, bottom: 300, x: 0, y: 0, toJSON: () => ({}) })
  return el
}

function setup(viewMode: 'scroll' | 'paginated') {
  const txtPrev = vi.fn()
  const txtNext = vi.fn()
  const addBookmark = vi.fn().mockResolvedValue(undefined)
  const nav = useReaderNavigation({
    bookFormat: ref('txt'),
    bookTitle: ref('TXT'),
    bookId: ref('txt-1'),
    settings: ref(settings(viewMode)),
    readerCanvasRef: ref(canvas()),
    isLoading: ref(false),
    loadError: ref(''),
    currentLocator: ref('offset:0'),
    currentPercentage: ref(0),
    currentChapterTitle: ref('1장'),
    bookmarks: ref([]),
    txtParagraphs: ref([]),
    txtTotalLength: ref(100),
    getEpubEngine: () => null,
    txtGoToOffset: vi.fn().mockResolvedValue(undefined),
    txtPrev,
    txtNext,
    addBookmark,
    removeBookmark: vi.fn().mockResolvedValue(undefined),
    syncNow: vi.fn().mockResolvedValue({ message: 'ok' }),
    getSyncedLocator: () => undefined,
    showToast: vi.fn()
  })
  return { nav, txtPrev, txtNext, addBookmark }
}

const key = (k: string, mods: KeyboardEventInit = {}) => new KeyboardEvent('keydown', { key: k, ...mods })

describe('README controls: keyboard', () => {
  it('PageUp and PageDown turn pages in both view modes', () => {
    for (const mode of ['paginated', 'scroll'] as const) {
      const { nav, txtPrev, txtNext } = setup(mode)
      nav.handleKeydown(key('PageUp'))
      nav.handleKeydown(key('PageDown'))
      expect(txtPrev).toHaveBeenCalledTimes(1)
      expect(txtNext).toHaveBeenCalledTimes(1)
    }
  })

  it('scroll mode uses the up and down arrows, not left and right', () => {
    const { nav, txtPrev, txtNext } = setup('scroll')
    nav.handleKeydown(key('ArrowLeft'))
    nav.handleKeydown(key('ArrowRight'))
    expect(txtPrev).not.toHaveBeenCalled()
    expect(txtNext).not.toHaveBeenCalled()
    nav.handleKeydown(key('ArrowUp'))
    nav.handleKeydown(key('ArrowDown'))
    expect(txtPrev).toHaveBeenCalledTimes(1)
    expect(txtNext).toHaveBeenCalledTimes(1)
  })

  it('Cmd+F opens search and Ctrl+B or Cmd+B toggles the bookmark', async () => {
    const { nav, addBookmark } = setup('paginated')
    nav.handleKeydown(key('f', { metaKey: true }))
    expect(nav.drawerOpen.value).toBe(true)
    expect(nav.drawerTab.value).toBe('search')
    nav.handleKeydown(key('b', { ctrlKey: true }))
    await vi.waitFor(() => expect(addBookmark).toHaveBeenCalledTimes(1))
    nav.handleKeydown(key('B', { metaKey: true }))
    await vi.waitFor(() => expect(addBookmark).toHaveBeenCalledTimes(2))
  })

  it('Esc closes the settings panel too', () => {
    const { nav } = setup('paginated')
    nav.settingsOpen.value = true
    nav.handleKeydown(key('Escape'))
    expect(nav.settingsOpen.value).toBe(false)
  })
})

describe('README controls: click and tap zones', () => {
  it('paginated mode: bottom third and middle-right go forward, middle-left goes back, elsewhere toggles the menu', () => {
    const { nav, txtPrev, txtNext } = setup('paginated')
    nav.handleReaderTap(150, 250)
    nav.handleReaderTap(250, 150)
    expect(txtNext).toHaveBeenCalledTimes(2)
    nav.handleReaderTap(50, 150)
    expect(txtPrev).toHaveBeenCalledTimes(1)
    const before = nav.menuVisible.value
    nav.handleReaderTap(150, 50)
    expect(nav.menuVisible.value).toBe(!before)
    nav.handleReaderTap(150, 150)
    expect(nav.menuVisible.value).toBe(before)
  })

  it('scroll mode: a tap only toggles the menu', () => {
    const { nav, txtPrev, txtNext } = setup('scroll')
    const before = nav.menuVisible.value
    nav.handleReaderTap(150, 250)
    expect(nav.menuVisible.value).toBe(!before)
    expect(txtPrev).not.toHaveBeenCalled()
    expect(txtNext).not.toHaveBeenCalled()
  })
})
