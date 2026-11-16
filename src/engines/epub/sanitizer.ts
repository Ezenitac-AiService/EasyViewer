import * as csstree from 'css-tree'
import JSZip from 'jszip'

export const CONTENT_CSP =
  "default-src 'none'; script-src 'none'; object-src 'none'; frame-src 'none'; child-src 'none'; worker-src 'none'; form-action 'none'; base-uri 'none'; connect-src 'none'; style-src 'self' 'unsafe-inline' blob: data:; img-src 'self' blob: data:; font-src 'self' blob: data:"

const MAX_EPUB_ZIP_ENTRIES = 10_000
const MAX_EPUB_UNCOMPRESSED_BYTES = 256 * 1024 * 1024
const MAX_EPUB_SINGLE_ENTRY_BYTES = 128 * 1024 * 1024
const XHTML_NS = 'http://www.w3.org/1999/xhtml'

const ACTIVE_ELEMENTS = new Set([
  'script', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet', 'portal', 'base',
  'foreignobject', 'use', 'animate', 'animatemotion', 'animatetransform', 'set',
  'mpath', 'feimage', 'discard', 'handler', 'listener'
])

const URL_ATTRIBUTES = new Set([
  'href', 'xlink:href', 'src', 'srcset', 'poster', 'ping', 'background', 'action', 'formaction', 'data', 'srcdoc'
])

const SAFE_RASTER_DATA_URI_RE =
  /^data:image\/(?:png|jpe?g|gif|webp|avif|bmp|x-icon)(?:;[a-z0-9=+.-]+)*,/i
const EXPLICIT_SCHEME_RE = /^([a-z][a-z0-9+.-]*):/i

function isBlockedUri(value: string, _blockExternalHttp = true): boolean {
  const normalized = value.replace(/[\s\u0000-\u001f]/g, '')
  if (!normalized) return false
  if (normalized.startsWith('//')) return true

  const schemeMatch = EXPLICIT_SCHEME_RE.exec(normalized)
  if (!schemeMatch) {
    // Relative internal paths and #fragments are allowed
    return false
  }
  const scheme = schemeMatch[1].toLowerCase()
  if (scheme === 'blob') return false
  if (scheme === 'data') {
    return !SAFE_RASTER_DATA_URI_RE.test(normalized)
  }
  // Default-Deny all other schemes (http:, https:, ftp:, javascript:, vbscript:, file:, etc.)
  return true
}

function hasUnsafeSrcset(value: string): boolean {
  return value
    .split(',')
    .map((candidate) => candidate.trim().split(/\s+/)[0] || '')
    .filter(Boolean)
    .some((uri) => isBlockedUri(uri, true))
}

function containsUnsafeCssNode(node: csstree.CssNode): boolean {
  let unsafe = false
  csstree.walk(node, (child) => {
    if (unsafe) return
    if (child.type === 'Url' || child.type === 'String') {
      const raw = child.value.trim().replace(/^['"]|['"]$/g, '')
      if (isBlockedUri(raw, true)) {
        unsafe = true
      }
    } else if (child.type === 'Raw') {
      const normalized = child.value.replace(/\/\*[\s\S]*?\*\//g, '').replace(/[\s\u0000-\u001f]/g, '').toLowerCase()
      if (
        normalized.includes('javascript:') ||
        normalized.includes('vbscript:') ||
        normalized.includes('expression(') ||
        normalized.includes('http://') ||
        normalized.includes('https://') ||
        normalized.includes('data:text/html') ||
        normalized.includes('data:image/svg+xml')
      ) {
        unsafe = true
      }
    } else if (child.type === 'Function') {
      const fnName = child.name.toLowerCase()
      if (fnName === 'expression' || fnName === 'attr') {
        unsafe = true
      }
    }
  })
  return unsafe
}

/**
 * Parses and sanitizes CSS via css-tree AST (Fail-Closed on unrecoverable syntax errors).
 */
export function sanitizeCssWithAst(cssText: string, isInlineStyle = false): string {
  const trimmed = cssText.trim()
  if (!trimmed) return ''

  let ast: csstree.CssNode
  try {
    ast = csstree.parse(trimmed, {
      context: isInlineStyle ? 'declarationList' : 'stylesheet',
      parseAtrulePrelude: true,
      parseRulePrelude: true,
      parseValue: true
    })
  } catch {
    return ''
  }

  csstree.walk(ast, {
    enter(node, item, list) {
      if (!list || !item) return
      if (node.type === 'Raw') {
        // Fail-Closed: drop any unrecoverable/malformed CSS rule or declaration
        list.remove(item)
        return csstree.walk.skip
      }
      if (node.type === 'Atrule') {
        const name = node.name.toLowerCase()
        if (name === 'import' || name === 'namespace' || (name === 'font-face' && containsUnsafeCssNode(node))) {
          list.remove(item)
          return csstree.walk.skip
        }
      } else if (node.type === 'Rule') {
        let hasAttrSelector = false
        if (node.prelude.type === 'SelectorList') {
          csstree.walk(node.prelude, (s) => {
            if (s.type === 'AttributeSelector') hasAttrSelector = true
          })
        }
        if (hasAttrSelector && containsUnsafeCssNode(node.block)) {
          list.remove(item)
          return csstree.walk.skip
        }
      } else if (node.type === 'Declaration') {
        const prop = node.property.toLowerCase()
        if (prop.startsWith('--') && containsUnsafeCssNode(node.value)) {
          list.remove(item)
          return csstree.walk.skip
        }
        if (prop === '-moz-binding' || prop === 'behavior' || containsUnsafeCssNode(node.value)) {
          list.remove(item)
          return csstree.walk.skip
        }
      }
    }
  })

  const generated = csstree.generate(ast)
  if (/javascript:|vbscript:|expression\(/i.test(generated)) {
    return ''
  }
  if (isInlineStyle) return generated
  return generated.replace(/\{([^{}]*)\}/g, (_m: string, body: string) => {
    const cleanBody = body
      .trim()
      .replace(/(^|;)\s*([a-zA-Z-]+)\s*:\s*/g, '$1 $2: ')
      .trim()
    if (!cleanBody) return ' {}'
    return cleanBody.endsWith(';') ? ` { ${cleanBody} }` : ` { ${cleanBody}; }`
  })
}

export async function validateEpubArchiveBounds(buffer: ArrayBuffer): Promise<void> {
  const zip = await JSZip.loadAsync(buffer)
  const entries = Object.values(zip.files)
  if (entries.length > MAX_EPUB_ZIP_ENTRIES) {
    throw new Error(`EPUB 아카이브 엔트리 수(${entries.length})가 허용 상한(${MAX_EPUB_ZIP_ENTRIES}개)을 초과했습니다.`)
  }

  let totalUncompressed = 0
  for (const entry of entries) {
    if (entry.dir) continue
    const dataMeta = (entry as unknown as {
      _data?: { uncompressedSize?: number; compressedSize?: number }
    })._data
    const uncompressed = Number(dataMeta?.uncompressedSize ?? 0)
    const compressed = Number(dataMeta?.compressedSize ?? 0)
    if (uncompressed > MAX_EPUB_SINGLE_ENTRY_BYTES) {
      throw new Error(`EPUB 아카이브 단일 파일 크기가 허용 상한(128 MiB)을 초과했습니다: ${entry.name}`)
    }
    if (compressed > 0 && uncompressed > 32 * 1024 * 1024 && uncompressed / compressed > 300) {
      throw new Error(`EPUB 아카이브 압축률이 비정상적으로 높습니다: ${entry.name}`)
    }
    totalUncompressed += uncompressed
    if (totalUncompressed > MAX_EPUB_UNCOMPRESSED_BYTES) {
      throw new Error('EPUB 아카이브 비압축 총 용량이 허용 상한(256 MiB)을 초과했습니다.')
    }
  }
}

export function sanitizeSectionDocument(doc: Document): void {
  const root = doc?.documentElement
  if (!root) return

  for (const el of Array.from(doc.getElementsByTagNameNS('*', '*'))) {
    const localName = (el.localName || el.tagName || '').toLowerCase()
    if (ACTIVE_ELEMENTS.has(localName)) {
      el.remove()
      continue
    }
    if (localName === 'meta' && /refresh/i.test(el.getAttribute('http-equiv') || '')) {
      el.remove()
      continue
    }
    if (localName === 'link') {
      const rel = (el.getAttribute('rel') || '').toLowerCase().trim()
      const href = el.getAttribute('href') || ''
      if (rel !== 'stylesheet' || isBlockedUri(href, true)) {
        el.remove()
        continue
      }
    }
    if (localName === 'style' && el.textContent) {
      el.textContent = sanitizeCssWithAst(el.textContent, false)
    }
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase()
      const localAttr = (attr.localName || attr.name).toLowerCase()
      if (name.startsWith('on')) {
        el.removeAttributeNode(attr)
        continue
      }
      if (URL_ATTRIBUTES.has(name) || URL_ATTRIBUTES.has(localAttr)) {
        const block =
          name === 'srcdoc' ||
          name === 'ping' ||
          (name === 'srcset' ? hasUnsafeSrcset(attr.value) : isBlockedUri(attr.value, true))
        if (block) {
          el.removeAttributeNode(attr)
          continue
        }
      }
      if (name === 'style') {
        const cleaned = sanitizeCssWithAst(attr.value, true)
        if (cleaned) el.setAttribute('style', cleaned)
        else el.removeAttributeNode(attr)
      }
    }
  }

  const ns = root.namespaceURI || XHTML_NS
  let head = doc.getElementsByTagNameNS('*', 'head')[0]
  if (!head) {
    head = doc.createElementNS(ns, 'head')
    root.insertBefore(head, root.firstChild)
  }
  const existingCsp = Array.from(head.getElementsByTagNameNS('*', 'meta')).find(
    (meta) => meta.getAttribute('http-equiv')?.toLowerCase() === 'content-security-policy'
  )
  if (existingCsp) existingCsp.remove()

  const csp = doc.createElementNS(ns, 'meta')
  csp.setAttribute('http-equiv', 'Content-Security-Policy')
  csp.setAttribute('content', CONTENT_CSP)
  head.insertBefore(csp, head.firstChild)
}
