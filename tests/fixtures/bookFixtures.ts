import JSZip from 'jszip'

const SAMPLE_KOREAN_PARAGRAPH =
  '하늘과 바람과 별과 시 — 윤동주. 죽는 날까지 하늘을 우러러 한 점 부끄럼이 없기를, 잎새에 이는 바람에도 나는 괴로워했다. '
const SAMPLE_ENGLISH_PARAGRAPH =
  'Typography, layout stability, and offline-first reading performance matter across desktop and mobile devices. '

/**
 * Generates deterministic Korean + English UTF-8 text exceeding targetBytes (default ~1.1 MiB).
 */
export function createLargeMixedTxtContent(targetBytes = 1_150_000): string {
  const unit = `제1장 밤의 서재\n${SAMPLE_KOREAN_PARAGRAPH}${SAMPLE_ENGLISH_PARAGRAPH}\n\n`
  const unitBytes = new TextEncoder().encode(unit).byteLength
  const repeats = Math.max(1, Math.ceil(targetBytes / unitBytes))
  const chunks: string[] = []
  for (let i = 0; i < repeats; i++) {
    chunks.push(`[단락 ${i + 1}] ${unit}`)
  }
  return chunks.join('')
}

/**
 * Builds a clean valid EPUB 3 archive with multiple chapters, internal CSS, SVG asset, and 1x1 PNG image.
 */
export async function createCleanEpubBuffer(options?: {
  title?: string
  author?: string
}): Promise<ArrayBuffer> {
  const title = options?.title ?? '테스트 전자책'
  const author = options?.author ?? '테스트 작가'
  const zip = new JSZip()

  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })
  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/xhtml+xml"/>
  </rootfiles>
</container>`
  )
  // Fix media-type to opf+xml
  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
  )

  zip.file(
    'OEBPS/styles/book.css',
    `body { line-height: 1.75; } .accent { color: rgb(37, 99, 235); font-weight: bold; } .inline-art { width: 24px; height: 24px; }`
  )

  // Minimal 1x1 PNG (transparent pixel)
  const pngBytes = Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41,
    0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
    0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
    0x42, 0x60, 0x82
  ])
  zip.file('OEBPS/images/pixel.png', pngBytes)
  zip.file(
    'OEBPS/images/mark.svg',
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#2563eb"/></svg>`
  )

  zip.file(
    'OEBPS/toc.ncx',
    `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head><meta name="dtb:uid" content="easyviewer-test-book"/></head>
  <docTitle><text>${title}</text></docTitle>
  <navMap>
    <navPoint id="nav1" playOrder="1"><navLabel><text>1장 시작</text></navLabel><content src="text/ch1.xhtml"/></navPoint>
    <navPoint id="nav2" playOrder="2"><navLabel><text>2장 전개</text></navLabel><content src="text/ch2.xhtml"/></navPoint>
  </navMap>
</ncx>`
  )

  zip.file(
    'OEBPS/nav.xhtml',
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>목차</title></head>
<body>
  <nav epub:type="toc" id="toc">
    <ol>
      <li><a href="text/ch1.xhtml">1장 시작</a></li>
      <li><a href="text/ch2.xhtml">2장 전개</a></li>
    </ol>
  </nav>
</body>
</html>`
  )

  zip.file(
    'OEBPS/text/ch1.xhtml',
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>1장 시작</title>
  <link rel="stylesheet" type="text/css" href="../styles/book.css"/>
</head>
<body>
  <h1>1장 시작</h1>
  <p class="accent">깨끗한 첫 번째 챕터 본문입니다.</p>
  <p>텍스트 선택과 탭 상호작용 확인용 문단입니다.</p>
  <img src="../images/pixel.png" alt="테스트 이미지" class="inline-art"/>
  <img src="../images/mark.svg" alt="테스트 벡터" class="inline-art"/>
</body>
</html>`
  )

  zip.file(
    'OEBPS/text/ch2.xhtml',
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>2장 전개</title>
  <link rel="stylesheet" type="text/css" href="../styles/book.css"/>
</head>
<body>
  <h1>2장 전개</h1>
  <p>두 번째 챕터 본문입니다. 다중 챕터 CSS 및 이미지 상대경로 렌더링을 검증합니다.</p>
</body>
</html>`
  )

  zip.file(
    'OEBPS/content.opf',
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">easyviewer-test-book</dc:identifier>
    <dc:title>${title}</dc:title>
    <dc:creator>${author}</dc:creator>
    <dc:language>ko</dc:language>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="css" href="styles/book.css" media-type="text/css"/>
    <item id="img-png" href="images/pixel.png" media-type="image/png"/>
    <item id="img-svg" href="images/mark.svg" media-type="image/svg+xml"/>
    <item id="ch1" href="text/ch1.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch2" href="text/ch2.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine toc="ncx">
    <itemref idref="ch1"/>
    <itemref idref="ch2"/>
  </spine>
</package>`
  )

  return zip.generateAsync({ type: 'arraybuffer' })
}

/**
 * Builds an EPUB containing active XSS / external leak / SVG / CSS attack vectors.
 */
export async function createMaliciousEpubBuffer(): Promise<ArrayBuffer> {
  const zip = new JSZip()
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })
  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
  )
  zip.file('OEBPS/nav.xhtml', `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Nav</title></head><body><nav><ol><li><a href="ch1.xhtml">악성</a></li></ol></nav></body></html>`)
  zip.file(
    'OEBPS/ch1.xhtml',
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Attack Chapter</title>
  <base href="https://evil.example.com/"/>
  <meta http-equiv="refresh" content="0;url=https://evil.example.com/"/>
  <style>
    @import url("https://evil.example.com/leak.css");
    .legacy { width: expression(alert(1)); background: url("javascript:alert(2)"); }
  </style>
  <script>window.__EVIL_SCRIPT_RAN__ = true;</script>
</head>
<body onload="window.__EVIL_ONLOAD__ = true">
  <h1>악성 콘텐츠 격리 테스트</h1>
  <p id="safe-text" onclick="window.__EVIL_CLICK__ = true">정상 본문 문단입니다.</p>
  <a id="evil-link" href="javascript:window.__EVIL_LINK__=1">위험 링크</a>
  <iframe src="https://evil.example.com/frame"></iframe>
  <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
    <script>window.__EVIL_SVG__ = true;</script>
    <foreignObject><div onclick="window.__EVIL_FO__=1">FO</div></foreignObject>
    <use xlink:href="javascript:alert(3)"/>
    <animate attributeName="href" values="javascript:alert(4)"/>
  </svg>
  <img src="https://evil.example.com/tracker.png" alt="tracker"/>
  <img src="data:image/svg+xml;utf8,%3Csvg%20onload%3Dalert(5)%3E" alt="svgdata"/>
</body>
</html>`
  )
  zip.file(
    'OEBPS/content.opf',
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">evil-epub</dc:identifier>
    <dc:title>악성 EPUB</dc:title>
    <dc:creator>Attacker</dc:creator>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine><itemref idref="ch1"/></spine>
</package>`
  )
  return zip.generateAsync({ type: 'arraybuffer' })
}

/**
 * Generates an EPUB-like zip archive exceeding either entry count or decompressed size limits (Zip Bomb fixture).
 */
export async function createZipBombArchiveBuffer(mode: 'too-many-entries' | 'oversized-uncompressed' = 'too-many-entries'): Promise<ArrayBuffer> {
  const zip = new JSZip()
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })
  if (mode === 'too-many-entries') {
    for (let i = 0; i < 10050; i++) {
      zip.file(`entries/e_${i}.txt`, 'a', { compression: 'STORE' })
    }
  } else {
    // Highly compressible repeated zeros (~270 MiB decompressed total) compressed tightly in memory
    const chunk = new Uint8Array(10 * 1024 * 1024) // 10 MiB zeroes
    for (let i = 0; i < 27; i++) {
      zip.file(`OEBPS/blob_${i}.bin`, chunk, { compression: 'DEFLATE', compressionOptions: { level: 9 } })
    }
  }
  return zip.generateAsync({ type: 'arraybuffer' })
}

/**
 * Malicious WebDAV PROPFIND XML response containing path traversal and control characters in href/displayname.
 */
export const MALICIOUS_WEBDAV_PROPFIND_XML = `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>/books/</D:href>
    <D:propstat><D:prop><D:resourcetype><D:collection/></D:resourcetype></D:prop><D:status>HTTP/1.1 200 OK</D:status></D:propstat>
  </D:response>
  <D:response>
    <D:href>/books/../../etc/passwd.txt</D:href>
    <D:propstat><D:prop><D:displayname>../../etc/passwd.txt</D:displayname><D:getcontentlength>128</D:getcontentlength></D:prop><D:status>HTTP/1.1 200 OK</D:status></D:propstat>
  </D:response>
  <D:response>
    <D:href>/books/bad%00null%07ctrl.epub</D:href>
    <D:propstat><D:prop><D:displayname>bad\tctrl.epub</D:displayname><D:getcontentlength>256</D:getcontentlength></D:prop><D:status>HTTP/1.1 200 OK</D:status></D:propstat>
  </D:response>
  <D:response>
    <D:href>/books/valid-novel.epub</D:href>
    <D:propstat><D:prop><D:displayname>valid-novel.epub</D:displayname><D:getcontentlength>4096</D:getcontentlength></D:prop><D:status>HTTP/1.1 200 OK</D:status></D:propstat>
  </D:response>
</D:multistatus>`
