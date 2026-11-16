import { describe, it, expect, vi } from 'vitest'
import { TxtPageMeasurer, TxtPaginationSession } from '@/engines/txt/txtMeasuredPagination'
import type { TxtParagraph } from '@/engines/txt/txtEngine'

function makeParagraphs(texts: string[]): TxtParagraph[] {
  let offset = 0
  return texts.map((text, index) => {
    const p: TxtParagraph = {
      index,
      text,
      startOffset: offset,
      endOffset: offset + text.length,
      isHeading: index === 0
    }
    offset = p.endOffset + 1
    return p
  })
}

describe('TxtPageMeasurer & TxtPaginationSession (T038)', () => {
  it('resolves posOf and absOf accurately via binary search across paragraph boundaries', () => {
    const paras = makeParagraphs(['Chapter 1', 'First paragraph body.', 'Second paragraph.'])
    const totalLength = paras[paras.length - 1].endOffset
    const el = document.createElement('div')
    const measurer = new TxtPageMeasurer(paras, totalLength, el)

    expect(measurer.posOf(0)).toEqual({ para: 0, char: 0 })
    expect(measurer.posOf(10)).toEqual({ para: 1, char: 0 })
    expect(measurer.posOf(15)).toEqual({ para: 1, char: 5 })
    expect(measurer.absOf({ para: 2, char: 3 })).toBe(paras[2].startOffset + 3)
    expect(measurer.posOf(totalLength + 10)).toEqual({ para: 3, char: 0 })
  })

  it('falls back cleanly when layout size is unavailable and stops background timer on destroy()', () => {
    vi.useFakeTimers()
    const paras = makeParagraphs(['Title', 'Alpha', 'Beta', 'Gamma'])
    const totalLength = paras[paras.length - 1].endOffset
    const el = document.createElement('div')
    const onChange = vi.fn()

    const session = new TxtPaginationSession(
      paras,
      totalLength,
      el,
      0,
      onChange,
      () => [
        {
          pageNumber: 1,
          paragraphs: [
            {
              index: 0,
              text: 'Title',
              startOffset: 0,
              endOffset: 5,
              isHeading: true,
              continued: false
            }
          ],
          startOffset: 0,
          endOffset: 5,
          percentage: 50
        },
        {
          pageNumber: 2,
          paragraphs: [
            {
              index: 1,
              text: 'Alpha',
              startOffset: 6,
              endOffset: 11,
              isHeading: false,
              continued: false
            }
          ],
          startOffset: 6,
          endOffset: 11,
          percentage: 100
        }
      ]
    )

    expect(session.state.pageNumber).toBe(1)
    expect(session.state.totalPages).toBe(2)
    expect(session.next()).toBe(true)
    expect(session.state.pageNumber).toBe(2)
    expect(session.prev()).toBe(true)
    expect(session.state.pageNumber).toBe(1)

    session.destroy()
    vi.runAllTimers()
    const callsAfterDestroy = onChange.mock.calls.length
    expect(callsAfterDestroy).toBeGreaterThan(0)
    vi.useRealTimers()
  })
})
