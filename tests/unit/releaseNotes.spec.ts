// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from 'vitest'
import { TEST_BUILD_FORM_URL, renderTestBuildNotes } from '../../scripts/release-notes.mjs'

/** Spec 004 contracts/release-test-builds.md §3 step 2. */

describe('test build release notes', () => {
  it('describes the included test builds in Korean and English with the test build bug form', () => {
    const notes = renderTestBuildNotes({ linuxResult: 'success', androidResult: 'success' })
    expect(notes).toContain('## 테스트용 빌드 / Test builds')
    expect(notes).toMatch(/Linux·Android/)
    expect(notes).toMatch(/보장하지 않습니다/)
    expect(notes).toMatch(/no guarantee of quality, feature parity, real-device verification or response time/)
    expect(notes).toContain(TEST_BUILD_FORM_URL)
    expect(TEST_BUILD_FORM_URL).toMatch(/template=bug_report_test_build\.yml$/)
    expect(notes).not.toContain('pagelight:omitted')
  })

  it('marks a failed Linux build as build-failed', () => {
    const notes = renderTestBuildNotes({ linuxResult: 'failure', androidResult: 'success' })
    expect(notes).toContain('<!-- pagelight:omitted linux=build-failed -->')
    expect(notes).toMatch(/Linux 테스트용 빌드가 빠졌습니다/)
    expect(notes).toMatch(/The Linux test build is not included/)
    expect(notes).toMatch(/포함된 테스트용 빌드: Android/)
  })

  it('marks Android without a signing key as no-signing-key', () => {
    const notes = renderTestBuildNotes({ linuxResult: 'success', androidResult: 'skipped', androidReason: 'no-signing-key' })
    expect(notes).toContain('<!-- pagelight:omitted android=no-signing-key -->')
    expect(notes).toMatch(/서명 키/)
    expect(notes).toMatch(/signing key/)
  })

  it('marks a platform under a security exclusion as security, without defect details', () => {
    const notes = renderTestBuildNotes({
      linuxResult: 'skipped',
      androidResult: 'success',
      exclusions: [{ platform: 'linux', advisory: 'PAGELIGHT-2026-001', since: '2026-12-01' }]
    })
    expect(notes).toContain('<!-- pagelight:omitted linux=security -->')
    expect(notes).toContain('PAGELIGHT-2026-001')
    expect(notes).toMatch(/보안/)
  })

  it('says no test build is included when both are left out', () => {
    const notes = renderTestBuildNotes({ linuxResult: 'failure', androidResult: 'skipped', androidReason: 'no-signing-key' })
    expect(notes).toMatch(/포함된 테스트용 빌드: 없음/)
    expect(notes.match(/pagelight:omitted/g)).toHaveLength(2)
  })

  it('rejects an unknown reason', () => {
    expect(() => renderTestBuildNotes({ linuxResult: 'success', androidResult: 'skipped', androidReason: 'oops' })).toThrow()
  })
})
