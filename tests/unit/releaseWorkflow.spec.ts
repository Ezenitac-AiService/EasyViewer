import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveDesktopBuildCommand } from '../../scripts/ci-build-desktop.mjs'
import { checkStatic } from '../../scripts/check-release-gate.mjs'

/** spec 003 US7 / T078 (contracts/release-and-ci.md §1, §2, §5). */

const ROOT_DIR = path.resolve(__dirname, '../..')
// Windows checkouts use CRLF (core.autocrlf); compare workflow text with LF line endings.
const read = (rel: string) => fs.readFileSync(path.join(ROOT_DIR, rel), 'utf-8').replace(/\r\n/g, '\n')

/** Returns the block of one top-level job (`  name:` … next `  name:`). */
function jobBlock(text: string, job: string): string {
  const lines = text.split('\n')
  const start = lines.findIndex((l) => l === `  ${job}:`)
  if (start < 0) return ''
  const end = lines.findIndex((l, i) => i > start && /^ {2}[\w-]+:\s*$/.test(l))
  return lines.slice(start, end < 0 ? undefined : end).join('\n')
}

describe('ci-build-desktop.mjs', () => {
  it('has no Windows branch and keeps the macOS/Linux pre-release rules', () => {
    expect(resolveDesktopBuildCommand('linux-x64', '1.0.0', 'npx tauri build --bundles deb,rpm,appimage')).toBe(
      'npx tauri build --bundles deb,rpm,appimage'
    )
    expect(
      resolveDesktopBuildCommand('linux-x64', '1.0.0-alpha.1', 'npx tauri build --bundles deb,rpm,appimage')
    ).toBe('npx tauri build --bundles deb,appimage')
    expect(resolveDesktopBuildCommand('macos-universal', '1.0.0-alpha.1', 'npm run mac:build')).toBe('npm run mac:build')
    expect(() => resolveDesktopBuildCommand('windows-x64', '1.0.0', 'npx tauri build --bundles nsis,msi')).toThrow(
      /windows-x64/
    )
    expect(read('scripts/ci-build-desktop.mjs')).not.toMatch(/nsis|msi/)
  })
})

describe('release.yml (contracts §2)', () => {
  const text = read('.github/workflows/release.yml')

  it('builds only supported platforms and never Windows artifacts', () => {
    expect(text).not.toMatch(/windows-(latest|x64)/)
    // No Windows build, bundle or collection step. (The publish guard still names .exe/.msi to refuse them.)
    expect(text).not.toMatch(/--bundles [^\n]*(nsis|msi)|Package Windows|-name '\*\.(exe|msi|zip)'/)
    expect(text).toContain('macos-universal')
    expect(text).toContain('linux-x64')
    expect(text).toContain("-name '*.apk'")
  })

  it('runs the gate before every build and again on the artifacts before publishing', () => {
    expect(jobBlock(text, 'gate')).toContain('node scripts/check-release-gate.mjs --release')
    expect(jobBlock(text, 'gate')).toContain('--phase prebuild')
    for (const job of ['build-desktop', 'build-android']) {
      expect(jobBlock(text, job)).toMatch(/needs:\s*(\[[^\]]*gate[^\]]*\]|gate)/)
    }
    const publish = jobBlock(text, 'publish')
    expect(publish).toMatch(/needs:\s*\[[^\]]*gate[^\]]*\]/)
    expect(publish).toContain('--phase publish')
    expect(publish.indexOf('SHA256SUMS.txt')).toBeLessThan(publish.indexOf('--phase publish'))
  })

  it('fails publishing when a forbidden Windows file shows up', () => {
    const publish = jobBlock(text, 'publish')
    expect(publish).toMatch(/\.exe.*\.msi|\\\.\(exe\|msi/)
    expect(publish).toMatch(/exit 1/)
  })

  it('creates SHA256SUMS.txt and uses the fork name for the title and the notes template', () => {
    const publish = jobBlock(text, 'publish')
    expect(publish).toMatch(/sha256sum .*> SHA256SUMS\.txt/)
    expect(publish).toContain('--title "Pagelight $TAG"')
    expect(publish).toContain('.github/release-notes.md')
    expect(text).not.toMatch(/EasyViewer[_ ]/)
  })

  it('signs Android release builds with the fork key only inside the signing step', () => {
    const android = jobBlock(text, 'build-android')
    for (const secret of ['ANDROID_KEYSTORE_BASE64', 'ANDROID_KEYSTORE_PASSWORD', 'ANDROID_KEY_ALIAS', 'ANDROID_KEY_PASSWORD']) {
      expect(android).toContain(`secrets.${secret}`)
    }
    expect(android).toContain('RUNNER_TEMP')
    expect(android).toMatch(/rm -f .*keystore/)
    expect(android).not.toMatch(/echo\s+"?\$\{?ANDROID_KEY/)
  })

  it('supports rehearsal only through workflow_dispatch and only as a draft', () => {
    expect(text).toMatch(/workflow_dispatch:[\s\S]*rehearsal:/)
    expect(text).toMatch(/tags:\s*\n\s*-\s*['"]?v\*['"]?/)
    expect(text).toContain('--rehearsal')
    expect(text).toContain('[REHEARSAL]')
    expect(text).toMatch(/--draft/)
    expect(text).toMatch(/-rehearsal/)
  })

  it('grants contents: write only to publish', () => {
    expect(text).toMatch(/^permissions:\s*\n\s+contents:\s*read\s*$/m)
    expect(jobBlock(text, 'publish')).toMatch(/contents:\s*write/)
  })
})

describe('ci.yml (contracts §1)', () => {
  const text = read('.github/workflows/ci.yml')

  it('runs on pull requests and pushes to main', () => {
    expect(text).toMatch(/pull_request:/)
    expect(text).toMatch(/push:\s*\n\s*branches:\s*\[?\s*main/)
  })

  it('has the six blocking jobs and no secrets', () => {
    for (const job of ['verify', 'licenses', 'windows-compile-test', 'macos-build', 'ios-sim-build', 'android-debug']) {
      expect(jobBlock(text, job), job).not.toBe('')
    }
    expect(text).not.toContain('secrets.')
    expect(text).not.toContain('continue-on-error')
  })

  it('wires the expected commands into each job', () => {
    expect(jobBlock(text, 'verify')).toContain('npm run verify')
    const licenses = jobBlock(text, 'licenses')
    expect(licenses).toContain('cargo deny check')
    expect(licenses).toContain('cargo-about')
    expect(licenses).toMatch(/node scripts\/check-licenses\.mjs\s*$/m)
    const win = jobBlock(text, 'windows-compile-test')
    expect(win).toContain('windows-latest')
    expect(win).toContain('npm test')
    expect(win).toContain('cargo check')
    expect(win).toContain('cargo test')
    expect(win).not.toMatch(/tauri build/)
    expect(jobBlock(text, 'macos-build')).toContain('codesign --verify')
    expect(jobBlock(text, 'ios-sim-build')).toContain('aarch64-sim')
    expect(jobBlock(text, 'android-debug')).toContain('npm run android:build')
  })
})

describe('dependency-audit.yml (weekly advisory check)', () => {
  const file = '.github/workflows/dependency-audit.yml'

  it('runs weekly and on demand, read-only, without secrets', () => {
    expect(fs.existsSync(path.join(ROOT_DIR, file))).toBe(true)
    const text = read(file)
    expect(text).toMatch(/schedule:\s*\n\s*-\s*cron:\s*['"][^'"]+['"]/)
    expect(text).toMatch(/workflow_dispatch:/)
    expect(text).toMatch(/^permissions:\s*\n\s+contents:\s*read\s*$/m)
    expect(text).not.toContain('secrets.')
    expect(text).not.toContain('continue-on-error')
  })

  it('checks Rust advisories and production npm advisories', () => {
    const text = read(file)
    expect(text).toMatch(/cargo deny check advisories/)
    expect(text).toMatch(/npm audit --omit=dev --audit-level=(high|critical)/)
  })
})

describe('workflow supply chain (contracts §1, research R12)', () => {
  it('build-apple.yml is folded into ci.yml', () => {
    expect(fs.existsSync(path.join(ROOT_DIR, '.github/workflows/build-apple.yml'))).toBe(false)
  })

  it('all workflows pass the static gate (scripts exist, read-only top level, pinned third-party actions)', () => {
    expect(checkStatic(ROOT_DIR)).toEqual([])
  })

  it('uses Node 24 capable majors of the official actions', () => {
    for (const file of ['ci.yml', 'release.yml']) {
      const text = read(`.github/workflows/${file}`)
      for (const m of text.matchAll(/uses:\s*actions\/([\w-]+)@v(\d+)/g)) {
        expect(Number(m[2]), `${file} actions/${m[1]}`).toBeGreaterThanOrEqual(6)
      }
    }
  })
})
