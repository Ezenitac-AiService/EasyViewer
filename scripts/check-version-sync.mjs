import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

function extractCargoPackageVersion(tomlContent) {
  const pkgSectionMatch = /\[package\]([\s\S]*?)(?:\r?\n\[|$)/.exec(tomlContent)
  const searchScope = pkgSectionMatch ? pkgSectionMatch[1] : tomlContent
  const versionMatch = /^\s*version\s*=\s*"([^"]+)"/m.exec(searchScope)
  return versionMatch ? versionMatch[1].trim() : ''
}

/**
 * Checks that package.json, src-tauri/Cargo.toml, and src-tauri/tauri.conf.json expose identical versions.
 */
export function checkVersionSync(rootDir = process.cwd()) {
  const pkgPath = path.join(rootDir, 'package.json')
  const cargoPath = path.join(rootDir, 'src-tauri/Cargo.toml')
  const tauriConfPath = path.join(rootDir, 'src-tauri/tauri.conf.json')

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
  const cargoToml = fs.readFileSync(cargoPath, 'utf-8')
  const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf-8'))

  const versions = {
    packageJson: String(pkg.version || '').trim(),
    cargoToml: extractCargoPackageVersion(cargoToml),
    tauriConf: String(tauriConf.version || '').trim()
  }

  if (!versions.packageJson || !versions.cargoToml || !versions.tauriConf) {
    return {
      ok: false,
      versions,
      error: `버전 누락 발견: package.json=${versions.packageJson}, Cargo.toml=${versions.cargoToml}, tauri.conf.json=${versions.tauriConf}`
    }
  }

  const allEqual =
    versions.packageJson === versions.cargoToml && versions.packageJson === versions.tauriConf

  if (!allEqual) {
    return {
      ok: false,
      versions,
      error: `버전 불일치: package.json(${versions.packageJson}) != Cargo.toml(${versions.cargoToml}) != tauri.conf.json(${versions.tauriConf})`
    }
  }

  return { ok: true, versions }
}

function main() {
  const res = checkVersionSync(process.cwd())
  if (!res.ok) {
    console.error(`[check:version] ${res.error}`)
    process.exit(1)
  }
  console.log(`[check:version] 3개 매니페스트 버전 일치 확인: ${res.versions.packageJson}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
