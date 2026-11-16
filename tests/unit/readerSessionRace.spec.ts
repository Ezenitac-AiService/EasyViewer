import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defineComponent, ref, nextTick } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { useReaderSession } from '@/composables/reader/useReaderSession'

describe('useReaderSession race condition & flush guards (T026)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('aborts in-flight loadBook on rapid route param change and ignores stale resolution', async () => {
    const bookIdRef = ref('book-A')
    const signals: AbortSignal[] = []
    const loadedIds: string[] = []
    const flushMock = vi.fn().mockResolvedValue(undefined)
    let resolveFirst!: () => void

    const loadBook = vi.fn((bookId: string, signal: AbortSignal) => {
      signals.push(signal)
      if (bookId === 'book-A') {
        return new Promise<void>((resolve) => {
          resolveFirst = () => {
            if (!signal.aborted) loadedIds.push(bookId)
            resolve()
          }
        })
      }
      loadedIds.push(bookId)
      return Promise.resolve()
    })

    const Comp = defineComponent({
      setup() {
        const session = useReaderSession({
          bookId: bookIdRef,
          loadBook,
          flushLocation: flushMock
        })
        return { session }
      },
      template: '<div />'
    })

    const wrapper = mount(Comp)
    await nextTick()
    expect(loadBook).toHaveBeenCalledTimes(1)
    expect(signals[0].aborted).toBe(false)

    // Rapid switch from book-A to book-B before book-A finishes
    bookIdRef.value = 'book-B'
    await flushPromises()
    expect(signals[0].aborted).toBe(true)
    expect(flushMock).toHaveBeenCalled()
    expect(loadedIds).toEqual(['book-B'])

    // Even if first promise resolves later, stale state is ignored
    resolveFirst()
    await flushPromises()
    expect(loadedIds).toEqual(['book-B'])

    wrapper.unmount()
    expect(flushMock).toHaveBeenCalledTimes(2)
  })

  it('aborts loadBook on unmount and flushes reading location on pagehide', async () => {
    const bookIdRef = ref('book-slow')
    let capturedSignal!: AbortSignal
    const flushMock = vi.fn().mockResolvedValue(undefined)
    const loadBook = vi.fn((_bookId: string, signal: AbortSignal) => {
      capturedSignal = signal
      return new Promise<void>(() => {})
    })

    const Comp = defineComponent({
      setup() {
        return useReaderSession({
          bookId: bookIdRef,
          loadBook,
          flushLocation: flushMock
        })
      },
      template: '<div />'
    })

    const wrapper = mount(Comp)
    await nextTick()
    expect(capturedSignal.aborted).toBe(false)

    window.dispatchEvent(new Event('pagehide'))
    expect(flushMock).toHaveBeenCalledTimes(1)

    wrapper.unmount()
    expect(capturedSignal.aborted).toBe(true)
    expect(flushMock).toHaveBeenCalledTimes(2)
  })
})
