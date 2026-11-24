// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from 'vitest'
import { githubAnchor, headerArea, headings, numberedSections } from '../../scripts/docs/markdown.mjs'

/** Spec 005 research R5: Markdown reading helpers shared by the public-doc checks. */

describe('headings', () => {
  it('lists ## and ### headings in order and ignores lines inside code fences', () => {
    const text = ['# Title', '', '## A', '```bash', '# not a heading', '## also not', '```', '### B', '#### C', '## D'].join('\n')
    expect(headings(text)).toEqual([
      { level: 2, text: 'A', line: 3 },
      { level: 3, text: 'B', line: 8 },
      { level: 2, text: 'D', line: 10 }
    ])
  })

  it('handles tilde fences and indented fences inside list items', () => {
    const text = ['## A', '1. step', '   ```bash', '   # comment', '   ```', '~~~', '## x', '~~~', '## B'].join('\n')
    expect(headings(text).map((h: { text: string }) => h.text)).toEqual(['A', 'B'])
  })
})

describe('githubAnchor', () => {
  it.each([
    ['지원 플랫폼과 릴리스', '지원-플랫폼과-릴리스'],
    ['Supported platforms and releases', 'supported-platforms-and-releases'],
    ['개발·기여와 보안', '개발기여와-보안'],
    ['Development, contributing and security', 'development-contributing-and-security'],
    ['출처와 라이선스 (Attribution & License)', '출처와-라이선스-attribution--license'],
    ['`npm run verify` 실행', 'npm-run-verify-실행'],
    ['macOS · iOS 빌드', 'macos--ios-빌드']
  ])('turns %j into %j', (heading, anchor) => {
    expect(githubAnchor(heading)).toBe(anchor)
  })

  it('numbers repeated anchors like GitHub', () => {
    const seen = new Map<string, number>()
    expect(['A', 'A', 'A'].map((h) => githubAnchor(h, seen))).toEqual(['a', 'a-1', 'a-2'])
  })
})

describe('headerArea', () => {
  it('returns the lines before the first ## heading', () => {
    expect(headerArea('# T\n\nintro\n\n## One\nbody\n')).toEqual(['# T', '', 'intro', ''])
  })

  it('ignores a ## line inside a code fence', () => {
    expect(headerArea('# T\n```\n## x\n```\n## One\n')).toHaveLength(4)
  })
})

describe('numberedSections', () => {
  it('reads plain-text numbered sections from NOTICE', () => {
    const text = '----\n1. 출처\n----\n본문\n2. 변경\n- 3. 목록 항목은 절이 아님\n'
    expect(numberedSections(text)).toEqual(['1. 출처', '2. 변경'])
  })

  it('reads ## numbered sections from NOTICE.en.md', () => {
    expect(numberedSections('## 1. Origin\n\n## 2. Changes\n### 2.1 sub\n', { markdown: true })).toEqual(['1. Origin', '2. Changes'])
  })
})
