import fs from 'node:fs'
import { execSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

/**
 * Resolves the desktop Tauri bundle command for stable vs SemVer pre-release versions.
 * Windows WiX (.msi) and Linux RPM (rpmbuild) forbid hyphens in version strings,
 * so any hyphenated pre-release version falls back to NSIS on Windows and DEB+AppImage on Linux.
 */
export function resolveDesktopBuildCommand(
  matrixName,
  version,
  defaultCmd = 'npm run mac:build'
) {
  const name = String(matrixName || '').trim()
  const ver = String(version || '').trim()
  const isPrerelease = ver.includes('-')

  if (name === 'windows-x64' && isPrerelease) {
    return 'npx tauri build --bundles nsis'
  }
  if (name === 'linux-x64' && isPrerelease) {
    return 'npx tauri build --bundles deb,appimage'
  }
  return defaultCmd || 'npm run mac:build'
}

function main() {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'))
  const ver = String(pkg.version || '')
  const name = process.env.MATRIX_NAME || ''
  const cmd = resolveDesktopBuildCommand(name, ver, process.env.MATRIX_BUILD_CMD)

  console.log(`[ci-build-desktop] name=${name}, version=${ver}, cmd=${cmd}`)
  execSync(cmd, { stdio: 'inherit' })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
