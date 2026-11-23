// SPDX-License-Identifier: GPL-3.0-only
import { afterEach, describe, expect, it, vi } from 'vitest'
import { anySignal } from '@/engines/epub/abortSignals'

/**
 * AbortSignal.any needs Safari/iOS 17.4, WebKitGTK 2.44 or Chrome 116. The supported floors
 * (macOS 11 with Safari 16.6, iOS 15) predate it, so the EPUB engine must not depend on it.
 */

const nativeAny = (AbortSignal as unknown as { any?: unknown }).any

afterEach(() => {
  ;(AbortSignal as unknown as { any?: unknown }).any = nativeAny
  vi.restoreAllMocks()
})

function withoutNativeAny() {
  ;(AbortSignal as unknown as { any?: unknown }).any = undefined
}

describe.each([
  ['native AbortSignal.any', () => {}],
  ['fallback without AbortSignal.any', withoutNativeAny]
])('anySignal (%s)', (_name, setup) => {
  it('aborts when any input aborts and keeps that reason', () => {
    setup()
    const a = new AbortController()
    const b = new AbortController()
    const combined = anySignal([a.signal, b.signal])
    expect(combined.aborted).toBe(false)
    const reason = new Error('second')
    b.abort(reason)
    expect(combined.aborted).toBe(true)
    expect(combined.reason).toBe(reason)
    a.abort(new Error('later'))
    expect(combined.reason).toBe(reason)
  })

  it('is already aborted when an input is already aborted', () => {
    setup()
    const a = new AbortController()
    const reason = new Error('early')
    a.abort(reason)
    const combined = anySignal([a.signal, new AbortController().signal])
    expect(combined.aborted).toBe(true)
    expect(combined.reason).toBe(reason)
  })

  it('fires the abort event once', () => {
    setup()
    const a = new AbortController()
    const b = new AbortController()
    const combined = anySignal([a.signal, b.signal])
    const onAbort = vi.fn()
    combined.addEventListener('abort', onAbort)
    a.abort()
    b.abort()
    expect(onAbort).toHaveBeenCalledTimes(1)
  })
})

describe('anySignal fallback', () => {
  it('does not call AbortSignal.any when the runtime lacks it', () => {
    withoutNativeAny()
    expect(() => anySignal([new AbortController().signal])).not.toThrow()
  })

  it('stops listening to the other inputs after the first abort', () => {
    withoutNativeAny()
    const a = new AbortController()
    const b = new AbortController()
    const remove = vi.spyOn(b.signal, 'removeEventListener')
    anySignal([a.signal, b.signal])
    a.abort()
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function))
  })
})

describe('WebView baseline guard', () => {
  it('keeps direct AbortSignal.any calls out of app code (only the helper may use it)', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const root = path.resolve(__dirname, '../../src')
    const offenders: string[] = []
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const abs = path.join(dir, entry.name)
        if (entry.isDirectory()) walk(abs)
        else if (/\.(ts|vue)$/.test(entry.name) && !abs.endsWith(path.join('epub', 'abortSignals.ts'))) {
          if (/AbortSignal\.any\s*\(/.test(fs.readFileSync(abs, 'utf-8'))) offenders.push(path.relative(root, abs))
        }
      }
    }
    walk(root)
    expect(offenders).toEqual([])
  })
})
