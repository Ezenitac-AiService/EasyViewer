import 'fake-indexeddb/auto'
import { afterEach, vi } from 'vitest'
import { clearMocks } from '@tauri-apps/api/mocks'

const createdObjectUrls = new Map<string, Blob>()
let objectUrlCounter = 0

if (typeof URL.createObjectURL !== 'function') {
  Object.defineProperty(URL, 'createObjectURL', {
    value: (blob: Blob) => {
      const id = `blob:vitest-${++objectUrlCounter}`
      createdObjectUrls.set(id, blob)
      return id
    },
    configurable: true
  })
}

if (typeof URL.revokeObjectURL !== 'function') {
  Object.defineProperty(URL, 'revokeObjectURL', {
    value: (url: string) => {
      createdObjectUrls.delete(url)
    },
    configurable: true
  })
}

if (typeof globalThis.crypto === 'undefined') {
  // Node.js 24 provides WebCrypto on globalThis.crypto; guard fallback for edge jsdom setups
  Object.defineProperty(globalThis, 'crypto', {
    value: {
      randomUUID: () => `test-uuid-${Math.random().toString(16).slice(2)}`
    },
    configurable: true
  })
} else if (typeof globalThis.crypto.randomUUID !== 'function') {
  Object.defineProperty(globalThis.crypto, 'randomUUID', {
    value: () => `test-uuid-${Math.random().toString(16).slice(2)}`,
    configurable: true
  })
}

if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    })),
    configurable: true
  })
}

afterEach(() => {
  clearMocks()
  vi.restoreAllMocks()
  delete (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__
  delete (window as unknown as { __TAURI__?: unknown }).__TAURI__
  if (typeof localStorage !== 'undefined') {
    localStorage.clear()
  }
  createdObjectUrls.clear()
})
