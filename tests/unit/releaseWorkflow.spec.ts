import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveDesktopBuildCommand } from '../../scripts/ci-build-desktop.mjs'

const ROOT_DIR = path.resolve(__dirname, '../..')

describe('Multi-platform release GitHub Actions workflows', () => {
  it('resolves desktop build command for stable vs pre-release versions across Windows, Linux, and macOS (T048)', () => {
    expect(
      resolveDesktopBuildCommand('windows-x64', '0.1.6', 'npx tauri build --bundles nsis,msi')
    ).toBe('npx tauri build --bundles nsis,msi')
    expect(
      resolveDesktopBuildCommand('windows-x64', '0.1.6-beta', 'npx tauri build --bundles nsis,msi')
    ).toBe('npx tauri build --bundles nsis')
    expect(
      resolveDesktopBuildCommand('windows-x64', '0.1.6-0', 'npx tauri build --bundles nsis,msi')
    ).toBe('npx tauri build --bundles nsis')

    expect(
      resolveDesktopBuildCommand('linux-x64', '0.1.6', 'npx tauri build --bundles deb,rpm,appimage')
    ).toBe('npx tauri build --bundles deb,rpm,appimage')
    expect(
      resolveDesktopBuildCommand(
        'linux-x64',
        '0.1.6-beta',
        'npx tauri build --bundles deb,rpm,appimage'
      )
    ).toBe('npx tauri build --bundles deb,appimage')

    expect(resolveDesktopBuildCommand('macos-universal', '0.1.6-beta', 'npm run mac:build')).toBe(
      'npm run mac:build'
    )
  })
  it('defines unified tag & dispatch release workflow covering verify, macOS universal, Windows, Linux, Android, and GitHub Release upload', () => {
    const releasePath = path.join(ROOT_DIR, '.github/workflows/release.yml')
    expect(fs.existsSync(releasePath)).toBe(true)

    const content = fs.readFileSync(releasePath, 'utf-8')
    expect(content).toMatch(/tags:\s*\n\s*-\s*['"]?v\*['"]?/)
    expect(content).toContain('workflow_dispatch:')
    expect(content).toContain('contents: write')
    expect(content).toContain('node-version: 24')
    expect(content).toContain('npm run verify')

    // Desktop matrix platforms
    expect(content).toContain('macos-latest')
    expect(content).toContain('aarch64-apple-darwin,x86_64-apple-darwin')
    expect(content).toContain('npm run mac:build')
    expect(content).toContain('windows-latest')
    expect(content).toContain('--bundles nsis,msi')
    expect(content).toContain('_x64_portable.zip')
    expect(content).toContain('ubuntu-22.04')
    expect(content).toContain('--bundles deb,rpm,appimage')
    expect(content).toContain('libwebkit2gtk-4.1-dev')
    expect(content).toContain('APPIMAGE_EXTRACT_AND_RUN')

    // Android release APK build
    expect(content).toContain("java-version: '21'")
    expect(content).toContain('android-actions/setup-android@v4')
    expect(content).toContain('aarch64-linux-android')
    expect(content).toContain('npm run android:init')
    expect(content).toContain('npm run android:release')

    // GitHub Release upload (create or clobber existing tag release from CI build artifacts)
    expect(content).toContain('publish-release:')
    expect(content).not.toContain('build/*.dmg')
    expect(content).toContain("-name '*.dmg'")
    expect(content).toContain('gh release upload')
    expect(content).toContain('gh release create')
  })

  it('keeps build-apple.yml scoped to manual/PR Apple validation without duplicating v* tag release triggers', () => {
    const applePath = path.join(ROOT_DIR, '.github/workflows/build-apple.yml')
    const content = fs.readFileSync(applePath, 'utf-8')

    expect(content).toContain('workflow_dispatch:')
    expect(content).toContain('pull_request:')
    expect(content).not.toMatch(/tags:\s*\n\s*-\s*['"]?v\*['"]?/)
    expect(content).toContain('node-version: 24')
  })
})
