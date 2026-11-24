// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from 'vitest'
import path from 'node:path'
import { checkTerms, checkTermsInText } from '../../scripts/docs/terms.mjs'

/** Spec 005 research R4 and contracts/doc-checks.md D6. */

const ROOT_DIR = path.resolve(__dirname, '../..')
const find = (text: string, file = 'README.md') => checkTermsInText(file, text)

describe('terms (D6)', () => {
  it.each(['원작 v0.1.6', '원작자에게', '원본 앱', '원본 저장소', 'the upstream app'])('rejects %j', (phrase) => {
    expect(find(`문장 ${phrase} 끝\n`).length).toBeGreaterThan(0)
  })

  it('accepts the standard terms and "원본" meaning the user data originals', () => {
    expect(find('원저작자 앱과 원저작자 저장소, 원저작물. 원본 파일은 그대로 남습니다.\n')).toEqual([])
  })

  it('allows 업스트림/upstream only next to Git work words', () => {
    expect(find('업스트림을 병합·체리픽·동기화하지 않습니다.\n')).toEqual([])
    expect(find('git remote remove upstream\n')).toEqual([])
    expect(find('tag `upstream-base-v0.1.6`\n')).toEqual([])
    expect(find('업스트림의 아이디어가 필요하면\n').length).toBeGreaterThan(0)
    expect(find('## Relationship with the upstream\n').length).toBeGreaterThan(0)
  })

  it('checks only the newest release section of the changelog', () => {
    const text = '# 변경 이력\n\n## [미출시] — 새\n\n- 원저작자 앱\n\n## [0.1.6]\n\n- 원작 기능\n'
    expect(find(text, 'CHANGELOG.md')).toEqual([])
    expect(find('# 변경 이력\n\n## [미출시]\n\n- 원작 기능\n', 'CHANGELOG.md').length).toBeGreaterThan(0)
  })

  it('exempts plain quotations but still checks GitHub alert blocks', () => {
    expect(find('> 원작 인용문\n')).toEqual([])
    expect(find('> [!NOTE]\n> 원작 안내\n').length).toBeGreaterThan(0)
  })

  it('ignores code fences and inline code', () => {
    expect(find('```\n원작\n```\n`원작`\n')).toEqual([])
  })

  it('passes on this repository', () => {
    expect(checkTerms(ROOT_DIR)).toEqual([])
  })
})
