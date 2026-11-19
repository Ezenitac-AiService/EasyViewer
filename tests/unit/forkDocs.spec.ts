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
