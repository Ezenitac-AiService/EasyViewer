import { nextTick, onBeforeUnmount, watch, type Ref } from 'vue'

export interface AccessibleDialogOptions {
  isOpen: Ref<boolean>
  containerRef: Ref<HTMLElement | null>
  initialFocusRef?: Ref<HTMLElement | null>
  onClose: () => void
  closeOnEscape?: boolean
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(', ')

const activeDialogStack: symbol[] = []

function isElementVisible(el: HTMLElement): boolean {
  if (el.hasAttribute('disabled') || el.hasAttribute('hidden')) return false
  if (el.getAttribute('aria-hidden') === 'true') return false
  if (el.closest('[hidden], [inert], [aria-hidden="true"]')) return false
  if (el.style.display === 'none' || el.style.visibility === 'hidden') return false
  if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
    const style = window.getComputedStyle(el)
    if (style.display === 'none' || style.visibility === 'hidden') return false
  }
  return true
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    isElementVisible
  )
}

function setBackgroundSiblingsInert(container: HTMLElement, tracked: Set<HTMLElement>): void {
  if (typeof document === 'undefined') return
  const targets = document.querySelectorAll<HTMLElement>('main, header, nav, footer')
  for (const el of Array.from(targets)) {
    if (!el.contains(container) && !container.contains(el) && !el.hasAttribute('inert')) {
      el.setAttribute('inert', '')
      tracked.add(el)
    }
  }
}

function clearTrackedInert(tracked: Set<HTMLElement>): void {
  if (activeDialogStack.length > 0) return
  for (const el of tracked) {
    el.removeAttribute('inert')
  }
  tracked.clear()
}

/**
 * Implements WAI-ARIA dialog focus trap, visibility filtering, nested dialog stack,
 * background inert isolation, Escape closing, and trigger focus restoration.
 */
export function useAccessibleDialog(options: AccessibleDialogOptions) {
  const dialogId = Symbol('accessible-dialog')
  const inertMarked = new Set<HTMLElement>()
  let previousActiveElement: HTMLElement | null = null
  let listenerAttached = false

  const isTopmostDialog = (): boolean =>
    activeDialogStack.length === 0 || activeDialogStack[activeDialogStack.length - 1] === dialogId

  const handleKeyDown = (event: KeyboardEvent): void => {
    if (!options.isOpen.value || !isTopmostDialog()) return

    if (event.key === 'Escape' && options.closeOnEscape !== false) {
      event.preventDefault()
      event.stopPropagation()
      options.onClose()
      return
    }

    if (event.key !== 'Tab') return
    const container = options.containerRef.value
    if (!container) return

    const focusables = getFocusableElements(container)
    if (focusables.length === 0) {
      event.preventDefault()
      container.focus()
      return
    }

    const active = document.activeElement as HTMLElement | null
    const currentIdx = active ? focusables.indexOf(active) : -1

    // Explicit index cycling prevents WebKit from skipping non-input controls on Tab/Shift+Tab.
    event.preventDefault()
    if (event.shiftKey) {
      const prevIdx = currentIdx <= 0 ? focusables.length - 1 : currentIdx - 1
      focusables[prevIdx].focus()
    } else {
      const nextIdx = currentIdx < 0 || currentIdx >= focusables.length - 1 ? 0 : currentIdx + 1
      focusables[nextIdx].focus()
    }
  }

  const pushDialogStack = (): void => {
    const idx = activeDialogStack.indexOf(dialogId)
    if (idx >= 0) activeDialogStack.splice(idx, 1)
    activeDialogStack.push(dialogId)
  }

  const popDialogStack = (): void => {
    const idx = activeDialogStack.indexOf(dialogId)
    if (idx >= 0) activeDialogStack.splice(idx, 1)
  }

  const attachListener = (): void => {
    if (listenerAttached || typeof document === 'undefined') return
    document.addEventListener('keydown', handleKeyDown, true)
    listenerAttached = true
  }

  const detachListener = (): void => {
    if (!listenerAttached || typeof document === 'undefined') return
    document.removeEventListener('keydown', handleKeyDown, true)
    listenerAttached = false
  }

  watch(
    () => options.isOpen.value,
    async (open) => {
      if (open) {
        previousActiveElement =
          typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null
        pushDialogStack()
        attachListener()
        await nextTick()
        const container = options.containerRef.value
        if (container) {
          setBackgroundSiblingsInert(container, inertMarked)
        }
        const initial = options.initialFocusRef?.value
        if (initial && typeof initial.focus === 'function' && isElementVisible(initial)) {
          initial.focus()
          return
        }
        if (container) {
          const focusables = getFocusableElements(container)
          if (focusables.length > 0) {
            focusables[0].focus()
          } else {
            if (!container.hasAttribute('tabindex')) container.setAttribute('tabindex', '-1')
            container.focus()
          }
        }
      } else {
        popDialogStack()
        detachListener()
        clearTrackedInert(inertMarked)
        const target = previousActiveElement
        previousActiveElement = null
        if (target && target.isConnected && typeof target.focus === 'function') {
          target.focus()
        }
        await nextTick()
        if (target && target.isConnected && typeof target.focus === 'function') {
          target.focus()
        }
      }
    },
    { immediate: true }
  )

  onBeforeUnmount(() => {
    popDialogStack()
    detachListener()
    clearTrackedInert(inertMarked)
  })
}
