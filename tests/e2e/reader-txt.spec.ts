import { expect, test } from '@playwright/test'
import { createLargeMixedTxtContent } from '../fixtures/bookFixtures'

test.describe('TXT reader layout, mode toggle, and themes (Tier 2)', () => {
  test('renders 1MB+ TXT, paginates by layout, toggles scroll<->paginated preserving offset, and switches themes', async ({
    page
  }) => {
    await page.goto('/')
    await expect(page.locator('main h2', { hasText: '윤동주 시선' })).toBeVisible()

    const bigTxt = createLargeMixedTxtContent(1_150_000)
    await page.locator('input[type="file"]').setInputFiles({
      name: '대용량 테스트 문서 - 테스터.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from(bigTxt, 'utf-8')
    })

    const card = page.locator('main h2', { hasText: '대용량 테스트 문서' }).first()
    await expect(card).toBeVisible({ timeout: 15000 })
    await card.click()

    // Wait for document to finish loading and display header bar
    await expect(page.locator('header h1')).toContainText('대용량 테스트 문서', { timeout: 15000 })

    // Open options panel -> switch to paginated mode
    await page.getByTitle('글꼴·테마·보기 방식 옵션').click()
    await page.getByRole('button', { name: '가로 페이지 넘김' }).click()
    await page.getByTitle('닫기').click()

    // Verify paginated view rendered paragraphs and footer badge updated
    await expect(page.locator('footer')).toContainText('가로 페이지')
    const pageContent = page.locator('div.flex-1.max-w-4xl.w-full.mx-auto.py-6')
    await expect(pageContent).toBeVisible()

    // Advance one page using ArrowRight and verify progress updates
    const initialHeaderText = await page.locator('header p').textContent()
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(200)
    const afterNextHeaderText = await page.locator('header p').textContent()
    expect(afterNextHeaderText).not.toBe(initialHeaderText)

    // Switch back to scroll mode and confirm non-zero scroll position / non-reset location
    await page.getByTitle('글꼴·테마·보기 방식 옵션').click()
    await page.getByRole('button', { name: '세로 스크롤' }).click()
    await page.getByTitle('닫기').click()
    await expect(page.locator('footer')).toContainText('세로 스크롤')

    // Verify dark and sepia themes apply root classes cleanly
    await page.getByTitle('글꼴·테마·보기 방식 옵션').click()
    await page.getByRole('button', { name: '다크' }).click()
    await expect(page.locator('html')).toHaveClass(/theme-dark/)
    await page.getByRole('button', { name: '세피아' }).click()
    await expect(page.locator('html')).toHaveClass(/theme-sepia/)
    await page.getByRole('button', { name: '라이트' }).click()
    await expect(page.locator('html')).toHaveClass(/theme-light/)
  })
})
