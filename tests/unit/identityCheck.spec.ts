// SPDX-License-Identifier: GPL-3.0-only
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { checkAndroidReleaseSigning, checkIdentity, NEW_IDENTITY, STORAGE_KEYS } from '../../scripts/check-identity.mjs'

/**
 * spec 003 US5 / data-model §4: the fork's own identity (Pagelight, com.ezenitac.easyviewer)
 * must replace the upstream identity everywhere except the documented allow-list, while the
 * internal storage keys stay exactly as they are (US6 data continuity).
 */

const tempDirs: string[] = []
afterEach(() => {
  while (tempDirs.length) fs.rmSync(tempDirs.pop() as string, { recursive: true, force: true })
})

const SCOPE = [
  '<!-- support-scope:start -->',
  '**Windows는 이 포크의 지원·배포 대상이 아닙니다. Windows에서는 원저작자의 [EasyViewer](https://github.com/edith2580/EasyViewer)를 사용하세요.**',
  '<!-- support-scope:end -->'
].join('\n')

function baseFiles(): Record<string, string> {
  return {
    'package.json': JSON.stringify({ name: 'pagelight', scripts: { 'ios:install': 'node scripts/ios-install.mjs' } }),
    'index.html': '<title>Pagelight</title>',
    'README.md': `# Pagelight\n\n${SCOPE}\n\n[edith2580의 EasyViewer](https://github.com/edith2580/EasyViewer)에서 갈라진 독립 포크\n`,
    'src-tauri/Cargo.toml': '[package]\nname = "pagelight"\n\n[lib]\nname = "pagelight_lib"\n',
    'src-tauri/tauri.conf.json': JSON.stringify({
      productName: 'Pagelight',
      identifier: 'com.ezenitac.easyviewer',
      app: { windows: [{ title: 'Pagelight' }] },
      bundle: { iOS: { minimumSystemVersion: '15.0' } }
    }),
    'src-tauri/tauri.android.conf.json': JSON.stringify({ identifier: 'com.ezenitac.easyviewer' }),
    'src-tauri/gen/apple/project.yml': 'settingGroups:\n  app:\n    base:\n      PRODUCT_NAME: Pagelight\n',
    'src-tauri/gen/android/app/src/main/res/values/strings.xml':
      '<resources>\n    <string name="app_name">"Pagelight"</string>\n</resources>\n',
    'src/services/storage/idbClient.ts': "export const IDB_NAME = 'EasyViewerDB'\n",
    'src/services/storage/platformAdapter.ts': 'localStorage.getItem(`easyviewer:${key}`)\n',
    'src/services/platform/credentialService.ts':
      "const WEB_CREDENTIAL_STORAGE_KEY = 'webdav_credentials_web_consent_v2'\nconst k = `easyviewer:webdav:${id}`\n",
    'src/config/supportScope.ts': "export const upstream = '원저작자의 EasyViewer'\n",
    'src-tauri/src/commands/epub_meta.rs': '// fixture author: EasyViewer Team\n',
    'docs/windows-migration.md': '원저작자 앱 EasyViewer로 옮기는 방법\n'
  }
}

function repo(overrides: Record<string, string | null> = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ev-identity-'))
  tempDirs.push(root)
  const files: Record<string, string | null> = { ...baseFiles(), ...overrides }
  for (const [rel, content] of Object.entries(files)) {
    if (content === null) continue
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true })
    fs.writeFileSync(path.join(root, rel), content)
  }
  return root
}

const run = (root: string, opts = {}) => checkIdentity(root, { legacyIconHashes: {}, ...opts })

describe('check-identity (spec 003 US5, data-model §4)', () => {
  it('exposes the decided T050 identity', () => {
    expect(NEW_IDENTITY).toMatchObject({
      appId: 'com.ezenitac.easyviewer',
      productName: 'Pagelight',
      packageName: 'pagelight',
      libName: 'pagelight_lib'
    })
  })

  it('passes a repository that uses only the new identity and allow-listed upstream references', () => {
    const res = run(repo())
    expect(res.errors).toEqual([])
    expect(res.ok).toBe(true)
  })

  it('passes the real repository', () => {
    const res = checkIdentity(process.cwd())
    expect(res.errors).toEqual([])
  })

  it.each([
    ['src/services/foo.ts', "const id = 'com.edith.easyviewer'\n", /com\.edith\.easyviewer/],
    ['index.html', '<title>EasyViewer</title>', /EasyViewer/],
    ['scripts/build.mjs', "const app = 'easy-viewer'\n", /easy-viewer/],
    ['src-tauri/src/main.rs', 'fn main() { easy_viewer_lib::run() }\n', /easy_viewer/],
    ['src-tauri/gen/android/app/build.gradle.kts', 'val p = "src/main/java/com/edith/x"\n', /com\/edith/],
    ['.github/workflows/release.yml', 'run: gh release create "$TAG" --title "EasyViewer $TAG"\n', /EasyViewer/],
    ['.github/workflows/ci.yml', 'run: cp target/release/easy-viewer.exe out/\n', /easy-viewer/],
    ['README.en.md', '# EasyViewer\n', /EasyViewer/],
    ['CONTRIBUTING.en.md', 'Welcome to EasyViewer.\n', /EasyViewer/],
    ['SECURITY.en.md', 'Report EasyViewer bugs here.\n', /EasyViewer/]
  ])('fails when %s carries the upstream identity outside the allow-list', (rel, content, re) => {
    const res = run(repo({ [rel]: content }))
    expect(res.ok).toBe(false)
    expect(res.errors.join('\n')).toMatch(re)
    expect(res.errors.join('\n')).toContain(rel)
  })

  it('allows the upstream name inside support-scope blocks and attribution phrases but not as the fork app name', () => {
    expect(run(repo()).ok).toBe(true)
    const res = run(repo({ 'README.md': `# EasyViewer\n\n${SCOPE}\n` }))
    expect(res.ok).toBe(false)
    expect(res.errors.join('\n')).toMatch(/README\.md/)
  })

  it('allows upstream identity only inside the README comparison block (T038)', () => {
    const table = '| 표시 이름 | Pagelight | EasyViewer |\n| 앱 식별자 | `com.ezenitac.easyviewer` | `com.edith.easyviewer` |\n'
    const inside = `# Pagelight\n\n${SCOPE}\n\n<!-- upstream-diff:start -->\n${table}<!-- upstream-diff:end -->\n`
    expect(run(repo({ 'README.md': inside })).ok).toBe(true)
    const outside = run(repo({ 'README.md': `# Pagelight\n\n${SCOPE}\n\n${table}` }))
    expect(outside.ok).toBe(false)
    expect(outside.errors.join('\n')).toMatch(/com\.edith\.easyviewer/)
  })

  it('accepts allow-listed files wholesale (support-scope source, Windows docs, EPUB fixture)', () => {
    const res = run(
      repo({
        'src/config/supportScope.ts': "export const name = 'EasyViewer'\n",
        'docs/windows-migration.md': '# EasyViewer\ncom.edith.easyviewer\n',
        'src-tauri/src/commands/epub_meta.rs': '<dc:creator>EasyViewer Team</dc:creator>\n'
      })
    )
    expect(res.errors).toEqual([])
  })

  it('keeps the internal storage keys and fails if one of them is renamed', () => {
    expect(STORAGE_KEYS.map((k: { literal: string }) => k.literal)).toEqual([
      'EasyViewerDB',
      'easyviewer:',
      'easyviewer:webdav:',
      'webdav_credentials_web_consent_v2'
    ])
    const renamed = run(repo({ 'src/services/storage/idbClient.ts': "export const IDB_NAME = 'PagelightDB'\n" }))
    expect(renamed.ok).toBe(false)
    expect(renamed.errors.join('\n')).toMatch(/EasyViewerDB/)

    const prefix = run(repo({ 'src/services/storage/platformAdapter.ts': 'localStorage.getItem(`pagelight:${key}`)\n' }))
    expect(prefix.ok).toBe(false)
    expect(prefix.errors.join('\n')).toMatch(/easyviewer:/)
  })

  it('fails when an Apple development team is pinned in the repository', () => {
    const conf = JSON.parse(baseFiles()['src-tauri/tauri.conf.json'])
    conf.bundle.iOS.developmentTeam = 'ABCDE12345'
    const a = run(repo({ 'src-tauri/tauri.conf.json': JSON.stringify(conf) }))
    expect(a.ok).toBe(false)
    expect(a.errors.join('\n')).toMatch(/developmentTeam/)

    const b = run(
      repo({ 'src-tauri/gen/apple/project.yml': 'settings:\n  base:\n    PRODUCT_NAME: Pagelight\n    DEVELOPMENT_TEAM: ABCDE12345\n' })
    )
    expect(b.ok).toBe(false)
    expect(b.errors.join('\n')).toMatch(/DEVELOPMENT_TEAM/)
  })

  it('fails when a package.json script embeds an iOS device UDID', () => {
    const res = run(
      repo({
        'package.json': JSON.stringify({
          name: 'pagelight',
          scripts: { 'ios:install': 'xcrun devicectl device install app --device 00008120-001A44101E38C01E x.app' }
        })
      })
    )
    expect(res.ok).toBe(false)
    expect(res.errors.join('\n')).toMatch(/UDID/)
  })

  it.each([
    ['productName', { 'src-tauri/tauri.conf.json': JSON.stringify({ productName: 'Other', identifier: 'com.ezenitac.easyviewer', app: { windows: [{ title: 'Pagelight' }] } }) }],
    ['window title', { 'src-tauri/tauri.conf.json': JSON.stringify({ productName: 'Pagelight', identifier: 'com.ezenitac.easyviewer', app: { windows: [{ title: 'Other' }] } }) }],
    ['identifier', { 'src-tauri/tauri.conf.json': JSON.stringify({ productName: 'Pagelight', identifier: 'com.example.other', app: { windows: [{ title: 'Pagelight' }] } }) }],
    ['Cargo package name', { 'src-tauri/Cargo.toml': '[package]\nname = "other"\n\n[lib]\nname = "pagelight_lib"\n' }],
    ['Cargo lib name', { 'src-tauri/Cargo.toml': '[package]\nname = "pagelight"\n\n[lib]\nname = "other_lib"\n' }],
    ['npm name', { 'package.json': JSON.stringify({ name: 'other' }) }],
    ['PRODUCT_NAME', { 'src-tauri/gen/apple/project.yml': 'PRODUCT_NAME: Other\n' }],
    ['app_name', { 'src-tauri/gen/android/app/src/main/res/values/strings.xml': '<string name="app_name">"Other"</string>' }]
  ])('fails when %s differs from the decided identity', (_label, overrides) => {
    const res = run(repo(overrides))
    expect(res.ok).toBe(false)
  })

  it('fails when an app icon is byte-identical to the upstream icon', () => {
    const root = repo({ 'src-tauri/icons/icon.png': 'upstream-icon-bytes' })
    const hash = 'a'.repeat(64)
    const ok = run(root, { legacyIconHashes: { 'src-tauri/icons/icon.png': hash } })
    expect(ok.errors).toEqual([])

    const same = crypto.createHash('sha256').update('upstream-icon-bytes').digest('hex')
    const bad = run(root, { legacyIconHashes: { 'src-tauri/icons/icon.png': same } })
    expect(bad.ok).toBe(false)
    expect(bad.errors.join('\n')).toMatch(/icon\.png/)
  })
})

describe('Android release signing contract (spec 003 FR-017, T057)', () => {
  const GOOD = [
    'android {',
    '    signingConfigs {',
    '        create("release") {',
    '            val keystorePath = System.getenv("ANDROID_KEYSTORE_PATH")',
    '            storePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD")',
    '            keyAlias = System.getenv("ANDROID_KEY_ALIAS")',
    '            keyPassword = System.getenv("ANDROID_KEY_PASSWORD")',
    '        }',
    '    }',
    '    buildTypes {',
    '        getByName("release") {',
    '            signingConfig = signingConfigs.getByName("release")',
    '        }',
    '    }',
    '}',
    'gradle.taskGraph.whenReady { throw GradleException("missing") }'
  ].join('\n')

  it('accepts a release build that signs only with the environment-provided fork key', () => {
    expect(checkAndroidReleaseSigning(GOOD)).toEqual([])
  })

  it('passes the real build.gradle.kts', () => {
    const text = fs.readFileSync(path.resolve('src-tauri/gen/android/app/build.gradle.kts'), 'utf-8')
    expect(checkAndroidReleaseSigning(text)).toEqual([])
  })

  it('fails when the release build falls back to the debug key', () => {
    const bad = GOOD.replace('signingConfigs.getByName("release")', 'signingConfigs.getByName("debug")')
    expect(checkAndroidReleaseSigning(bad).join('\n')).toMatch(/debug/)
  })

  it.each(['ANDROID_KEYSTORE_PATH', 'ANDROID_KEYSTORE_PASSWORD', 'ANDROID_KEY_ALIAS', 'ANDROID_KEY_PASSWORD'])(
    'fails when %s is not read from the environment',
    (name) => {
      const bad = GOOD.split('\n').filter((l) => !l.includes(name)).join('\n')
      expect(checkAndroidReleaseSigning(bad).join('\n')).toContain(name)
    }
  )

  it('fails when a missing signing environment does not stop the build', () => {
    expect(checkAndroidReleaseSigning(GOOD.replace('GradleException', 'println')).join('\n')).toMatch(/GradleException/)
  })

  it('fails when a keystore password is hardcoded', () => {
    const bad = GOOD.replace('storePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD")', 'storePassword = "hunter2"')
    expect(checkAndroidReleaseSigning(bad).join('\n')).toMatch(/storePassword/)
  })
})
