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

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.getAttribute('aria-hidden') !== 'true' && !el.hasAttribute('disabled')
  )
}

/**
 * Implements WAI-ARIA dialog focus trap, Escape closing, and trigger focus restoration.
 */
export function useAccessibleDialog(options: AccessibleDialogOptions) {
  let previousActiveElement: HTMLElement | null = null
  let listenerAttached = false

  const handleKeyDown = (event: KeyboardEvent): void => {
    if (!options.isOpen.value) return

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
        attachListener()
        await nextTick()
        const initial = options.initialFocusRef?.value
        if (initial && typeof initial.focus === 'function') {
          initial.focus()
          return
        }
        const container = options.containerRef.value
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
        detachListener()
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
    detachListener()
  })
}
