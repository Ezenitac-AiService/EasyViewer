// SPDX-License-Identifier: GPL-3.0-only
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ALLOWLIST, checkWindowsExclusion } from '../../scripts/check-windows-exclusion.mjs'

/** Spec 004 contracts/windows-exclusion.md §2 (rules W1–W7) and data-model §5 (allowlist). */

const ROOT_DIR = path.resolve(__dirname, '../..')
const tempDirs: string[] = []
afterEach(() => {
  while (tempDirs.length) fs.rmSync(tempDirs.pop() as string, { recursive: true, force: true })
})

function repo(files: Record<string, string>) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ev-win-'))
  tempDirs.push(root)
  for (const [rel, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true })
    fs.writeFileSync(path.join(root, rel), content)
  }
  return root
}

const CLEAN = {
  'src-tauri/Cargo.toml': '[target.\'cfg(any(target_os = "macos", target_os = "linux"))\'.dependencies]\n',
  'src-tauri/src/main.rs': 'fn main() {}\n',
  'src-tauri/src/lib.rs': 'pub fn f() -> bool { cfg!(target_os = "macos") }\n',
  // The word "windows" alone (the app window list) is not a Windows-only setting.
  'src-tauri/tauri.conf.json': JSON.stringify({ app: { windows: [{ title: 'Pagelight' }] }, bundle: { icon: ['icons/icon.png', 'icons/icon.icns'] } }),
  'src-tauri/capabilities/desktop.json': JSON.stringify({ platforms: ['linux', 'macOS'], windows: ['main'] }),
  'src-tauri/deny.toml': '[graph]\ntargets = ["aarch64-apple-darwin", "x86_64-unknown-linux-gnu"]\n',
  '.github/workflows/ci.yml': 'jobs:\n  build:\n    runs-on: macos-latest\n',
  'scripts/build.mjs': "const cmd = 'npx tauri build --bundles deb,appimage'\n",
  'package.json': JSON.stringify({ scripts: { 'mac:build': 'tauri build' } })
}

const cases: [string, Record<string, string>, string][] = [
  ['W1', { 'src-tauri/src/lib.rs': '#[cfg(windows)]\nfn f() {}\n' }, 'src-tauri/src/lib.rs'],
  ['W1', { 'src-tauri/src/lib.rs': 'fn f() -> bool { cfg!(any(target_os = "macos", target_os = "windows")) }\n' }, 'src-tauri/src/lib.rs'],
  ['W1', { 'src-tauri/src/main.rs': '#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]\n' }, 'src-tauri/src/main.rs'],
  ['W1', { 'src-tauri/Cargo.toml': '[target.\'cfg(any(target_os = "macos", windows, target_os = "linux"))\'.dependencies]\n' }, 'src-tauri/Cargo.toml'],
  ['W2', { 'src-tauri/tauri.conf.json': JSON.stringify({ bundle: { icon: ['icons/icon.ico'] } }) }, 'src-tauri/tauri.conf.json'],
  ['W2', { 'src-tauri/tauri.conf.json': JSON.stringify({ bundle: { windows: { wix: {} } } }) }, 'src-tauri/tauri.conf.json'],
  ['W2', { 'src-tauri/tauri.conf.json': JSON.stringify({ bundle: { targets: ['deb', 'nsis'] } }) }, 'src-tauri/tauri.conf.json'],
  ['W3', { 'src-tauri/capabilities/desktop.json': JSON.stringify({ platforms: ['linux', 'macOS', 'windows'] }) }, 'src-tauri/capabilities/desktop.json'],
  ['W4', { 'src-tauri/deny.toml': 'targets = ["x86_64-pc-windows-msvc"]\n' }, 'src-tauri/deny.toml'],
  ['W5', { 'src-tauri/icons/icon.ico': 'x' }, 'src-tauri/icons/icon.ico'],
  ['W5', { 'src-tauri/icons/Square44x44Logo.png': 'x' }, 'src-tauri/icons/Square44x44Logo.png'],
  ['W5', { 'src-tauri/icons/StoreLogo.png': 'x' }, 'src-tauri/icons/StoreLogo.png'],
  ['W5', { 'scripts/setup.ps1': 'x' }, 'scripts/setup.ps1'],
  ['W5', { 'scripts/run.cmd': 'x' }, 'scripts/run.cmd'],
  ['W6', { '.github/workflows/ci.yml': 'jobs:\n  w:\n    runs-on: windows-latest\n' }, '.github/workflows/ci.yml'],
  ['W6', { '.github/workflows/ci.yml': 'jobs:\n  w:\n    runs-on: windows-2022\n' }, '.github/workflows/ci.yml'],
  ['W7', { 'scripts/build.mjs': "const t = 'x86_64-pc-windows-msvc'\n" }, 'scripts/build.mjs'],
  ['W7', { 'scripts/build.mjs': "const cmd = 'npx tauri build --bundles nsis,msi'\n" }, 'scripts/build.mjs'],
  ['W7', { 'package.json': JSON.stringify({ scripts: { 'win:build': 'tauri build --bundles msi' } }) }, 'package.json']
]

describe('check-windows-exclusion (W1–W7)', () => {
  it('passes a clean repository', () => {
    expect(checkWindowsExclusion(repo(CLEAN))).toEqual([])
  })

  it.each(cases)('fails rule %s and names the file', (rule, files, file) => {
    const errors = checkWindowsExclusion(repo({ ...CLEAN, ...files }))
    expect(errors.some((e: string) => e.includes(rule) && e.includes(file)), errors.join('\n')).toBe(true)
  })

  it('accepts the same content inside the allowlist', () => {
    const root = repo({
      ...CLEAN,
      'src-tauri/gen/android/gradlew.bat': '@echo off\n',
      'scripts/check-release-gate.mjs': "const WINDOWS = /x86_64-pc-windows|--bundles nsis/\n",
      'specs/003-independent-fork-separation/icon.ico': 'x',
      'docs/windows-migration.md': '# Windows\n'
    })
    expect(checkWindowsExclusion(root)).toEqual([])
    expect(ALLOWLIST).toEqual(
      expect.arrayContaining([
        'src/config/supportScope.ts',
        '.github/ISSUE_TEMPLATE/config.yml',
        'docs/windows-migration.md',
        'docs/windows-eol-notice.md',
        'src-tauri/src/security/path_guard.rs',
        'scripts/check-release-gate.mjs',
        'scripts/check-windows-exclusion.mjs',
        'src-tauri/gen/android/gradlew.bat'
      ])
    )
  })

  it('ignores untracked build output such as node_modules and target', () => {
    const root = repo({ ...CLEAN, 'node_modules/x/run.cmd': 'x', 'src-tauri/target/debug/a.ico': 'x', 'dist/a.bat': 'x' })
    expect(checkWindowsExclusion(root)).toEqual([])
  })

  it('passes on this repository', () => {
    expect(checkWindowsExclusion(ROOT_DIR)).toEqual([])
  })
})
