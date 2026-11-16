import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { checkVersionSync } from '../../scripts/check-version-sync.mjs'
import { validateCommitMessage } from '../../scripts/check-commit-msg.mjs'

describe('Governance scripts: version sync & commit message validation (US4 - TDD)', () => {
  const tempDirs: string[] = []

  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop()
      if (dir) fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it('verifies version consistency across package.json, Cargo.toml, and tauri.conf.json and rejects mismatches', () => {
    const realResult = checkVersionSync(process.cwd())
    expect(realResult.ok).toBe(true)
    expect(realResult.versions.packageJson).toBe(realResult.versions.cargoToml)
    expect(realResult.versions.packageJson).toBe(realResult.versions.tauriConf)

    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ev-version-'))
    tempDirs.push(tmpRoot)
    fs.mkdirSync(path.join(tmpRoot, 'src-tauri'), { recursive: true })
    fs.writeFileSync(path.join(tmpRoot, 'package.json'), JSON.stringify({ version: '0.1.5' }))
    fs.writeFileSync(path.join(tmpRoot, 'src-tauri/Cargo.toml'), '[package]\nversion = "0.1.4"\n')
    fs.writeFileSync(path.join(tmpRoot, 'src-tauri/tauri.conf.json'), JSON.stringify({ version: '0.1.5' }))

    const mismatch = checkVersionSync(tmpRoot)
    expect(mismatch.ok).toBe(false)
    expect(mismatch.error).toMatch(/불일치|mismatch/i)

    // Pre-release SemVer (0.1.6-alpha) sync including package-lock.json and Cargo.lock
    const alphaRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ev-version-alpha-'))
    tempDirs.push(alphaRoot)
    fs.mkdirSync(path.join(alphaRoot, 'src-tauri'), { recursive: true })
    fs.writeFileSync(path.join(alphaRoot, 'package.json'), JSON.stringify({ version: '0.1.6-alpha' }))
    fs.writeFileSync(
      path.join(alphaRoot, 'package-lock.json'),
      JSON.stringify({ version: '0.1.6-alpha', packages: { '': { version: '0.1.6-alpha' } } })
    )
    fs.writeFileSync(path.join(alphaRoot, 'src-tauri/Cargo.toml'), '[package]\nversion = "0.1.6-alpha"\n')
    fs.writeFileSync(
      path.join(alphaRoot, 'src-tauri/Cargo.lock'),
      '[[package]]\nname = "easy-viewer"\nversion = "0.1.6-alpha"\n'
    )
    fs.writeFileSync(path.join(alphaRoot, 'src-tauri/tauri.conf.json'), JSON.stringify({ version: '0.1.6-alpha' }))

    expect(checkVersionSync(alphaRoot).ok).toBe(true)

    // Stale package-lock.json must fail checkVersionSync
    fs.writeFileSync(
      path.join(alphaRoot, 'package-lock.json'),
      JSON.stringify({ version: '0.1.5', packages: { '': { version: '0.1.5' } } })
    )
    const lockMismatch = checkVersionSync(alphaRoot)
    expect(lockMismatch.ok).toBe(false)
    expect(lockMismatch.error).toMatch(/package-lock\.json/)

    // Stale Cargo.lock must also fail checkVersionSync
    fs.writeFileSync(
      path.join(alphaRoot, 'package-lock.json'),
      JSON.stringify({ version: '0.1.6-alpha', packages: { '': { version: '0.1.6-alpha' } } })
    )
    fs.writeFileSync(
      path.join(alphaRoot, 'src-tauri/Cargo.lock'),
      '[[package]]\nname = "easy-viewer"\nversion = "0.1.5"\n'
    )
    const cargoLockMismatch = checkVersionSync(alphaRoot)
    expect(cargoLockMismatch.ok).toBe(false)
    expect(cargoLockMismatch.error).toMatch(/Cargo\.lock/)

    // Reject mismatched Android identifier in multi-platform config
    fs.writeFileSync(
      path.join(alphaRoot, 'src-tauri/Cargo.lock'),
      '[[package]]\nname = "easy-viewer"\nversion = "0.1.6-alpha"\n'
    )
    fs.writeFileSync(
      path.join(alphaRoot, 'src-tauri/tauri.android.conf.json'),
      JSON.stringify({ identifier: 'com.wrong.id' })
    )
    const androidMismatch = checkVersionSync(alphaRoot)
    expect(androidMismatch.ok).toBe(false)
    expect(androidMismatch.error).toMatch(/Android/)
  })

  it('enforces Korean Conventional Commits header, blank line, >=20 char Korean body, and allows Merge/Revert exceptions', () => {
    const valid = [
      'feat(security): 보안 정책 및 플랫폼 추상화 계층 강화',
      '',
      '- CSP 활성화 및 SSRF/DNS Pinning 검증 적용',
      '- WebDAV 자격 증명 키체인 마이그레이션과 경계 정적 검사 추가'
    ].join('\n')
    expect(validateCommitMessage(valid).ok).toBe(true)

    expect(validateCommitMessage('Merge branch "main" into feat/security').ok).toBe(true)
    expect(validateCommitMessage('Revert "feat: 임시 테스트"').ok).toBe(true)

    // Missing Korean in header
    expect(
      validateCommitMessage('feat: english summary only\n\n- 충분한 길이의 한국어 본문 변경 사항 설명입니다.').ok
    ).toBe(false)
    // Missing blank line after header
    expect(
      validateCommitMessage('feat: 요약 제목입니다\n- 바로 본문이 오면 실패해야 합니다.').ok
    ).toBe(false)
    // Missing or too short body
    expect(validateCommitMessage('feat: 요약 제목입니다\n\n짧은 본문').ok).toBe(false)
  })
})
