// SPDX-License-Identifier: GPL-3.0-only
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { renderSupportScopeEn, renderSupportScopeKo, supportScopeBannerEn } from '../src/config/supportScope.ts'

/**
 * Support-scope and public-wording gate (spec 003 FR-006, FR-007, FR-009, FR-010,
 * contracts/support-scope-wording.md; spec 004 contracts/support-scope-text.md §4–§5).
 */

const START = '<!-- support-scope:start -->'
const END = '<!-- support-scope:end -->'
const START_EN = '<!-- support-scope-en:start -->'
const END_EN = '<!-- support-scope-en:end -->'
export const REQUIRED_BLOCK_FILES = ['README.md', 'NOTICE', 'CHANGELOG.md', 'CONTRIBUTING.md']
export const REQUIRED_EN_BLOCK_FILES = ['README.en.md', 'NOTICE.en.md', 'CHANGELOG.en.md', 'CONTRIBUTING.en.md']
/** Preserved end-of-support records (spec 004 FR-009): their blocks are frozen and not compared. */
export const PRESERVED_RECORDS = ['docs/windows-migration.md', 'docs/windows-eol-notice.md']
export const CORE_ISSUE_PLATFORMS = ['macOS', 'iOS']
export const TEST_BUILD_ISSUE_PLATFORMS = ['Linux', 'Android']
const TEST_BUILD_FORM = '.github/ISSUE_TEMPLATE/bug_report_test_build.yml'
const TEST_BUILD_NOTICE = /보장하지\s*않습니다/
const SECURITY_RECORD = 'specs/003-independent-fork-separation/verification/security-coordination.md'
const WINDOWS_DOC = 'docs/windows-migration.md'
const LOST_ITEMS = ['읽기 진행률', '책갈피', '표시 설정', 'WebDAV 자격증명']

const FORBIDDEN = [
  { re: /역할\s*분담/, label: '역할 분담' },
  { re: /역할을\s*나눠/, label: '역할을 나눠' },
  { re: /경쟁하지\s*않/, label: '경쟁하지 않' },
  { re: /Windows\s*전용/, label: 'Windows 전용' },
  { re: /레거시/, label: '레거시' },
  { re: /구버전/, label: '구버전' }
]

/** Returns the support-scope block body without Markdown blockquote markers, or null. */
export function extractBlock(text, start = START, end = END) {
  const i = text.indexOf(start)
  const j = text.indexOf(end)
  if (i < 0 || j < 0 || j < i) return null
  return text
    .slice(i + start.length, j)
    .split('\n')
    .map((line) => line.replace(/^\s*>\s?/, ''))
    .join('\n')
    .trim()
}

function read(root, rel) {
  const p = path.join(root, rel)
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : null
}

function walk(root, rel, filter, out = []) {
  const abs = path.join(root, rel)
  if (!fs.existsSync(abs)) return out
  const st = fs.statSync(abs)
  if (st.isFile()) {
    if (filter(rel)) out.push(rel)
    return out
  }
  for (const name of fs.readdirSync(abs).sort()) {
    if (name === 'node_modules' || name.startsWith('.git') && name !== '.github') continue
    walk(root, path.posix.join(rel, name), filter, out)
  }
  return out
}

export function publicFiles(root) {
  const files = ['README.md', 'NOTICE', 'CHANGELOG.md', 'CONTRIBUTING.md', 'SECURITY.md'].filter((f) => read(root, f) !== null)
  files.push(...walk(root, 'docs', (f) => /\.(md|txt)$/.test(f)))
  files.push(...walk(root, '.github/ISSUE_TEMPLATE', (f) => /\.(ya?ml|md)$/.test(f)))
  files.push(...walk(root, 'src', (f) => f.endsWith('.vue') || f.startsWith('src/config/')))
  return files
}

export function checkBlocks(root, canonical, canonicalEn = renderSupportScopeEn()) {
  const errors = []
  const required = [
    ...REQUIRED_BLOCK_FILES.map((f) => [f, START, END, 'support-scope']),
    ...REQUIRED_EN_BLOCK_FILES.map((f) => [f, START_EN, END_EN, 'support-scope-en'])
  ]
  for (const [f, start, end, name] of required) {
    const text = read(root, f)
    if (text === null) errors.push(`${f}: 파일이 없습니다`)
    else if (extractBlock(text, start, end) === null) errors.push(`${f}: ${name} 블록이 없습니다`)
  }
  for (const f of walk(root, '.', (rel) => /\.(md|yml|yaml)$|^\.?\/?NOTICE$/.test(rel))) {
    const rel = f.replace(/^\.\//, '')
    if (rel.startsWith('specs/') || rel.startsWith('node_modules/') || PRESERVED_RECORDS.includes(rel)) continue
    const text = read(root, rel) ?? ''
    const body = extractBlock(text)
    if (body !== null && body !== canonical) errors.push(`${rel}: support-scope 블록이 원문(src/config/supportScope.ts)과 다릅니다`)
    const bodyEn = extractBlock(text, START_EN, END_EN)
    if (bodyEn !== null && bodyEn !== canonicalEn) {
      errors.push(`${rel}: support-scope-en 블록이 영문 원문(src/config/supportScope.ts)과 다릅니다`)
    }
  }
  return errors
}

export function checkBanner(root, banner) {
  const readme = read(root, 'README.md') ?? ''
  const head = readme.split('\n').slice(0, 12).join('\n')
  return head.includes(banner) ? [] : ['README.md: 맨 위 포크 안내 배너(영문 한 줄)가 없습니다']
}

function securityNotified(root) {
  const text = read(root, SECURITY_RECORD)
  return text !== null && /\d{4}-\d{2}-\d{2}/.test(text)
}

export function checkForbiddenWording(root, exceptions) {
  const errors = []
  const notified = securityNotified(root)
  for (const f of publicFiles(root)) {
    const text = read(root, f) ?? ''
    const allowed = exceptions[f] ?? []
    for (const { re, label } of FORBIDDEN) {
      if (re.test(text) && !allowed.includes(label)) errors.push(`${f}: 금지 표현 "${label}"`)
    }
    if (!notified) {
      for (const para of text.split(/\n\s*\n/)) {
        if (/(취약점|보안\s*결함)/.test(para) && /원저작자/.test(para) && !allowed.some((a) => para.includes(a))) {
          errors.push(`${f}: 보안 조율(FR-013) 기록 전에는 원저작자 앱의 보안 결함을 언급할 수 없습니다`)
          break
        }
      }
    }
  }
  return errors
}

function platformOptions(text) {
  const m = /id:\s*platform[\s\S]*?options:\s*\n((?:\s*-\s*.+\n?)+)/.exec(text)
  return m ? [...m[1].matchAll(/-\s*(.+)/g)].map((x) => x[1].trim()) : []
}

export function checkIssueTemplates(root) {
  const errors = []
  const forms = [
    ['.github/ISSUE_TEMPLATE/bug_report.yml', CORE_ISSUE_PLATFORMS],
    [TEST_BUILD_FORM, TEST_BUILD_ISSUE_PLATFORMS]
  ]
  for (const [f, expected] of forms) {
    const name = f.split('/').pop()
    const text = read(root, f)
    if (text === null || text.trim() === '') {
      errors.push(`${f}: 파일이 없습니다`)
      continue
    }
    const options = platformOptions(text)
    if (options.join(',') !== expected.join(',')) {
      errors.push(`${name}: 플랫폼 선택지가 ${expected.join('·')}와 다릅니다(${options.join('·') || '없음'})`)
    }
    if (f === TEST_BUILD_FORM) {
      if (!/labels:[^\n]*["']?test-build["']?/.test(text)) errors.push(`${name}: labels에 test-build가 필요합니다`)
      if (!TEST_BUILD_NOTICE.test(text)) errors.push(`${name}: 테스트용 빌드라 대응 일정을 보장하지 않는다는 안내가 없습니다`)
    }
  }
  for (const f of walk(root, '.github/ISSUE_TEMPLATE', (rel) => /\.ya?ml$/.test(rel))) {
    if (platformOptions(read(root, f) ?? '').includes('Windows')) errors.push(`${f.split('/').pop()}: Windows 선택지가 있습니다`)
  }
  const config = read(root, '.github/ISSUE_TEMPLATE/config.yml')
  if (config === null || !config.includes('https://github.com/edith2580/EasyViewer')) {
    errors.push('.github/ISSUE_TEMPLATE/config.yml: Windows 사용자를 위한 원저작자 저장소 안내 링크가 없습니다')
  }
  if (config !== null && !/blank_issues_enabled:\s*false/.test(config)) {
    errors.push('.github/ISSUE_TEMPLATE/config.yml: blank_issues_enabled: false 가 필요합니다')
  }
  return errors
}

export function checkWindowsMigrationDoc(root) {
  const text = read(root, WINDOWS_DOC)
  if (text === null) return [`${WINDOWS_DOC}: 파일이 없습니다`]
  const errors = []
  for (const item of LOST_ITEMS) if (!text.includes(item)) errors.push(`${WINDOWS_DOC}: 손실 항목 "${item}"이 없습니다`)
  if (/(호환됩니다|그대로\s*열립니다|호환\s*가능)/.test(text)) {
    errors.push(`${WINDOWS_DOC}: 원저작자 앱과 호환된다고 단정하는 문구가 있습니다`)
  }
  return errors
}

export function checkSupportScope(root, options = {}) {
  const canonical = renderSupportScopeKo(options)
  const exceptionsPath = path.join(root, 'scripts/wording-exceptions.json')
  const exceptions = fs.existsSync(exceptionsPath) ? JSON.parse(fs.readFileSync(exceptionsPath, 'utf-8')) : {}
  return [
    ...checkBlocks(root, canonical),
    ...checkBanner(root, supportScopeBannerEn(options)),
    ...checkForbiddenWording(root, exceptions),
    ...checkIssueTemplates(root),
    ...checkWindowsMigrationDoc(root)
  ]
}

function main() {
  const errors = checkSupportScope(process.cwd())
  for (const e of errors) console.error(`[check:support-scope] ${e}`)
  if (errors.length > 0) process.exit(1)
  console.log('[check:support-scope] 지원 범위 원문·공개 문구 검사 통과')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
