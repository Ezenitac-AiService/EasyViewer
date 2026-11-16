import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useSettingsStore } from '@/stores/useSettingsStore'

describe('useSettingsStore characterization', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    document.documentElement.className = ''
  })

  it('clamps fontSize, lineHeight, and pageMargin within allowed bounds', () => {
    const store = useSettingsStore()

    store.setFontSize(4)
    expect(store.settings.fontSize).toBe(12)
    store.setFontSize(100)
    expect(store.settings.fontSize).toBe(36)

    store.setLineHeight(0.5)
    expect(store.settings.lineHeight).toBe(1.2)
    store.setLineHeight(4)
    expect(store.settings.lineHeight).toBe(2.6)

    store.setPageMargin(2)
    expect(store.settings.pageMargin).toBe(12)
    store.setPageMargin(120)
    expect(store.settings.pageMargin).toBe(80)
  })

  it('switches viewMode and applies theme classes on documentElement', async () => {
    const store = useSettingsStore()
    await store.initSettings()

    store.setViewMode('paginated')
    expect(store.settings.viewMode).toBe('paginated')

    store.setTheme('dark')
    expect(document.documentElement.classList.contains('theme-dark')).toBe(true)
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    store.setTheme('sepia')
    expect(document.documentElement.classList.contains('theme-sepia')).toBe(true)
    expect(document.documentElement.classList.contains('dark')).toBe(false)

    store.resetSettings()
    expect(store.settings.viewMode).toBe('scroll')
    expect(store.settings.theme).toBe('light')
  })
})
