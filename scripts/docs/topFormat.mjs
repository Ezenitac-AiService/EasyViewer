// SPDX-License-Identifier: GPL-3.0-only
import fs from 'node:fs'
import path from 'node:path'

/**
 * Top-of-document rules D2·D3 (spec 005 research R7, contracts/doc-checks.md):
 * title → language switcher → one purpose paragraph. The README header is checked by D7 instead,
 * and the English reference translations put their translation note right after the purpose.
 */

export const DOC_TITLES = {
  'README.md': 'Pagelight',
  'README.en.md': 'Pagelight',
  'CONTRIBUTING.md': '기여 가이드',
  'CONTRIBUTING.en.md': 'Contributing guide',
  'SECURITY.md': '보안 정책',
  'SECURITY.en.md': 'Security policy',
  'CHANGELOG.md': '변경 이력',
  'CHANGELOG.en.md': 'Changelog',
  NOTICE: 'Pagelight 저작권 및 변경 고지',
  'NOTICE.en.md': 'Pagelight copyright and modification notice',
  'THIRD_PARTY_LICENSES.md': '서드파티 라이선스 고지',
  'THIRD_PARTY_LICENSES.en.md': 'Third-party licenses'
}
const README = new Set(['README.md', 'README.en.md'])
const REFERENCE_TRANSLATIONS = new Set(['NOTICE.en.md', 'THIRD_PARTY_LICENSES.en.md'])
const NOT_PURPOSE = /^(#|\||>|-{3,}|`{3}|~{3}|<!--|\[!\[)/

/** Paragraphs as arrays of trimmed lines, split on blank lines. */
function paragraphs(text) {
  return text
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((p) => p.split('\n').map((l) => l.trim()).filter(Boolean))
    .filter((p) => p.length)
}

export function checkTopFormat(root) {
  const errors = []
  for (const [file, title] of Object.entries(DOC_TITLES)) {
    const p = path.join(root, file)
    if (!fs.existsSync(p)) continue // reported by D1
    const [first, second, third, fourth] = paragraphs(fs.readFileSync(p, 'utf-8'))
    const expected = file === 'NOTICE' ? title : `# ${title}`
    if (first?.[0] !== expected) errors.push(`${file}: 제목이 "${expected}"가 아닙니다(${first?.[0] ?? '없음'})`)
    if (!second?.[0]?.includes('언어 / Language')) {
      errors.push(`${file}: 제목 바로 다음에 언어 전환 줄이 없습니다`)
      continue
    }
    if (README.has(file)) continue // the header order after the switcher is rule D7
    if (!third || NOT_PURPOSE.test(third[0])) {
      errors.push(`${file}: 언어 전환 다음에 문서 목적 문단이 없습니다`)
      continue
    }
    if (REFERENCE_TRANSLATIONS.has(file) && !(fourth?.[0]?.startsWith('>') && /reference translation/i.test(fourth.join(' ')))) {
      errors.push(`${file}: 목적 문단 바로 다음에 참고 번역 표시(> This is a reference translation …)가 없습니다`)
    }
  }
  return errors
}
