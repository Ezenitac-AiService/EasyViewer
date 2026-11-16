import { expect, test } from '@playwright/test'
import { createCleanEpubBuffer } from '../fixtures/bookFixtures'

test.describe('Library flow characterization (Tier 2)', () => {
  test('imports book file, filters via search, creates bookmark in reader, and deletes book', async ({
    page
  }) => {
    await page.goto('/')
    await expect(page.locator('main h2', { hasText: '윤동주 시선' })).toBeVisible()

    const epubBuf = await createCleanEpubBuffer({ title: '서재 흐름 테스트 도서', author: '작가A' })
    await page.locator('input[type="file"]').setInputFiles({
      name: 'flow-test.epub',
      mimeType: 'application/epub+zip',
      buffer: Buffer.from(epubBuf)
    })

    const targetCard = page.locator('main h2', { hasText: '서재 흐름 테스트 도서' }).first()
    await expect(targetCard).toBeVisible({ timeout: 15000 })

    // Filter library grid by search query
    const searchInput = page.getByPlaceholder('서재 내 제목·저자 검색...')
    await searchInput.fill('서재 흐름 테스트')
    await expect(targetCard).toBeVisible()
    await expect(page.locator('main h2', { hasText: '윤동주 시선' })).toHaveCount(0)

    await searchInput.fill('')
    await targetCard.click()

    // Add bookmark in reader and verify counter increments
    await expect(page.locator('header h1')).toContainText('서재 흐름 테스트 도서', { timeout: 15000 })
    await page.getByTitle('현재 위치 책갈피 추가 (Ctrl+B)').click()
    await expect(page.getByTitle('책갈피 목록 보기')).toContainText('1')

    // Return and remove imported book
    await page.getByTitle('서재로 돌아가기').click()
    const cardContainer = page.locator('main .grid > div', { hasText: '서재 흐름 테스트 도서' }).first()
    await cardContainer.hover()
    await cardContainer.getByTitle('서재에서 삭제').click()
    await expect(page.locator('main h2', { hasText: '서재 흐름 테스트 도서' })).toHaveCount(0)
  })
})
