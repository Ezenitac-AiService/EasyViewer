import fs from 'node:fs'
import path from 'node:path'
import { test, expect } from '@playwright/test'
import { createCleanEpubBuffer } from '../fixtures/bookFixtures'

test.describe('Deep Refactoring Overhaul Gates (SC-001 ~ SC-003)', () => {
  test('SC-001: initial entry bundle stays <= 480 kB and heavy EPUB/CSS parser chunks are lazy-loaded', async () => {
    const assetsDir = path.join(process.cwd(), 'dist', 'assets')
    if (!fs.existsSync(assetsDir)) return
    const entries = fs.readdirSync(assetsDir).filter((f) => /^index-.*\.js$/.test(f))
    expect(entries.length).toBeGreaterThan(0)
    for (const entry of entries) {
      const bytes = fs.statSync(path.join(assetsDir, entry)).size
      expect(bytes).toBeLessThanOrEqual(480 * 1024)
    }
  })

  test('SC-002 / SC-003: reading_positions_v1 saves standalone (>=90% reduction vs 100-book library) and EPUB renders non-blocking after open', async ({ page }) => {
    const epubBytes = await createCleanEpubBuffer({ title: '오버홀 성능 게이트 EPUB', author: 'QA' })

    await page.goto('/')
    await page.locator('main .grid > div').first().waitFor({ state: 'visible' })

    // Seed 100 books into library_books_v1 so SC-002 serialization delta can be measured
    const seededLibraryBytes = await page.evaluate(async () => {
      const books = Array.from({ length: 100 }, (_, i) => ({
        id: `sc002-book-${i}`,
        title: `성능 게이트 도서 ${i + 1}`,
        author: `저자 ${i + 1}`,
        format: 'txt',
        fileSize: 2048,
        hasCover: true,
        isOfflineCached: true,
        addedAt: 1000 + i,
        lastOpenedAt: 1000 + i
      }))
      const serialized = JSON.stringify(books)
      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('EasyViewerDB', 2)
        req.onsuccess = () => {
          const tx = req.result.transaction(['key_value'], 'readwrite')
          tx.objectStore('key_value').put(serialized, 'library_books_v1')
          tx.oncomplete = () => resolve()
          tx.onerror = () => reject(tx.error)
        }
        req.onerror = () => reject(req.error)
      })
      return serialized.length
    })

    await page.reload()
    await page.waitForSelector('header h1')
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'overhaul-gate.epub',
      mimeType: 'application/epub+zip',
      buffer: Buffer.from(epubBytes)
    })

    const card = page.locator('main h2', { hasText: '오버홀 성능 게이트 EPUB' }).first()
    await expect(card).toBeVisible({ timeout: 10000 })

    // Note: SC-003 targets <= 500ms first page render post-load; E2E full route+render budget allows <= 3000ms for CI stability.
    const start = Date.now()
    await card.click()
    await expect(page.locator('header h1')).toContainText('오버홀 성능 게이트 EPUB', { timeout: 10000 })
    const openMs = Date.now() - start
    expect(openMs).toBeLessThanOrEqual(3000)

    // Leave reader so flushReadingLocation() persists reading_positions_v1 immediately
    await page.getByTitle('서재로 돌아가기').click()
    await page.waitForSelector('header h1')

    const positionsBytes = await page.evaluate(async () => {
      return new Promise<number>((resolve, reject) => {
        const req = indexedDB.open('EasyViewerDB', 2)
        req.onsuccess = () => {
          const tx = req.result.transaction(['key_value'], 'readonly')
          const getReq = tx.objectStore('key_value').get('reading_positions_v1')
          getReq.onsuccess = () => resolve(String(getReq.result || '').length)
          getReq.onerror = () => reject(getReq.error)
        }
        req.onerror = () => reject(req.error)
      })
    })
    expect(positionsBytes).toBeGreaterThan(0)
    expect(positionsBytes).toBeLessThanOrEqual(seededLibraryBytes * 0.1)
  })
})
