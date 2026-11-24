// SPDX-License-Identifier: GPL-3.0-only
import fs from 'node:fs'
import path from 'node:path'
import { eachOutsideFences } from './markdown.mjs'
import { PUBLIC_DOCS } from './links.mjs'

/**
 * Terminology rule D6 (spec 005 research R4): the original author's side is "원저작자",
 * "원저작자 저장소", "원저작자 앱" (original author, original repository, original app).
 * "업스트림"/"upstream" is allowed only in Git-work context (merge, sync, cherry-pick, remote ...).
 * Exempt: code, HTML comments (machine markers), plain quotations, and changelog sections older than
 * the newest one.
 * "원본" alone stays allowed because it also means the user's original files.
 */

const BANNED = [
  { re: /원작자?/, label: '원작·원작자 → 원저작자·원저작자 앱' },
  { re: /원본 (앱|저장소)/, label: '원본 앱·원본 저장소 → 원저작자 앱·원저작자 저장소' },
  { re: /\bupstream app\b/i, label: 'upstream app → original app' }
]
const UPSTREAM = /업스트림|\bupstream\b/i
const GIT_WORK = /병합|동기화|체리픽|원격|upstream-base|merg|sync|cherry-pick|remote|fetch/i

/** For a changelog, keep only the text up to the end of the first `##` release section. */
function newestSection(text) {
  const lines = text.split('\n')
  const starts = lines.flatMap((l, i) => (/^## /.test(l) ? [i] : []))
  if (starts.length < 2) return text
  return lines.slice(0, starts[1]).join('\n')
}

export function checkTermsInText(file, text) {
  const errors = []
  const body = /^CHANGELOG/.test(file) ? newestSection(text) : text
  let quote = null // null outside a blockquote, otherwise whether this quote is exempt
  eachOutsideFences(body, (raw, i) => {
    const isQuote = /^\s*>/.test(raw)
    if (!isQuote) quote = null
    else if (quote === null) quote = !/^\s*>\s*\[!/.test(raw)
    if (isQuote && quote) return
    const line = raw
      .replace(/<!--.*?-->/g, '')
      .replace(/`[^`]*`/g, '')
      .replace(/\]\([^)]*\)/g, ']')
    for (const { re, label } of BANNED) {
      if (re.test(line)) errors.push(`${file}:${i + 1}: 용어 "${line.match(re)[0]}" (${label})`)
    }
    if (UPSTREAM.test(line) && !GIT_WORK.test(line)) {
      errors.push(`${file}:${i + 1}: "업스트림/upstream"은 병합·동기화 같은 Git 작업 맥락에서만 씁니다`)
    }
  })
  return errors
}

export function checkTerms(root, files = PUBLIC_DOCS) {
  return files.flatMap((file) => {
    const p = path.join(root, file)
    return fs.existsSync(p) ? checkTermsInText(file, fs.readFileSync(p, 'utf-8')) : []
  })
}
