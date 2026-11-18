// SPDX-License-Identifier: GPL-3.0-only
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { checkStatic, runGate } from '../../scripts/check-release-gate.mjs'

const BASE_SHA = '44c4d37749d29bd070e7a07aea4622eef0b97306'
const PIN = 'a'.repeat(40)
const tempDirs: string[] = []
afterEach(() => {
  while (tempDirs.length) fs.rmSync(tempDirs.pop() as string, { recursive: true, force: true })
})

function repo(files: Record<string, string>) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ev-gate-'))
  tempDirs.push(root)
  for (const [rel, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true })
    fs.writeFileSync(path.join(root, rel), content)
  }
  return root
}

const V = 'specs/003-independent-fork-separation/verification'
const GOOD_RECORDS = {
  [`${V}/security-coordination.md`]: '통지 날짜: 2026-11-20\n',
  [`${V}/upstream-notice.md`]: '고지 날짜: 2026-11-21\n이의 대응 결과: 이의 없음\n',
  [`${V}/release-gate.md`]: '- [x] 8. Android 서명 키 백업 확인\n서명 인증서 SHA-256: AB:CD\n직전 포크 릴리스 versionCode: 1006\n',
  'package.json': JSON.stringify({ version: '1.0.0-alpha.1', scripts: { verify: 'node scripts/verify.mjs' } }),
  'src-tauri/tauri.conf.json': JSON.stringify({ version: '1.0.0-alpha.1', bundle: { android: { versionCode: 1000001 } } }),
  'scripts/verify.mjs': '//'
}

function env(over: Partial<Record<string, unknown>> = {}) {
  return {
    remoteTagSha: () => BASE_SHA,
    ciStatus: () => ({ ci: 'success', licenses: 'success' }),
    upstreamVersions: () => ['0.1.6', '0.2.0', '0.2.1'],
    draftReleases: () => [] as string[],
    ...over
  }
}

function assets(files: string[]) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ev-assets-'))
  tempDirs.push(dir)
  for (const f of files) fs.writeFileSync(path.join(dir, f), f)
  return dir
}

describe('separation gate (FR-025 items 1–5)', () => {
  it('passes when all five items are satisfied', () => {
    const r = runGate(repo(GOOD_RECORDS), { mode: 'separation' }, env())
    expect(r.errors).toEqual([])
    expect(r.items.map((i: { id: string }) => i.id)).toEqual(['1', '2', '3', '4', '5'])
  })

  it.each([
    ['1', env({ remoteTagSha: () => null })],
    ['1', env({ remoteTagSha: () => 'b'.repeat(40) })],
    ['4', env({ ciStatus: () => ({ ci: 'failure', licenses: 'success' }) })],
    ['5', env({ ciStatus: () => ({ ci: 'success', licenses: 'failure' }) })]
  ])('fails item %s', (id, e) => {
    const r = runGate(repo(GOOD_RECORDS), { mode: 'separation' }, e)
    expect(r.errors.join('\n')).toMatch(new RegExp(`\\[${id}\\]`))
  })

  it('fails items 2 and 3 when the records have no dates', () => {
    const root = repo({ ...GOOD_RECORDS, [`${V}/security-coordination.md`]: '아직\n', [`${V}/upstream-notice.md`]: '' })
    const msg = runGate(root, { mode: 'separation' }, env()).errors.join('\n')
    expect(msg).toMatch(/\[2\]/)
    expect(msg).toMatch(/\[3\]/)
  })

  it('accepts a notification-attempt record for item 2 (research R11)', () => {
    const root = repo({ ...GOOD_RECORDS, [`${V}/security-coordination.md`]: '통지 시도 기록: 2026-11-20 공개 채널 연락 요청, 30일 무응답\n' })
    expect(runGate(root, { mode: 'separation' }, env()).errors).toEqual([])
  })
})

describe('release gate (FR-025 items 1–8 + extras)', () => {
  const okAssets = () => {
    const dir = assets(['Fork_1.0.0-alpha.1_universal.dmg', 'Fork_1.0.0-alpha.1_amd64.deb'])
    fs.writeFileSync(
      path.join(dir, 'SHA256SUMS.txt'),
      'x  Fork_1.0.0-alpha.1_universal.dmg\ny  Fork_1.0.0-alpha.1_amd64.deb\n'
    )
    return dir
  }

  it('passes with checksums, no Windows artifacts, key backup, new version and versionCode', () => {
    const r = runGate(repo(GOOD_RECORDS), { mode: 'release', tag: 'v1.0.0-alpha.1', assetsDir: okAssets() }, env())
    expect(r.errors).toEqual([])
  })

  it('fails item 6 when a file is not covered by SHA256SUMS.txt', () => {
    const dir = okAssets()
    fs.writeFileSync(path.join(dir, 'extra.apk'), 'z')
    const r = runGate(repo(GOOD_RECORDS), { mode: 'release', tag: 'v1.0.0-alpha.1', assetsDir: dir }, env())
    expect(r.errors.join('\n')).toMatch(/\[6\]/)
  })

  it.each(['app.exe', 'app.msi', 'App_x64_portable.zip'])('fails item 7 for %s', (f) => {
    const dir = okAssets()
    fs.writeFileSync(path.join(dir, f), 'w')
    fs.appendFileSync(path.join(dir, 'SHA256SUMS.txt'), `w  ${f}\n`)
    const r = runGate(repo(GOOD_RECORDS), { mode: 'release', tag: 'v1.0.0-alpha.1', assetsDir: dir }, env())
    expect(r.errors.join('\n')).toMatch(/\[7\]/)
  })

  it('fails item 8 without the maintainer key-backup check', () => {
    const root = repo({ ...GOOD_RECORDS, [`${V}/release-gate.md`]: '- [ ] 8. Android 서명 키 백업 확인\n' })
    const r = runGate(root, { mode: 'release', tag: 'v1.0.0-alpha.1', assetsDir: okAssets() }, env())
    expect(r.errors.join('\n')).toMatch(/\[8\]/)
  })

  it('fails when the version was already used upstream', () => {
    const r = runGate(repo(GOOD_RECORDS), { mode: 'release', tag: 'v1.0.0-alpha.1', assetsDir: okAssets() },
      env({ upstreamVersions: () => ['1.0.0-alpha.1'] }))
    expect(r.errors.join('\n')).toMatch(/비중복/)
  })

  it('fails when the tag does not match the manifest version', () => {
    const r = runGate(repo(GOOD_RECORDS), { mode: 'release', tag: 'v9.9.9', assetsDir: okAssets() }, env())
    expect(r.errors.join('\n')).toMatch(/태그/)
  })

  it('fails when versionCode is missing or not increasing', () => {
    const missing = repo({ ...GOOD_RECORDS, 'src-tauri/tauri.conf.json': JSON.stringify({ version: '1.0.0-alpha.1' }) })
    expect(runGate(missing, { mode: 'release', tag: 'v1.0.0-alpha.1', assetsDir: okAssets() }, env()).errors.join('\n')).toMatch(/versionCode/)
    const low = repo({ ...GOOD_RECORDS, 'src-tauri/tauri.conf.json': JSON.stringify({ version: '1.0.0-alpha.1', bundle: { android: { versionCode: 1006 } } }) })
    expect(runGate(low, { mode: 'release', tag: 'v1.0.0-alpha.1', assetsDir: okAssets() }, env()).errors.join('\n')).toMatch(/versionCode/)
  })

  it('fails when a draft release with the same tag is left over', () => {
    const r = runGate(repo(GOOD_RECORDS), { mode: 'release', tag: 'v1.0.0-alpha.1', assetsDir: okAssets() },
      env({ draftReleases: () => ['v1.0.0-alpha.1'] }))
    expect(r.errors.join('\n')).toMatch(/초안/)
  })

  it('reports BLOCKED (not pass) when the upstream release list cannot be fetched', () => {
    const r = runGate(repo(GOOD_RECORDS), { mode: 'release', tag: 'v1.0.0-alpha.1', assetsDir: okAssets() },
      env({ upstreamVersions: () => null }))
    expect(r.blocked.join('\n')).toMatch(/업스트림/)
  })
})

describe('rehearsal mode', () => {
  it('downgrades maintainer items 1–3 and 8 to warnings but still checks automatic items', () => {
    const root = repo({ ...GOOD_RECORDS, [`${V}/security-coordination.md`]: '', [`${V}/upstream-notice.md`]: '', [`${V}/release-gate.md`]: '' })
    const dir = assets(['Fork_1.0.0-alpha.1-rehearsal_amd64.deb', 'app.exe'])
    fs.writeFileSync(path.join(dir, 'SHA256SUMS.txt'), 'x  Fork_1.0.0-alpha.1-rehearsal_amd64.deb\nw  app.exe\n')
    const r = runGate(root, { mode: 'release', rehearsal: true, tag: 'v1.0.0-alpha.1-rehearsal', assetsDir: dir },
      env({ remoteTagSha: () => null }))
    expect(r.warnings.join('\n')).toMatch(/\[1\][\s\S]*\[2\][\s\S]*\[3\][\s\S]*\[8\]/)
    expect(r.errors.join('\n')).toMatch(/\[7\]/)
  })

  it('requires the rehearsal tag to end with -rehearsal', () => {
    const r = runGate(repo(GOOD_RECORDS), { mode: 'release', rehearsal: true, tag: 'v1.0.0-alpha.1', assetsDir: assets([]) }, env())
    expect(r.errors.join('\n')).toMatch(/-rehearsal/)
  })
})

describe('static workflow rules (FR-011, FR-022, research R12)', () => {
  const goodWorkflow = `name: CI
on: [pull_request]
permissions:
  contents: read
jobs:
  verify:
    runs-on: ubuntu-22.04
    steps:
      - uses: actions/checkout@v6
      - uses: dtolnay/rust-toolchain@${PIN} # stable
      - run: npm run verify
      - run: node scripts/verify.mjs
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - name: Sign
        env:
          KEY: \${{ secrets.ANDROID_KEYSTORE_BASE64 }}
        run: echo ok
`
  it('passes a compliant workflow', () => {
    expect(checkStatic(repo({ ...GOOD_RECORDS, '.github/workflows/ci.yml': goodWorkflow }))).toEqual([])
  })

  it.each([
    ['missing script', goodWorkflow.replace('scripts/verify.mjs', 'scripts/missing.mjs'), /missing\.mjs/],
    ['undefined npm script', goodWorkflow.replace('npm run verify', 'npm run nope'), /nope/],
    ['upstream sync', goodWorkflow.replace('run: npm run verify', 'run: git fetch upstream && git merge upstream/main'), /동기화/],
    ['gh repo sync', goodWorkflow.replace('run: npm run verify', 'run: gh repo sync'), /동기화/],
    ['write at top level', goodWorkflow.replace('permissions:\n  contents: read', 'permissions:\n  contents: write'), /최상위 권한/],
    ['write outside publish', goodWorkflow.replace('runs-on: ubuntu-22.04', 'runs-on: ubuntu-22.04\n    permissions:\n      contents: write'), /publish/],
    ['unpinned third-party action', goodWorkflow.replace(`@${PIN} # stable`, '@stable'), /SHA/],
    ['job-level secret', goodWorkflow.replace('  publish:\n    runs-on: ubuntu-latest', '  publish:\n    runs-on: ubuntu-latest\n    env:\n      K: ${{ secrets.X }}'), /비밀값/]
  ])('rejects %s', (_label, wf, re) => {
    expect(checkStatic(repo({ ...GOOD_RECORDS, '.github/workflows/ci.yml': wf })).join('\n')).toMatch(re)
  })
})
