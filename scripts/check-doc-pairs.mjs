// SPDX-License-Identifier: GPL-3.0-only
// Constitution v4.2.0 principle I: every public root document has a Korean default and a synchronized
// English counterpart, and both link to each other in a language switcher near the top.
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

/** [Korean default, English counterpart] */
export const DOC_PAIRS = [
  ['README.md', 'README.en.md'],
  ['CONTRIBUTING.md', 'CONTRIBUTING.en.md'],
  ['SECURITY.md', 'SECURITY.en.md'],
  ['CHANGELOG.md', 'CHANGELOG.en.md'],
  ['NOTICE', 'NOTICE.en.md'],
  ['THIRD_PARTY_LICENSES.md', 'THIRD_PARTY_LICENSES.en.md']
]

/** The switcher must sit in the first lines so readers see it before the content. */
const TOP_LINES = 15

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function read(root, rel) {
  const abs = path.join(root, rel)
  return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf-8').replace(/\r\n/g, '\n') : null
}

function hasSwitcher(text, ko, en) {
  const head = text.split('\n').slice(0, TOP_LINES).join('\n')
  const line = head.split('\n').find((l) => l.includes('언어 / Language'))
  if (!line) return false
  const koLink = new RegExp(`\\[한국어\\]\\((\\./)?${escape(ko)}\\)`)
  const enLink = new RegExp(`\\[English\\]\\((\\./)?${escape(en)}\\)`)
  return koLink.test(line) && enLink.test(line)
}

export function checkDocPairs(root) {
  const errors = []
  for (const [ko, en] of DOC_PAIRS) {
    for (const rel of [ko, en]) {
      const text = read(root, rel)
      if (text === null) {
        errors.push(`${rel}: 파일이 없습니다(${ko} ↔ ${en})`)
        continue
      }
      if (!hasSwitcher(text, ko, en)) {
        errors.push(`${rel}: 맨 위 ${TOP_LINES}줄 안에 "언어 / Language" 전환 링크([한국어](${ko}) | [English](${en}))가 없습니다`)
      }
    }
  }
  return errors
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const errors = checkDocPairs(process.cwd())
  for (const e of errors) console.error(`[check:doc-pairs] ${e}`)
  if (errors.length) process.exit(1)
  console.log('[check:doc-pairs] 공개 문서 국문·영문 쌍 확인')
}
