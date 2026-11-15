import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

function extractCargoPackageField(tomlContent, field) {
  const pkgSectionMatch = /\[package\]([\s\S]*?)(?:\r?\n\[|$)/.exec(tomlContent)
  const searchScope = pkgSectionMatch ? pkgSectionMatch[1] : tomlContent
  const fieldMatch = new RegExp(`^\\s*${field}\\s*=\\s*"([^"]+)"`, 'm').exec(searchScope)
  return fieldMatch ? fieldMatch[1].trim() : ''
}

function extractCargoLockPackageVersion(lockContent, packageName) {
  const escapedName = packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const blocks = lockContent.split(/^\[\[package\]\]/m).slice(1)
  for (const block of blocks) {
    const nextTableIdx = block.search(/\r?\n\[/)
    const scope = nextTableIdx >= 0 ? block.slice(0, nextTableIdx) : block
    if (new RegExp(`^\\s*name\\s*=\\s*"${escapedName}"`, 'm').test(scope)) {
      const versionMatch = /^\s*version\s*=\s*"([^"]+)"/m.exec(scope)
      if (versionMatch) {
        return versionMatch[1].trim()
      }
    }
  }
  return ''
}

/**
 * Checks that package.json, src-tauri/Cargo.toml, src-tauri/tauri.conf.json,
 * and optional lockfiles (package-lock.json, src-tauri/Cargo.lock) expose identical versions.
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
    cargoToml: extractCargoPackageField(cargoToml, 'version'),
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

  const pkgLockPath = path.join(rootDir, 'package-lock.json')
  if (fs.existsSync(pkgLockPath)) {
    const pkgLock = JSON.parse(fs.readFileSync(pkgLockPath, 'utf-8'))
    const lockVersion = String(pkgLock.version || '').trim()
    const rootPkgVersion = String(pkgLock.packages?.['']?.version || lockVersion).trim()
    versions.packageLock = lockVersion
    versions.packageLockRoot = rootPkgVersion
    if (lockVersion !== versions.packageJson || rootPkgVersion !== versions.packageJson) {
      return {
        ok: false,
        versions,
        error: `버전 불일치: package-lock.json(${lockVersion}/${rootPkgVersion}) != package.json(${versions.packageJson})`
      }
    }
  }

  const cargoLockPath = path.join(rootDir, 'src-tauri/Cargo.lock')
  if (fs.existsSync(cargoLockPath)) {
    const cargoLock = fs.readFileSync(cargoLockPath, 'utf-8')
    const cargoPkgName = extractCargoPackageField(cargoToml, 'name') || 'easy-viewer'
    const cargoLockVersion = extractCargoLockPackageVersion(cargoLock, cargoPkgName)
    versions.cargoLock = cargoLockVersion
    if (!cargoLockVersion || cargoLockVersion !== versions.cargoToml) {
      return {
        ok: false,
        versions,
        error: `버전 불일치: Cargo.lock(${cargoLockVersion || '누락'}) != Cargo.toml(${versions.cargoToml})`
      }
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
