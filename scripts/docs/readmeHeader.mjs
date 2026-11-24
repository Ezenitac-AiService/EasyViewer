// SPDX-License-Identifier: GPL-3.0-only
import fs from 'node:fs'
import path from 'node:path'
import { supportScopeBannerEn } from '../../src/config/supportScope.ts'
import { anchorsOf, headerArea } from './markdown.mjs'

/**
 * README header rule D7 (spec 005 contracts/readme-structure.md §1, contracts/doc-checks.md).
 * Order: title → language switcher → six badges → English banner → intro → [!IMPORTANT] → [!NOTE].
 * The support-scope block and the license line live in the body, not in the header.
 */

export const README_FILES = [
  { file: 'README.md', platformAnchor: '#지원-플랫폼과-릴리스' },
  { file: 'README.en.md', platformAnchor: '#supported-platforms-and-releases' }
]
export const HEADER_ORDER = ['title', 'switcher', 'badges', 'banner', 'intro', 'important', 'note']
export const BADGE_ORDER = ['ci', 'release-build', 'release', 'license', 'platform', 'forked-from']

const BADGE_KINDS = [
  ['ci', /actions\/workflows\/ci\.yml\/badge\.svg/],
  ['release-build', /actions\/workflows\/release\.yml\/badge\.svg/],
  ['release', /img\.shields\.io\/github\/v\/release\//],
  ['license', /img\.shields\.io\/badge\/license-/],
  ['platform', /img\.shields\.io\/badge\/platform-/],
  ['forked-from', /img\.shields\.io\/badge\/forked%20from-/]
]
/** `[![alt](image)](target)`; URLs have no spaces but may contain parentheses, e.g. `(focus)`. */
const BADGE_LINE = /^\[!\[[^\]]*\]\((\S+?)\)\]\((\S+)\)\s*$/

function badgeKind(imageUrl) {
  return BADGE_KINDS.find(([, re]) => re.test(imageUrl))?.[0] ?? 'unknown'
}

/** Static-badge message text (Shields.io path rules: `--` is a dash, `__` an underscore). */
function platformLabel(imageUrl) {
  const m = /badge\/platform-(.+)-[a-z]+(\.svg)?(\?.*)?$/.exec(imageUrl)
  if (!m) return ''
  return decodeURIComponent(m[1].replace(/--/g, '\u0000').replace(/__/g, '\u0001'))
    .replace(/\u0000/g, '-')
    .replace(/\u0001/g, '_')
}

/** Classifies header lines into element kinds, collapsing consecutive lines of one kind. */
function classify(lines, banner) {
  const kinds = []
  const badges = []
  let block = null
  for (const raw of lines) {
    const line = raw.trim()
    if (!line || /^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
      // Blank lines and thematic breaks (---) separate elements but are not elements.
      block = null
      continue
    }
    let kind
    if (/^# /.test(line)) kind = 'title'
    else if (line.includes('언어 / Language')) kind = 'switcher'
    else if (BADGE_LINE.test(line)) {
      kind = 'badges'
      const [, image, target] = BADGE_LINE.exec(line)
      badges.push({ kind: badgeKind(image), image, target })
    } else if (/^>\s*\[!IMPORTANT\]/.test(line)) kind = block = 'important'
    else if (/^>\s*\[!NOTE\]/.test(line)) kind = block = 'note'
    else if (line.startsWith('>') && block) kind = block
    else if (line.replace(/^>\s?/, '') === banner) kind = 'banner'
    else kind = 'intro'
    if (kinds[kinds.length - 1] !== kind) kinds.push(kind)
  }
  return { kinds, badges }
}

function checkOne(root, { file, platformAnchor }, banner) {
  const p = path.join(root, file)
  if (!fs.existsSync(p)) return { errors: [`${file}: 파일이 없습니다`], kinds: [] }
  const text = fs.readFileSync(p, 'utf-8').replace(/\r\n/g, '\n')
  const header = headerArea(text)
  const errors = []
  const joined = header.join('\n')
  if (/support-scope(-en)?:start/.test(joined)) errors.push(`${file}: 헤더에 지원 범위 원문 블록이 있습니다(지원 플랫폼 절로 옮겨야 함)`)
  if (/\*\*(라이선스|License)\*\*\s*:/.test(joined)) errors.push(`${file}: 헤더에 라이선스 한 줄 안내가 있습니다(라이선스 절로 옮겨야 함)`)
  const { kinds, badges } = classify(header, banner)
  if (kinds.join(',') !== HEADER_ORDER.join(',')) {
    errors.push(`${file}: 헤더 요소 순서가 ${HEADER_ORDER.join(' → ')}와 다릅니다(${kinds.join(' → ') || '없음'})`)
  }
  const order = badges.map((b) => b.kind)
  if (order.join(',') !== BADGE_ORDER.join(',')) {
    errors.push(`${file}: 배지는 ${BADGE_ORDER.join('·')} 6개가 이 순서여야 합니다(${order.join('·') || '없음'})`)
  }
  const platform = badges.find((b) => b.kind === 'platform')
  if (platform) {
    const label = platformLabel(platform.image)
    if (/windows/i.test(label)) errors.push(`${file}: 플랫폼 배지에 Windows가 있습니다`)
    for (const tier of ['focus', 'source build', 'test build']) {
      if (!label.toLowerCase().includes(tier)) errors.push(`${file}: 플랫폼 배지에 지원 등급 "${tier}" 표시가 없습니다`)
    }
    if (platform.target !== platformAnchor) {
      errors.push(`${file}: 플랫폼 배지 앵커가 ${platformAnchor}가 아닙니다(${platform.target})`)
    } else if (!anchorsOf(text).has(platformAnchor.slice(1))) {
      errors.push(`${file}: 플랫폼 배지 앵커 ${platformAnchor}에 해당하는 절이 없습니다`)
    }
  }
  return { errors, kinds }
}

export function checkReadmeHeader(root) {
  const banner = supportScopeBannerEn()
  const results = README_FILES.map((f) => checkOne(root, f, banner))
  const errors = results.flatMap((r) => r.errors)
  const [ko, en] = results.map((r) => r.kinds.join(','))
  if (ko && en && ko !== en) errors.push(`README.md·README.en.md: 두 언어의 헤더 요소 순서가 다릅니다`)
  return errors
}
