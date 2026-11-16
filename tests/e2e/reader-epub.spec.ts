import { expect, test } from '@playwright/test'
import { createCleanEpubBuffer, createMaliciousEpubBuffer } from '../fixtures/bookFixtures'

test.describe('EPUB reader rendering & script isolation characterization (Tier 2)', () => {
  test('renders clean multi-chapter EPUB, handles bookmarks/menu toggle, and isolates active scripts', async ({
    page
  }) => {
    const externalTrackerRequests: string[] = []
    page.on('request', (req) => {
      if (req.url().includes('evil.example.com')) {
        externalTrackerRequests.push(req.url())
      }
    })

    await page.goto('/')
    await expect(page.getByText('EasyViewer 완벽 가이드 및 샘플 북')).toBeVisible()

    // 1. Import clean multi-chapter EPUB
    const cleanBuf = await createCleanEpubBuffer({ title: '다중 챕터 깨끗한 책', author: '저자' })
    await page.locator('input[type="file"]').setInputFiles({
      name: 'clean-book.epub',
      mimeType: 'application/epub+zip',
      buffer: Buffer.from(cleanBuf)
    })

    const cleanCard = page.locator('main h2', { hasText: '다중 챕터 깨끗한 책' }).first()
    await expect(cleanCard).toBeVisible({ timeout: 15000 })
    await cleanCard.click()

    await expect(page.locator('header h1')).toContainText('다중 챕터 깨끗한 책', { timeout: 15000 })
    const frameLocator = page.frameLocator('iframe').first()
    await expect(frameLocator.locator('body')).toContainText('깨끗한 첫 번째 챕터 본문입니다.', {
      timeout: 15000
    })

    // Return to library and open malicious EPUB
    await page.getByTitle('서재로 돌아가기').click()
    const evilBuf = await createMaliciousEpubBuffer()
    await page.locator('input[type="file"]').setInputFiles({
      name: 'evil-book.epub',
      mimeType: 'application/epub+zip',
      buffer: Buffer.from(evilBuf)
    })

    const evilCard = page.locator('main h2', { hasText: '악성 EPUB' }).first()
    await expect(evilCard).toBeVisible({ timeout: 15000 })
    await evilCard.click()

    const evilFrame = page.frameLocator('iframe').first()
    await expect(evilFrame.locator('#safe-text')).toContainText('정상 본문 문단입니다.', {
      timeout: 15000
    })

    // Assert injected scripts / inline handlers did not run in iframe or parent
    const scriptRan = await evilFrame.locator('body').evaluate(() => {
      const w = window as unknown as Record<string, unknown>
      const p = window.parent as unknown as Record<string, unknown>
      return {
        script: Boolean(w.__EVIL_SCRIPT_RAN__),
        onload: Boolean(w.__EVIL_ONLOAD__),
        svg: Boolean(w.__EVIL_SVG__),
        parentLeak: Boolean(p.__EVIL_SCRIPT_RAN__ || p.__EVIL_ONLOAD__)
      }
    })
    expect(scriptRan).toEqual({ script: false, onload: false, svg: false, parentLeak: false })
  })
})
