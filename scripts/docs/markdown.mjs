// SPDX-License-Identifier: GPL-3.0-only
/**
 * Markdown reading helpers for the public-document checks (spec 005 research R5).
 * They work on raw text and skip fenced code blocks, where `#` lines are shell comments.
 */

const FENCE = /^\s*(```|~~~)/

/** Calls `visit(line, index)` for every line outside fenced code blocks. */
function eachOutsideFences(text, visit) {
  let fence = null
  text.split('\n').forEach((line, i) => {
    const m = FENCE.exec(line)
    if (m) {
      if (fence === null) fence = m[1]
      else if (m[1] === fence) fence = null
      return
    }
    if (fence === null) visit(line, i)
  })
}

/** `##` and `###` headings in order: `{ level, text, line }` (line is 1-based). */
export function headings(text) {
  const out = []
  eachOutsideFences(text, (line, i) => {
    const m = /^(#{2,3}) +(.+?)\s*#*\s*$/.exec(line)
    if (m) out.push({ level: m[1].length, text: m[2], line: i + 1 })
  })
  return out
}

/** Plain text GitHub renders for a heading: links keep their label, code and emphasis marks go. */
function renderedText(heading) {
  return heading
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/`/g, '')
    .replace(/(\*\*|__)/g, '')
}

/**
 * GitHub heading anchor (GitHub Docs, "Section links"): lower-case, drop punctuation and symbols,
 * spaces become hyphens. Pass a shared `seen` map to number repeated anchors (-1, -2, ...).
 */
export function githubAnchor(heading, seen) {
  const base = renderedText(heading)
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, '')
    .replace(/ /g, '-')
  if (!seen) return base
  const count = seen.get(base) ?? 0
  seen.set(base, count + 1)
  return count === 0 ? base : `${base}-${count}`
}

/** Every anchor a document offers, including GitHub's numbering of repeated headings. */
export function anchorsOf(text) {
  const seen = new Map()
  const out = new Set()
  eachOutsideFences(text, (line) => {
    const m = /^#{1,6} +(.+?)\s*#*\s*$/.exec(line)
    if (m) out.add(githubAnchor(m[1], seen))
  })
  return out
}

/** Lines before the first `##` heading outside code fences (the README header area). */
export function headerArea(text) {
  const lines = text.split('\n')
  let end = lines.length
  let found = false
  eachOutsideFences(text, (line, i) => {
    if (!found && /^## /.test(line)) {
      end = i
      found = true
    }
  })
  return lines.slice(0, end)
}

/**
 * Numbered top-level sections. Plain-text NOTICE uses `N. Title` lines; NOTICE.en.md uses
 * `## N. Title` (pass `{ markdown: true }`).
 */
export function numberedSections(text, { markdown = false } = {}) {
  const re = markdown ? /^## +(\d+\. .+?)\s*$/ : /^(\d+\. .+?)\s*$/
  const out = []
  eachOutsideFences(text, (line) => {
    const m = re.exec(line)
    if (m) out.push(m[1])
  })
  return out
}

export { eachOutsideFences }
