// SPDX-License-Identifier: GPL-3.0-only
import fs from 'node:fs'
import path from 'node:path'
import { anchorsOf, eachOutsideFences } from './markdown.mjs'

/**
 * Link rule D5 (spec 005 contracts/doc-checks.md): every in-repository link of a public document
 * points at an existing file, and every `#anchor` matches a heading anchor of its target
 * (GitHub rules, see markdown.mjs). External URLs are not fetched.
 */

export const PUBLIC_DOCS = [
  'README.md', 'README.en.md', 'CONTRIBUTING.md', 'CONTRIBUTING.en.md', 'SECURITY.md', 'SECURITY.en.md',
  'CHANGELOG.md', 'CHANGELOG.en.md', 'NOTICE', 'NOTICE.en.md', 'THIRD_PARTY_LICENSES.md', 'THIRD_PARTY_LICENSES.en.md'
]

/** Link targets on one line: badge images inside link text are dropped, inline code is ignored. */
function targetsOf(line) {
  const plain = line
    .replace(/`[^`]*`/g, '')
    .replace(/!\[[^\]]*\]\(\S+?\)(?=\]\()/g, 'IMG')
    .replace(/!\[[^\]]*\]\(\S+?\)/g, '')
  return [...plain.matchAll(/\[[^\]]*\]\((\S+?)(?:\s+"[^"]*")?\)/g)].map((m) => m[1])
}

export function checkLinks(root, files = PUBLIC_DOCS) {
  const errors = []
  const anchorCache = new Map()
  const anchorsFor = (rel) => {
    if (!anchorCache.has(rel)) anchorCache.set(rel, anchorsOf(fs.readFileSync(path.join(root, rel), 'utf-8')))
    return anchorCache.get(rel)
  }
  for (const file of files) {
    const abs = path.join(root, file)
    if (!fs.existsSync(abs)) continue
    eachOutsideFences(fs.readFileSync(abs, 'utf-8'), (line, i) => {
      for (const target of targetsOf(line)) {
        if (/^[a-z][a-z0-9+.-]*:/i.test(target)) continue // http(s), mailto, …
        const [rawPath, rawAnchor] = target.split('#')
        const rel = rawPath ? path.posix.normalize(path.posix.join(path.posix.dirname(file), decodeURIComponent(rawPath))) : file
        const where = `${file}:${i + 1}`
        if (!fs.existsSync(path.join(root, rel))) {
          errors.push(`${where}: 링크 대상 파일이 없습니다(${target})`)
          continue
        }
        if (rawAnchor === undefined) continue
        const anchor = decodeURIComponent(rawAnchor)
        const isMarkdown = rel.endsWith('.md') || rel === 'NOTICE'
        if (!isMarkdown || !anchorsFor(rel).has(anchor)) errors.push(`${where}: 앵커 #${anchor}가 ${rel}에 없습니다`)
      }
    })
  }
  return errors
}
