// SPDX-License-Identifier: GPL-3.0-only
import fs from 'node:fs'
import path from 'node:path'
import { headings, numberedSections } from './markdown.mjs'

/**
 * Pair outline rule D4 (spec 005 contracts/doc-checks.md): the Korean document and its English
 * counterpart have the same `##`/`###` level sequence (code fences ignored). The plain-text NOTICE
 * is compared by its numbered sections against `## N.` sections in NOTICE.en.md.
 */

const PAIRS = [
  ['README.md', 'README.en.md'],
  ['CONTRIBUTING.md', 'CONTRIBUTING.en.md'],
  ['SECURITY.md', 'SECURITY.en.md'],
  ['CHANGELOG.md', 'CHANGELOG.en.md'],
  ['NOTICE', 'NOTICE.en.md'],
  ['THIRD_PARTY_LICENSES.md', 'THIRD_PARTY_LICENSES.en.md']
]

function read(root, rel) {
  const p = path.join(root, rel)
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf-8').replace(/\r\n/g, '\n') : null
}

const levels = (text) => headings(text).map((h) => '#'.repeat(h.level))

export function checkOutlines(root) {
  const errors = []
  for (const [ko, en] of PAIRS) {
    const a = read(root, ko)
    const b = read(root, en)
    if (a === null || b === null) continue // missing files are reported by D1
    if (ko === 'NOTICE') {
      const na = numberedSections(a)
      const nb = numberedSections(b, { markdown: true })
      if (na.length !== nb.length) errors.push(`${ko}: 번호 절 수가 ${en}과 다릅니다(${na.length} ↔ ${nb.length})`)
      continue
    }
    const la = levels(a)
    const lb = levels(b)
    if (la.join(',') !== lb.join(',')) {
      const i = la.findIndex((l, k) => l !== lb[k])
      const at = i < 0 ? Math.min(la.length, lb.length) : i
      const hk = headings(a)[at]?.text ?? '(끝)'
      const he = headings(b)[at]?.text ?? '(끝)'
      errors.push(`${ko}: 절 구성이 ${en}과 다릅니다(${la.length} ↔ ${lb.length}개, ${at + 1}번째: "${hk}" ↔ "${he}")`)
    }
  }
  return errors
}
