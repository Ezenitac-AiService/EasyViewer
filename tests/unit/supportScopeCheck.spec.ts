// SPDX-License-Identifier: GPL-3.0-only
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { renderSupportScopeKo, supportScopeBannerEn } from '@/config/supportScope'
import {
  checkBlocks,
  checkForbiddenWording,
  checkIssueTemplates,
  checkSupportScope,
  checkWindowsMigrationDoc,
  extractBlock
} from '../../scripts/check-support-scope.mjs'

const CANON = renderSupportScopeKo()
const BANNER = supportScopeBannerEn()
const block = (body: string) => `<!-- support-scope:start -->\n${body}\n<!-- support-scope:end -->`

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

const ISSUE_BUG = `name: 버그 신고\nbody:\n  - type: dropdown\n    id: platform\n    attributes:\n      label: 플랫폼\n      options:\n        - macOS\n        - iOS\n        - Linux\n        - Android\n`
const ISSUE_CONFIG = `blank_issues_enabled: false\ncontact_links:\n  - name: Windows 사용자\n    url: https://github.com/edith2580/EasyViewer\n    about: 원저작자 앱 안내\n`
const WIN_DOC = `# Windows 전환 안내\n${block(CANON)}\n손실 항목: 읽기 진행률, 책갈피, 표시 설정, WebDAV 자격증명\n`

function goodRepo(extra: Record<string, string> = {}) {
  return repo({
    'README.md': `# EasyViewer\n\n> ${BANNER}\n>\n> ${block(CANON).split('\n').join('\n> ')}\n`,
    NOTICE: block(CANON),
    'CHANGELOG.md': block(CANON),
    'CONTRIBUTING.md': block(CANON),
    '.github/ISSUE_TEMPLATE/bug_report.yml': ISSUE_BUG,
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
    const root = goodRepo({ '.github/ISSUE_TEMPLATE/bug_report.yml': ISSUE_BUG.replace('- Android', '- Android\n        - Windows') })
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
