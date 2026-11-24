// SPDX-License-Identifier: GPL-3.0-only
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { renderSupportScopeEn, renderSupportScopeKo, supportScopeBannerEn } from '@/config/supportScope'
import {
  checkBlocks,
  checkForbiddenWording,
  checkIssueTemplates,
  checkSupportScope,
  checkWindowsMigrationDoc,
  extractBlock
} from '../../scripts/check-support-scope.mjs'

const CANON = renderSupportScopeKo()
const CANON_EN = renderSupportScopeEn()
const BANNER = supportScopeBannerEn()
const block = (body: string) => `<!-- support-scope:start -->\n${body}\n<!-- support-scope:end -->`
const blockEn = (body: string) => `<!-- support-scope-en:start -->\n${body}\n<!-- support-scope-en:end -->`

const tempDirs: string[] = []
afterEach(() => {
  while (tempDirs.length) fs.rmSync(tempDirs.pop() as string, { recursive: true, force: true })
})

function repo(files: Record<string, string>) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ev-scope-'))
  tempDirs.push(root)
  for (const [rel, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true })
    fs.writeFileSync(path.join(root, rel), content)
  }
  return root
}

const ISSUE_BUG = `name: 버그 신고\nbody:\n  - type: dropdown\n    id: platform\n    attributes:\n      label: 플랫폼\n      options:\n        - macOS\n        - iOS\n`
const ISSUE_TEST_BUG = `name: 테스트 빌드 버그 신고 / Test build bug report\nlabels: ["bug", "test-build"]\nbody:\n  - type: markdown\n    attributes:\n      value: 테스트용 빌드라 품질·대응 일정을 보장하지 않습니다 / Test builds come with no guarantee of quality or response time\n  - type: dropdown\n    id: platform\n    attributes:\n      label: 플랫폼\n      options:\n        - Linux\n        - Android\n`
const ISSUE_CONFIG = `blank_issues_enabled: false\ncontact_links:\n  - name: Windows 사용자\n    url: https://github.com/edith2580/EasyViewer\n    about: 원저작자 앱 안내\n`
const WIN_DOC = `# Windows 전환 안내\n${block('보존된 옛 지원 범위 문장')}\n손실 항목: 읽기 진행률, 책갈피, 표시 설정, WebDAV 자격증명\n`

function goodRepo(extra: Record<string, string> = {}) {
  return repo({
    'README.md': `# EasyViewer\n\n> ${BANNER}\n>\n> ${block(CANON).split('\n').join('\n> ')}\n`,
    NOTICE: block(CANON),
    'CHANGELOG.md': block(CANON),
    'CONTRIBUTING.md': block(CANON),
    'README.en.md': `# Pagelight\n\n> ${BANNER}\n\n${blockEn(CANON_EN)}\n`,
    'NOTICE.en.md': blockEn(CANON_EN),
    'CHANGELOG.en.md': blockEn(CANON_EN),
    'CONTRIBUTING.en.md': blockEn(CANON_EN),
    'docs/windows-eol-notice.md': `# 지원 종료\n${block('보존된 옛 지원 범위 문장')}\n`,
    '.github/ISSUE_TEMPLATE/bug_report.yml': ISSUE_BUG,
    '.github/ISSUE_TEMPLATE/bug_report_test_build.yml': ISSUE_TEST_BUG,
    '.github/ISSUE_TEMPLATE/config.yml': ISSUE_CONFIG,
    'docs/windows-migration.md': WIN_DOC,
    ...extra
  })
}

describe('support-scope blocks (FR-006)', () => {
  it('extracts a block and strips Markdown blockquote markers', () => {
    expect(extractBlock(`> ${block(CANON).split('\n').join('\n> ')}`)).toBe(CANON)
  })

  it('passes when every published block matches the canonical text', () => {
    expect(checkSupportScope(goodRepo())).toEqual([])
  })

  it('fails when a block differs or is missing', () => {
    const root = goodRepo({ NOTICE: block(CANON.replace('Android', 'Android·Windows')), 'CONTRIBUTING.md': '# no block' })
    const errors = checkBlocks(root, CANON).join('\n')
    expect(errors).toMatch(/NOTICE/)
    expect(errors).toMatch(/CONTRIBUTING\.md/)
  })

  it('fails when the README banner line is missing', () => {
    const root = goodRepo({ 'README.md': `# EasyViewer\n\n${block(CANON)}\n` })
    expect(checkSupportScope(root).join('\n')).toMatch(/배너/)
  })
})

describe('forbidden wording (FR-007)', () => {
  it.each(['역할 분담', '역할을 나눠', '경쟁하지 않습니다', '원저작자 앱은 Windows 전용', '레거시 앱', '구버전 앱'])(
    'rejects "%s" in public documents',
    (phrase) => {
      const root = goodRepo({ 'docs/guide.md': `# 안내\n${phrase}\n` })
      expect(checkForbiddenWording(root, {}).join('\n')).toMatch(/docs\/guide\.md/)
    }
  )

  it('allows an exception recorded with the upstream author consent', () => {
    const root = goodRepo({ 'docs/guide.md': '역할 분담\n' })
    expect(checkForbiddenWording(root, { 'docs/guide.md': ['역할 분담'] })).toEqual([])
  })

  it('blocks vulnerability talk about the upstream app before the private notification is recorded', () => {
    const root = goodRepo({ 'docs/compare.md': '원저작자 앱에는 아직 취약점이 남아 있습니다.\n' })
    expect(checkForbiddenWording(root, {}).join('\n')).toMatch(/보안 조율/)
    const notified = goodRepo({
      'docs/compare.md': '원저작자 앱에는 아직 취약점이 남아 있습니다.\n',
      'specs/003-independent-fork-separation/verification/security-coordination.md': '통지 날짜: 2026-11-20\n'
    })
    expect(checkForbiddenWording(notified, {})).toEqual([])
  })
})

describe('issue templates (US2-4)', () => {
  it('requires exactly the supported platforms in the bug template', () => {
    expect(checkIssueTemplates(goodRepo())).toEqual([])
    const root = goodRepo({ '.github/ISSUE_TEMPLATE/bug_report.yml': ISSUE_BUG.replace('- iOS', '- iOS\n        - Windows') })
    expect(checkIssueTemplates(root).join('\n')).toMatch(/플랫폼 선택지/)
  })

  it('requires a link to the upstream repository for Windows users', () => {
    const root = goodRepo({ '.github/ISSUE_TEMPLATE/config.yml': 'blank_issues_enabled: false\n' })
    expect(checkIssueTemplates(root).join('\n')).toMatch(/원저작자/)
  })
})

describe('Windows migration document (FR-010)', () => {
  it('requires all lost items and forbids compatibility claims', () => {
    expect(checkWindowsMigrationDoc(goodRepo())).toEqual([])
    const missing = goodRepo({ 'docs/windows-migration.md': '손실 항목: 읽기 진행률\n' })
    expect(checkWindowsMigrationDoc(missing).join('\n')).toMatch(/책갈피/)
    const claim = goodRepo({ 'docs/windows-migration.md': `${WIN_DOC}\n원저작자 앱과 호환됩니다.\n` })
    expect(checkWindowsMigrationDoc(claim).join('\n')).toMatch(/호환/)
  })
})

describe('English support-scope blocks (spec 004 contracts §4)', () => {
  it('requires the English block in every English public document', () => {
    const root = goodRepo({ 'NOTICE.en.md': '# no block', 'CHANGELOG.en.md': blockEn(CANON_EN.replace('macOS', 'Windows')) })
    const errors = checkBlocks(root, CANON, CANON_EN)
    expect(errors.some((e) => e.startsWith('NOTICE.en.md') && e.includes('support-scope-en'))).toBe(true)
    expect(errors.some((e) => e.startsWith('CHANGELOG.en.md'))).toBe(true)
  })

  it('does not accept a Korean block in place of the English one', () => {
    const root = goodRepo({ 'README.en.md': `# Pagelight\n${block(CANON)}\n` })
    expect(checkBlocks(root, CANON, CANON_EN).some((e) => e.startsWith('README.en.md'))).toBe(true)
  })

  it('skips the two preserved Windows records', () => {
    expect(checkBlocks(goodRepo(), CANON, CANON_EN)).toEqual([])
    const other = goodRepo({ 'docs/guide.md': block('옛 문장') })
    expect(checkBlocks(other, CANON, CANON_EN).some((e) => e.startsWith('docs/guide.md'))).toBe(true)
  })
})

describe('split bug templates (spec 004 contracts §5)', () => {
  it('passes with the core and test-build forms', () => {
    expect(checkIssueTemplates(goodRepo())).toEqual([])
  })

  it('fails when the core form still lists a test-build platform', () => {
    const root = goodRepo({ '.github/ISSUE_TEMPLATE/bug_report.yml': ISSUE_BUG.replace('- iOS', '- iOS\n        - Linux') })
    expect(checkIssueTemplates(root).some((e) => e.includes('bug_report.yml'))).toBe(true)
  })

  it('requires the test-build form with exact platforms, label and notice', () => {
    const missing = goodRepo({ '.github/ISSUE_TEMPLATE/bug_report_test_build.yml': '' })
    expect(checkIssueTemplates(missing).some((e) => e.includes('bug_report_test_build.yml'))).toBe(true)
    const extra = goodRepo({ '.github/ISSUE_TEMPLATE/bug_report_test_build.yml': ISSUE_TEST_BUG.replace('- Android', '- Android\n        - macOS') })
    expect(checkIssueTemplates(extra).some((e) => e.includes('bug_report_test_build.yml'))).toBe(true)
    const noLabel = goodRepo({ '.github/ISSUE_TEMPLATE/bug_report_test_build.yml': ISSUE_TEST_BUG.replace(', "test-build"', '') })
    expect(checkIssueTemplates(noLabel).some((e) => e.includes('test-build'))).toBe(true)
    const noNotice = goodRepo({ '.github/ISSUE_TEMPLATE/bug_report_test_build.yml': ISSUE_TEST_BUG.replace(/value: .*\n/, 'value: 안내\n') })
    expect(checkIssueTemplates(noNotice).some((e) => e.includes('보장'))).toBe(true)
  })

  it('rejects a Windows option in any issue form', () => {
    const root = goodRepo({ '.github/ISSUE_TEMPLATE/feature_request.yml': 'body:\n  - type: dropdown\n    id: platform\n    attributes:\n      options:\n        - macOS\n        - Windows\n' })
    expect(checkIssueTemplates(root).some((e) => e.includes('feature_request.yml') && e.includes('Windows'))).toBe(true)
  })
})

describe('README banner position (spec 005 research R1)', () => {
  const head = (n: number) => ['# EasyViewer', ...Array.from({ length: n - 2 }, (_, i) => `[![b${i}](x)](y)`)].join('\n')
  it('accepts the banner up to line 15 when it comes before the first ## heading', () => {
    const root = goodRepo({ 'README.md': `${head(14)}\n> ${BANNER}\n\n## 지원 플랫폼과 릴리스\n\n${block(CANON)}\n` })
    expect(checkSupportScope(root)).toEqual([])
  })

  it('rejects the banner after line 15', () => {
    const root = goodRepo({ 'README.md': `${head(16)}\n> ${BANNER}\n\n## 지원 플랫폼과 릴리스\n\n${block(CANON)}\n` })
    expect(checkSupportScope(root).join('\n')).toMatch(/배너/)
  })

  it('rejects the banner after the first ## heading even within 15 lines', () => {
    const root = goodRepo({ 'README.md': `# EasyViewer\n\n## 지원 플랫폼과 릴리스\n\n> ${BANNER}\n\n${block(CANON)}\n` })
    expect(checkSupportScope(root).join('\n')).toMatch(/배너/)
  })
})

