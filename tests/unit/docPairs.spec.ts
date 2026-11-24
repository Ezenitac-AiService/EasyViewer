// SPDX-License-Identifier: GPL-3.0-only
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { DOC_PAIRS, checkDocPairs } from '../../scripts/check-doc-pairs.mjs'
import { checkOutlines } from '../../scripts/docs/outline.mjs'
import { DOC_TITLES, checkTopFormat } from '../../scripts/docs/topFormat.mjs'

/** Constitution v4.2.0 principle I: Korean default public docs paired with English *.en.md. */

const ROOT_DIR = path.resolve(__dirname, '../..')
const tempDirs: string[] = []
afterEach(() => {
  while (tempDirs.length) fs.rmSync(tempDirs.pop() as string, { recursive: true, force: true })
})

function repo(files: Record<string, string>) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ev-pairs-'))
  tempDirs.push(root)
  for (const [rel, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true })
    fs.writeFileSync(path.join(root, rel), content)
  }
  return root
}

const switcher = (ko: string, en: string) => `**언어 / Language**: [한국어](${ko}) | [English](${en})\n`

function goodRepo(extra: Record<string, string> = {}) {
  const files: Record<string, string> = {}
  for (const [ko, en] of DOC_PAIRS) {
    files[ko] = `# Doc\n\n${switcher(ko, en)}\n본문\n`
    files[en] = `# Doc\n\n${switcher(ko, en)}\nBody\n`
  }
  return repo({ ...files, ...extra })
}

describe('check-doc-pairs', () => {
  it('covers the six public documents named by the constitution', () => {
    expect(DOC_PAIRS.map(([ko]) => ko)).toEqual([
      'README.md',
      'CONTRIBUTING.md',
      'SECURITY.md',
      'CHANGELOG.md',
      'NOTICE',
      'THIRD_PARTY_LICENSES.md'
    ])
    expect(DOC_PAIRS.find(([ko]) => ko === 'NOTICE')?.[1]).toBe('NOTICE.en.md')
  })

  it('passes when every pair exists and both sides link to each other near the top', () => {
    expect(checkDocPairs(goodRepo())).toEqual([])
  })

  it('fails when an English counterpart is missing', () => {
    const root = goodRepo()
    fs.rmSync(path.join(root, 'SECURITY.en.md'))
    expect(checkDocPairs(root).join('\n')).toMatch(/SECURITY\.en\.md/)
  })

  it('fails when a side lacks the language switcher or links the wrong file', () => {
    const noLink = goodRepo({ 'README.en.md': '# Doc\n\nBody\n' })
    expect(checkDocPairs(noLink).join('\n')).toMatch(/README\.en\.md/)
    const wrong = goodRepo({ 'CHANGELOG.md': `# Doc\n\n${switcher('CHANGELOG.md', 'README.en.md')}\n` })
    expect(checkDocPairs(wrong).join('\n')).toMatch(/CHANGELOG\.md/)
  })

  it('fails when the switcher is buried below the top of the document', () => {
    const buried = goodRepo({ 'NOTICE.en.md': `${'line\n'.repeat(30)}${switcher('NOTICE', 'NOTICE.en.md')}` })
    expect(checkDocPairs(buried).join('\n')).toMatch(/NOTICE\.en\.md/)
  })

  it('passes the real repository', () => {
    expect(checkDocPairs(ROOT_DIR)).toEqual([])
  })
})

describe('issue templates are bilingual and confirm the fork (constitution v4.2.0)', () => {
  const read = (rel: string) => fs.readFileSync(path.join(ROOT_DIR, rel), 'utf-8').replace(/\r\n/g, '\n')

  it('labels the bug template in Korean and English and asks to confirm the issue is in Pagelight', () => {
    const bug = read('.github/ISSUE_TEMPLATE/bug_report.yml')
    expect(bug).toMatch(/^name:\s*.+\/.+$/m)
    expect(bug).toMatch(/id:\s*fork-confirmation/)
    expect(bug).toMatch(/required:\s*true/)
    expect(bug).toContain('Pagelight')
  })
})

describe('pair outline (spec 005 D4)', () => {
  it('passes when ## and ### levels match in order, ignoring # lines inside code fences', () => {
    const root = goodRepo({
      'CONTRIBUTING.md': `# Doc\n\n${switcher('CONTRIBUTING.md', 'CONTRIBUTING.en.md')}\n## 가\n\`\`\`bash\n# 주석\n\`\`\`\n### 나\n`,
      'CONTRIBUTING.en.md': `# Doc\n\n${switcher('CONTRIBUTING.md', 'CONTRIBUTING.en.md')}\n## A\n### B\n`
    })
    expect(checkOutlines(root)).toEqual([])
  })

  it('fails when the levels differ in count or order', () => {
    const root = goodRepo({
      'SECURITY.md': `# Doc\n\n${switcher('SECURITY.md', 'SECURITY.en.md')}\n## 가\n### 나\n`,
      'SECURITY.en.md': `# Doc\n\n${switcher('SECURITY.md', 'SECURITY.en.md')}\n### B\n## A\n`
    })
    expect(checkOutlines(root).some((e: string) => e.startsWith('SECURITY.md'))).toBe(true)
  })

  it('compares NOTICE numbered sections with NOTICE.en.md ## N. sections', () => {
    const ok = goodRepo({
      NOTICE: `제목\n\n${switcher('NOTICE', 'NOTICE.en.md')}\n----\n1. 가\n----\n2. 나\n`,
      'NOTICE.en.md': `# Doc\n\n${switcher('NOTICE', 'NOTICE.en.md')}\n## 1. A\n## 2. B\n`
    })
    expect(checkOutlines(ok)).toEqual([])
    const bad = goodRepo({
      NOTICE: `제목\n\n${switcher('NOTICE', 'NOTICE.en.md')}\n1. 가\n`,
      'NOTICE.en.md': `# Doc\n\n${switcher('NOTICE', 'NOTICE.en.md')}\n## 1. A\n## 2. B\n`
    })
    expect(checkOutlines(bad).some((e: string) => e.startsWith('NOTICE'))).toBe(true)
  })

  it('passes on this repository', () => {
    expect(checkOutlines(ROOT_DIR)).toEqual([])
  })
})

describe('top format and titles (spec 005 D2·D3)', () => {
  const top = (file: string, ko: string, en: string, rest = '이 문서는 목적을 말합니다.\n') => {
    const title = DOC_TITLES[file]
    const head = file === 'NOTICE' ? title : `# ${title}`
    return `${head}\n\n${switcher(ko, en)}\n${rest}`
  }
  function topRepo(over: Record<string, string> = {}) {
    const files: Record<string, string> = {}
    for (const [ko, en] of DOC_PAIRS) {
      files[ko] = top(ko, ko, en)
      const note = en === 'NOTICE.en.md' || en === 'THIRD_PARTY_LICENSES.en.md' ? `> This is a reference translation of [${ko}](${ko}).\n` : ''
      files[en] = top(en, ko, en, `This document states its purpose.\n\n${note}`)
    }
    files['README.md'] = `# Pagelight\n\n${switcher('README.md', 'README.en.md')}\n[![b](x)](y)\n\n소개\n`
    files['README.en.md'] = `# Pagelight\n\n${switcher('README.md', 'README.en.md')}\n[![b](x)](y)\n\nIntro\n`
    return repo({ ...files, ...over })
  }

  it('names the agreed titles without bracketed duplicates', () => {
    expect(DOC_TITLES).toMatchObject({
      'README.md': 'Pagelight',
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
    })
    for (const t of Object.values(DOC_TITLES)) expect(t).not.toMatch(/[()]/)
  })

  it('passes title → switcher → purpose, with the README exempt from the purpose rule', () => {
    expect(checkTopFormat(topRepo())).toEqual([])
  })

  it('fails on a different title', () => {
    const root = topRepo({ 'CHANGELOG.md': `# 변경 이력 (CHANGELOG)\n\n${switcher('CHANGELOG.md', 'CHANGELOG.en.md')}\n목적\n` })
    expect(checkTopFormat(root).some((e: string) => e.startsWith('CHANGELOG.md') && e.includes('제목'))).toBe(true)
  })

  it('fails when the switcher does not follow the title or no purpose paragraph follows the switcher', () => {
    const late = topRepo({ 'SECURITY.md': `# 보안 정책\n\n목적\n\n${switcher('SECURITY.md', 'SECURITY.en.md')}` })
    expect(checkTopFormat(late).some((e: string) => e.startsWith('SECURITY.md') && e.includes('언어 전환'))).toBe(true)
    const noPurpose = topRepo({ 'SECURITY.en.md': `# Security policy\n\n${switcher('SECURITY.md', 'SECURITY.en.md')}\n## Supported versions\n` })
    expect(checkTopFormat(noPurpose).some((e: string) => e.startsWith('SECURITY.en.md') && e.includes('목적'))).toBe(true)
  })

  it('requires the reference-translation note right after the purpose in NOTICE.en.md and THIRD_PARTY_LICENSES.en.md', () => {
    const root = topRepo({ 'NOTICE.en.md': top('NOTICE.en.md', 'NOTICE', 'NOTICE.en.md', 'This document states its purpose.\n') })
    expect(checkTopFormat(root).some((e: string) => e.startsWith('NOTICE.en.md') && e.includes('참고 번역'))).toBe(true)
  })

  it('accepts the plain-text NOTICE title line', () => {
    expect(checkTopFormat(topRepo()).filter((e: string) => e.startsWith('NOTICE:'))).toEqual([])
  })

  it('passes on this repository', () => {
    expect(checkTopFormat(ROOT_DIR)).toEqual([])
  })
})

