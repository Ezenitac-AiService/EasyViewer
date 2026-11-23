// SPDX-License-Identifier: GPL-3.0-only
/**
 * Combines abort signals. Uses AbortSignal.any where the WebView has it (Safari/iOS 17.4,
 * WebKitGTK 2.44, Chrome 116) and an equivalent fallback on the older WebViews that the
 * supported OS floors still allow (macOS 11 ships Safari 16.6, iOS 15 ships Safari 15).
 */
export function anySignal(signals: readonly AbortSignal[]): AbortSignal {
  const native = (AbortSignal as unknown as { any?: (s: AbortSignal[]) => AbortSignal }).any
  if (typeof native === 'function') return native.call(AbortSignal, [...signals])

  const controller = new AbortController()
  const already = signals.find((s) => s.aborted)
  if (already) {
    controller.abort(already.reason)
    return controller.signal
  }

  const listeners: Array<[AbortSignal, () => void]> = []
  const cleanup = () => {
    for (const [signal, listener] of listeners) signal.removeEventListener('abort', listener)
  }
  for (const signal of signals) {
    const listener = () => {
      cleanup()
      controller.abort(signal.reason)
    }
    listeners.push([signal, listener])
    signal.addEventListener('abort', listener, { once: true })
  }
  return controller.signal
}
