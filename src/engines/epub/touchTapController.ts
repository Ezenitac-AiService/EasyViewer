const TAP_MAX_DURATION_MS = 500
const TAP_MAX_MOVE_PX = 10
/** A touch starting sooner than this after a scroll is stopping a fling, not tapping. */
const TAP_SCROLL_QUIET_MS = 150
const TAP_CLICK_SUPPRESS_MS = 800

/**
 * Coordinates iframe touch/click tap detection and scroll-fling suppression
 * for epub.js renditions across WebKit and Chromium.
 */
export class TouchTapController {
  private tapHandler: ((clientX: number, clientY: number) => void) | null = null
  private touchTap: {
    x: number
    y: number
    time: number
    scrollTop: number
    scrollLeft: number
  } | null = null
  private suppressClickUntil = 0
  private lastScrollAt = 0

  setTapHandler(handler: ((clientX: number, clientY: number) => void) | null): void {
    this.tapHandler = handler
  }

  readonly handleContainerScroll = (): void => {
    this.lastScrollAt = performance.now()
  }

  handleTouchStart(event: TouchEvent, contents: any, scrollPos: { top: number; left: number }): void {
    const touch = event.touches.length === 1 ? event.touches[0] : null
    const now = performance.now()
    if (!touch || now - this.lastScrollAt <= TAP_SCROLL_QUIET_MS) {
      this.touchTap = null
      return
    }
    const pos = this.toParentViewport(touch.clientX, touch.clientY, contents)
    this.touchTap = { x: pos.x, y: pos.y, time: now, scrollTop: scrollPos.top, scrollLeft: scrollPos.left }
  }

  handleTouchEnd(event: TouchEvent, contents: any, scrollPos: { top: number; left: number }): void {
    const start = this.touchTap
    this.touchTap = null
    const touch = event.changedTouches[0]
    if (!start || !touch || event.touches.length > 0) return
    const now = performance.now()
    const pos = this.toParentViewport(touch.clientX, touch.clientY, contents)
    const moved = Math.hypot(pos.x - start.x, pos.y - start.y)
    const scrolled =
      this.lastScrollAt > start.time ||
      Math.abs(scrollPos.top - start.scrollTop) > 1 ||
      Math.abs(scrollPos.left - start.scrollLeft) > 1
    if (now - start.time > TAP_MAX_DURATION_MS || moved > TAP_MAX_MOVE_PX || scrolled) return
    this.suppressClickUntil = now + TAP_CLICK_SUPPRESS_MS
    this.emitContentTap(event.target as Element | null, touch.clientX, touch.clientY, contents)
  }

  handleClick(event: MouseEvent, contents: any): void {
    if (performance.now() < this.suppressClickUntil) return
    this.emitContentTap(event.target as Element | null, event.clientX, event.clientY, contents)
  }

  reset(): void {
    this.touchTap = null
    this.suppressClickUntil = 0
    this.lastScrollAt = 0
  }

  private toParentViewport(x: number, y: number, contents: any): { x: number; y: number } {
    const frame = contents?.document?.defaultView?.frameElement as HTMLElement | null | undefined
    const rect = frame?.getBoundingClientRect()
    return { x: x + (rect?.left ?? 0), y: y + (rect?.top ?? 0) }
  }

  private emitContentTap(target: Element | null, x: number, y: number, contents: any): void {
    if (!this.tapHandler) return
    const win: Window | null | undefined = contents?.document?.defaultView
    const selection = win?.getSelection()
    if (selection && !selection.isCollapsed && selection.toString().trim()) return
    if (target?.closest?.('a[href], button, input, textarea, select, label')) return

    const frameRect = (win?.frameElement as HTMLElement | null)?.getBoundingClientRect()
    this.tapHandler(x + (frameRect?.left ?? 0), y + (frameRect?.top ?? 0))
  }
}
