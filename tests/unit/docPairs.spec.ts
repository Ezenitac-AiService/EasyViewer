// SPDX-License-Identifier: GPL-3.0-only
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { DOC_PAIRS, checkDocPairs } from '../../scripts/check-doc-pairs.mjs'

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
