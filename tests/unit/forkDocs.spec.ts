// SPDX-License-Identifier: GPL-3.0-only
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { checkForbiddenWording } from '../../scripts/check-support-scope.mjs'

/** spec 003 T038 (README "원저작자 앱과의 차이") and T081 (SECURITY.md). */

const ROOT_DIR = path.resolve(__dirname, '../..')
const read = (rel: string) => fs.readFileSync(path.join(ROOT_DIR, rel), 'utf-8').replace(/\r\n/g, '\n')
const exists = (rel: string) => fs.existsSync(path.join(ROOT_DIR, rel))

/** Returns the body of a `## heading` section (until the next `## `). */
function section(text: string, heading: string): string {
  const start = text.indexOf(`\n## ${heading}`)
  if (start < 0) return ''
  const rest = text.slice(start + 1)
  const end = rest.indexOf('\n## ', 1)
  return end < 0 ? rest : rest.slice(0, end)
}

const tempDirs: string[] = []
afterEach(() => {
  while (tempDirs.length) fs.rmSync(tempDirs.pop() as string, { recursive: true, force: true })
})

describe('README "원저작자 앱과의 차이" (T038)', () => {
  const diff = () => section(read('README.md'), '원저작자 앱과의 차이')

  it('exists and states only verifiable facts: platforms, identifiers, data format version, name', () => {
    const body = diff()
    expect(body).not.toBe('')
    for (const fact of ['Pagelight', 'EasyViewer', 'com.ezenitac.easyviewer', 'com.edith.easyviewer', 'Windows', 'Linux', 'iOS']) {
      expect(body, fact).toContain(fact)
    }
    // Internal data format version: fork 2, upstream 1 (spec 003 assumptions).
    expect(body).toMatch(/데이터 형식[^\n]*2/)
    expect(body).toMatch(/데이터 형식[^\n]*1/)
  })

  it('does not evaluate the upstream app or compare security defects', () => {
    const body = diff()
    expect(body).not.toMatch(/취약점|보안\s*결함|결함|더 (좋|낫|안전)|열등|우수/)
  })
})

describe('SECURITY.md (T081)', () => {
  const doc = () => (exists('SECURITY.md') ? read('SECURITY.md') : '')

  it('covers supported versions, private reporting, upstream reporting, history limit and disclosure policy', () => {
    const text = doc()
    expect(text).not.toBe('')
    expect(text).toContain('Ezenitac-AiService/EasyViewer/security/advisories/new')
    expect(text).toMatch(/지원 버전/)
    expect(text).toMatch(/최신/)
    expect(text).toContain('https://github.com/edith2580/EasyViewer')
    expect(text).toMatch(/git 이력/)
    expect(text).toMatch(/90일/)
  })

  it('never names a personal device identifier or Apple team ID', () => {
    // 40-hex UDIDs, 8-4 UDIDs and 10-character Apple team IDs must not appear.
    expect(doc()).not.toMatch(/\b[0-9a-f]{40}\b|\b[0-9A-F]{8}-[0-9A-F]{16}\b|DEVELOPMENT_TEAM\s*=\s*[A-Z0-9]{10}/)
  })

  it('keeps the upstream reporting sentence allowed by a registered exception even before notification', () => {
    const exceptions = JSON.parse(read('scripts/wording-exceptions.json'))
    expect(exceptions['SECURITY.md']).toBeDefined()
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ev-security-'))
    tempDirs.push(root)
    fs.writeFileSync(path.join(root, 'SECURITY.md'), doc())
    // No security-coordination record: the (f) rule is active.
    expect(checkForbiddenWording(root, exceptions)).toEqual([])
  })
})

describe('SECURITY test-build scope (spec 004 FR-005b, T022)', () => {
  it('states the test-build security scope in Korean', () => {
    const body = section(read('SECURITY.md'), '테스트용 빌드의 보안 범위')
    expect(body).not.toBe('')
    expect(body).toMatch(/공통 코드[^\n]*같은 릴리스/)
    expect(body).toMatch(/테스트용 빌드에만[^\n]*고칠 때까지[^\n]*(제외|뺍니다)/)
    expect(body).toContain('.github/release-exclusions.json')
  })

  it('states the same scope in English', () => {
    const body = section(read('SECURITY.en.md'), 'Security scope of test builds')
    expect(body).not.toBe('')
    expect(body).toMatch(/shared code[^\n]*same release/i)
    expect(body).toMatch(/only (affects|in) (a )?test build[^\n]*until[^\n]*(left out|excluded)/i)
    expect(body).toContain('.github/release-exclusions.json')
  })
})

describe('Windows exclusion in public docs (spec 004 contracts/windows-exclusion.md §3–§4, T030)', () => {
  const PRESERVED =
    '> **보존 기록**: 이 문서는 이 포크의 Windows 프리릴리스(`v0.1.6-alpha`·`v0.1.6-beta`) 지원 종료 이력으로 남긴 것이며 더 이상 갱신하지 않습니다. Windows는 이 포크의 범위가 아닙니다(헌법 v6.1.0).'

  it.each(['docs/windows-migration.md', 'docs/windows-eol-notice.md'])('marks %s as a preserved record at the top', (file) => {
    const lines = read(file).split('\n')
    expect(lines.slice(0, 4).join('\n')).toContain(PRESERVED)
  })

  it.each([
    ['README.md', 'Windows 사용자 안내', /원저작자의 \[EasyViewer\]/, /windows-migration\.md/],
    ['README.en.md', 'Windows users', /original \[EasyViewer\]/, /windows-migration\.md/]
  ])('keeps the %s Windows section to the upstream pointer and the preserved-record link', (file, heading, upstream, link) => {
    const text = read(file)
    const start = text.indexOf(`### ${heading}`)
    expect(start).toBeGreaterThan(-1)
    const rest = text.slice(start + 4)
    const body = rest.slice(rest.indexOf('\n'), rest.indexOf('\n#')).trim()
    const sentences = body.split(/(?<=[.다])\s+(?=\S)/).filter((s) => s.trim())
    expect(sentences).toHaveLength(2)
    expect(body).toMatch(upstream)
    expect(body).toMatch(link)
    expect(body).not.toMatch(/CI|컴파일|compiled/)
  })

  it.each([
    ['CONTRIBUTING.md', /Windows에서만 (쓰는|동작하는) 코드/, /Windows[^\n]*(CI|컴파일)|(CI|컴파일)[^\n]*Windows/],
    ['CONTRIBUTING.en.md', /Windows-only code/, /Windows[^\n]*(CI|compile)|(CI|compile)[^\n]*Windows/]
  ])('%s rejects Windows-only code and no longer talks about Windows CI', (file, rule, ci) => {
    const text = read(file)
    expect(text).toMatch(rule)
    expect(text).not.toMatch(ci)
  })
})

describe('README body and contributing guide (spec 005 contracts/readme-structure.md §2–§3, T012)', () => {
  const sections = (file: string) =>
    read(file)
      .replace(/```[\s\S]*?```/g, '')
      .split('\n')
      .filter((l) => l.startsWith('## '))
      .map((l) => l.slice(3).trim())

  it.each([
    [
      'README.md',
      ['원저작자 앱과의 차이', '지원 플랫폼과 릴리스', '기능', '조작 방법', '설치와 처음 실행', '소스 빌드', '개발·기여와 보안', '라이선스와 저작권 고지']
    ],
    [
      'README.en.md',
      [
        'Differences from the original app',
        'Supported platforms and releases',
        'Features',
        'Controls',
        'Installation and first launch',
        'Building from source',
        'Development, contributing and security',
        'License and copyright notices'
      ]
    ]
  ])('%s has the eight sections in order, user sections before development', (file, expected) => {
    expect(sections(file)).toEqual(expected)
  })

  it.each(['README.md', 'README.en.md'])('%s keeps developer details out (SC-009)', (file) => {
    const text = read(file)
    expect(text).not.toMatch(/├── src\//)
    expect(text).not.toMatch(/npm run check:boundaries/)
    expect(text).not.toMatch(/^- `\.\/package-lock\.json`/m)
    expect(text).not.toMatch(/git push origin v\d/)
    expect(text).not.toMatch(/npm run android:release:all/)
  })

  it.each([
    ['README.md', 'support-scope:start', '지원 플랫폼과 릴리스'],
    ['README.en.md', 'support-scope-en:start', 'Supported platforms and releases']
  ])('%s opens the supported-platforms section with the support-scope block and a five-row tier table', (file, marker, heading) => {
    const body = section(read(file), heading)
    const afterHeading = body.split('\n').slice(1).find((l) => l.trim())
    expect(afterHeading).toContain(marker)
    for (const p of ['macOS', 'iOS', 'Linux', 'Android', 'Windows']) expect(body).toMatch(new RegExp(`^\\| \\*?\\*?${p}`, 'm'))
  })

  it.each([
    ['CONTRIBUTING.md', ['개발 환경과 구조', '검증 명령', '버전과 빌드', 'CI와 릴리스']],
    ['CONTRIBUTING.en.md', ['Development environment and layout', 'Verification commands', 'Versions and builds', 'CI and releases']]
  ])('%s carries the moved developer sections', (file, names) => {
    const found = sections(file)
    for (const n of names) expect(found).toContain(n)
    const text = read(file)
    expect(text).toMatch(/├── src\//)
    expect(text).toMatch(/npm run check:boundaries/)
    expect(text).toMatch(/git push origin v\d/)
  })
})

