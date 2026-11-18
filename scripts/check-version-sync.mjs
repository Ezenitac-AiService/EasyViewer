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
    const cargoPkgName = extractCargoPackageField(cargoToml, 'name') || 'pagelight'
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

  const EXPECTED_APP_ID = 'com.ezenitac.easyviewer'
  const EXPECTED_APP_PATH = EXPECTED_APP_ID.replace(/\./g, '/')

  const androidConfPath = path.join(rootDir, 'src-tauri/tauri.android.conf.json')
  if (fs.existsSync(androidConfPath)) {
    const androidConf = JSON.parse(fs.readFileSync(androidConfPath, 'utf-8'))
    if (String(androidConf.identifier || '').trim() !== EXPECTED_APP_ID) {
      return {
        ok: false,
        versions,
        error: `Android 식별자 불일치: tauri.android.conf.json(${androidConf.identifier}) != ${EXPECTED_APP_ID}`
      }
    }
  }

  const gradlePath = path.join(rootDir, 'src-tauri/gen/android/app/build.gradle.kts')
  if (fs.existsSync(gradlePath)) {
    const gradle = fs.readFileSync(gradlePath, 'utf-8')
    const ns = /namespace\s*=\s*"([^"]+)"/.exec(gradle)?.[1]
    const appId = /applicationId\s*=\s*"([^"]+)"/.exec(gradle)?.[1]
    if (ns !== EXPECTED_APP_ID || appId !== EXPECTED_APP_ID) {
      return {
        ok: false,
        versions,
        error: `Android Gradle 식별자 불일치: namespace=${ns}, applicationId=${appId} != ${EXPECTED_APP_ID}`
      }
    }
  }

  // Pre-002 tree (com/easyviewer) and the upstream tree (com/edith, spec 003) must both be gone.
  const legacyAndroidDirs = [
    ['com/easyviewer', 'src-tauri/gen/android/app/src/main/java/com/easyviewer'],
    ['com/easyviewer', 'src-tauri/gen/android/buildSrc/src/main/java/com/easyviewer'],
    ['com/edith', 'src-tauri/gen/android/app/src/main/java/com/edith'],
    ['com/edith', 'src-tauri/gen/android/buildSrc/src/main/java/com/edith']
  ]
  for (const [label, relLegacy] of legacyAndroidDirs) {
    if (fs.existsSync(path.join(rootDir, relLegacy))) {
      return {
        ok: false,
        versions,
        error: `Android 이전 패키지 디렉터리 잔존 발견(${label}): ${relLegacy}`
      }
    }
  }

  const mainActivityPath = path.join(
    rootDir,
    `src-tauri/gen/android/app/src/main/java/${EXPECTED_APP_PATH}/MainActivity.kt`
  )
  if (fs.existsSync(mainActivityPath)) {
    const kt = fs.readFileSync(mainActivityPath, 'utf-8')
    const pkgDecl = /^\s*package\s+([^\s;]+)/m.exec(kt)?.[1]
    if (pkgDecl !== EXPECTED_APP_ID) {
      return {
        ok: false,
        versions,
        error: `Android MainActivity.kt 패키지 불일치: package=${pkgDecl} != ${EXPECTED_APP_ID}`
      }
    }
  }

  const buildSrcDir = path.join(
    rootDir,
    `src-tauri/gen/android/buildSrc/src/main/java/${EXPECTED_APP_PATH}/kotlin`
  )
  if (
    fs.existsSync(path.join(rootDir, 'src-tauri/gen/android/buildSrc')) &&
    !fs.existsSync(path.join(buildSrcDir, 'RustPlugin.kt'))
  ) {
    return {
      ok: false,
      versions,
      error: `Android buildSrc 패키지 경로 불일치: ${EXPECTED_APP_PATH}/kotlin/RustPlugin.kt 누락`
    }
  }

  const ymlPath = path.join(rootDir, 'src-tauri/gen/apple/project.yml')
  if (fs.existsSync(ymlPath)) {
    const yml = fs.readFileSync(ymlPath, 'utf-8')
    const prefix = /bundleIdPrefix:\s*([^\s]+)/.exec(yml)?.[1]
    const bundleId = /PRODUCT_BUNDLE_IDENTIFIER:\s*([^\s]+)/.exec(yml)?.[1]
    const shortVer = /CFBundleShortVersionString:\s*"?([^"\s]+)"?/.exec(yml)?.[1]
    const cfVer = /CFBundleVersion:\s*"?([^"\s]+)"?/.exec(yml)?.[1]
    if (prefix !== EXPECTED_APP_ID || bundleId !== EXPECTED_APP_ID) {
      return {
        ok: false,
        versions,
        error: `Apple project.yml 식별자 불일치: bundleIdPrefix=${prefix}, PRODUCT_BUNDLE_IDENTIFIER=${bundleId}`
      }
    }
    if (shortVer !== versions.packageJson || cfVer !== versions.packageJson) {
      return {
        ok: false,
        versions,
        error: `Apple project.yml 버전 불일치: ${shortVer}/${cfVer} != ${versions.packageJson}`
      }
    }
  }

  const plistPath = path.join(rootDir, 'src-tauri/gen/apple/pagelight_iOS/Info.plist')
  if (fs.existsSync(plistPath)) {
    const plist = fs.readFileSync(plistPath, 'utf-8')
    const shortVer = /<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/.exec(plist)?.[1]
    const cfVer = /<key>CFBundleVersion<\/key>\s*<string>([^<]+)<\/string>/.exec(plist)?.[1]
    if (shortVer !== versions.packageJson || cfVer !== versions.packageJson) {
      return {
        ok: false,
        versions,
        error: `iOS Info.plist 버전 불일치: ${shortVer}/${cfVer} != ${versions.packageJson}`
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
