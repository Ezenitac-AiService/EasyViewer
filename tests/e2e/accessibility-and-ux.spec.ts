import { test, expect } from '@playwright/test'
import { createCleanEpubBuffer } from '../fixtures/bookFixtures'

test.describe('Accessibility & UX Gates (T039)', () => {
  test('supports modal Escape/focus restoration and InAppConfirmModal deletion across themes', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('header h1')

    // Open remote download modal via header button and verify role="dialog" + Escape close
    const downloadBtn = page.getByRole('button', { name: '다운로드' })
    await downloadBtn.focus()
    await downloadBtn.press('Enter')

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog).toHaveAttribute('aria-modal', 'true')

    // Verify Tab / Shift+Tab stays inside dialog focus trap
    const focusables = dialog.locator('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
    const count = await focusables.count()
    expect(count).toBeGreaterThan(1)
    for (let i = 0; i < count + 2; i++) {
      await page.keyboard.press('Tab')
      const insideDialog = await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')))
      expect(insideDialog).toBe(true)
    }
    await page.keyboard.press('Shift+Tab')
    const stillInside = await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')))
    expect(stillInside).toBe(true)

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(downloadBtn).toBeFocused()

    // Trigger sample book delete using InAppConfirmModal across light, sepia, and dark themes
    const themeBtn = page.getByTitle(/현재 테마:/)
    for (const expectedThemeClass of ['theme-light', 'theme-sepia', 'theme-dark'] as const) {
      if (expectedThemeClass !== 'theme-light') {
        await themeBtn.click()
        await expect(page.locator('html')).toHaveClass(new RegExp(expectedThemeClass))
      }
      const card = page.locator('main .grid > div', { hasText: '윤동주 시선' }).first()
      await card.hover()
      await card.getByTitle('서재에서 삭제').click()

      const confirmDialog = page.getByRole('dialog')
      await expect(confirmDialog).toBeVisible()
      await confirmDialog.getByRole('button', { name: '취소' }).click()
      await expect(confirmDialog).toBeHidden()
    }
    await expect(page.locator('main h2', { hasText: '윤동주 시선' })).toBeVisible()
  })

  test('renders multi-chapter EPUB first view quickly without blocking UI', async ({ page }) => {
    const epubBytes = await createCleanEpubBuffer({ title: '대용량 성능 테스트 EPUB', author: 'Tester' })

    await page.goto('/')
    await page.waitForSelector('header h1')
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'perf-12ch.epub',
      mimeType: 'application/epub+zip',
      buffer: Buffer.from(epubBytes)
    })

    const card = page.locator('main h2', { hasText: '대용량 성능 테스트 EPUB' }).first()
    await expect(card).toBeVisible({ timeout: 10000 })

    const t0 = Date.now()
    await card.click()
    await expect(page.locator('header h1')).toContainText('대용량 성능 테스트 EPUB', { timeout: 10000 })
    const elapsedMs = Date.now() - t0
    expect(elapsedMs).toBeLessThanOrEqual(3000)
  })
})
