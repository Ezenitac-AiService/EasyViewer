// SPDX-License-Identifier: GPL-3.0-only
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { checkLinks } from '../../scripts/docs/links.mjs'

/** Spec 005 contracts/doc-checks.md D5: in-repo links and anchors of the public documents. */

const ROOT_DIR = path.resolve(__dirname, '../..')
const tempDirs: string[] = []
afterEach(() => {
  while (tempDirs.length) fs.rmSync(tempDirs.pop() as string, { recursive: true, force: true })
})

function repo(files: Record<string, string>) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ev-links-'))
  tempDirs.push(root)
  for (const [rel, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true })
    fs.writeFileSync(path.join(root, rel), content)
  }
  return root
}

describe('check links (D5)', () => {
  it('passes existing files, existing anchors and external URLs', () => {
    const root = repo({
      'README.md': '# T\n\n[a](./CONTRIBUTING.md#검증-명령) [b](#설치) [c](https://example.com/x#y) [d](LICENSE) [e](docs/)\n\n## 설치\n',
      'CONTRIBUTING.md': '# C\n\n## 검증 명령\n',
      LICENSE: 'GPL',
      'docs/a.md': 'x'
    })
    expect(checkLinks(root, ['README.md'])).toEqual([])
  })

  it('fails on a missing file', () => {
    const root = repo({ 'README.md': '# T\n[a](./NOPE.md)\n' })
    expect(checkLinks(root, ['README.md']).join('\n')).toMatch(/README\.md.*NOPE\.md/)
  })

  it('fails on a missing anchor in the same or another document', () => {
    const root = repo({ 'README.md': '# T\n[a](#없음) [b](./C.md#gone)\n## 있음\n', 'C.md': '# C\n## here\n' })
    const errors = checkLinks(root, ['README.md'])
    expect(errors.some((e: string) => e.includes('#없음'))).toBe(true)
    expect(errors.some((e: string) => e.includes('#gone'))).toBe(true)
  })

  it('ignores links inside code fences and inline code', () => {
    const root = repo({ 'README.md': '# T\n```md\n[a](./NOPE.md)\n```\n`[b](#nope)`\n' })
    expect(checkLinks(root, ['README.md'])).toEqual([])
  })

  it('checks badge targets but not badge images', () => {
    const root = repo({ 'README.md': '# T\n[![x](https://img.shields.io/a)](#지원)\n## 지원\n' })
    expect(checkLinks(root, ['README.md'])).toEqual([])
  })

  it('passes on this repository', () => {
    expect(checkLinks(ROOT_DIR)).toEqual([])
  })
})
