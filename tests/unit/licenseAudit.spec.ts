// SPDX-License-Identifier: GPL-3.0-only
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  auditNpmRuntime,
  authorName,
  buildAbout,
  checkProjectLicense,
  checkThirdPartyTable,
  collectNpmRuntime,
  evaluateSpdx,
  renderNpmNotices
} from '../../scripts/check-licenses.mjs'

const POLICY = {
  allow: ['MIT', 'Apache-2.0', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause', 'CC0-1.0', 'Zlib'],
  preference: ['MIT', 'Apache-2.0', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause', 'Zlib', 'CC0-1.0'],
  choices: { jszip: 'MIT' },
  projectLicense: 'GPL-3.0-only',
  licenseSha256: ''
}

const tempDirs: string[] = []
function tmp(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
  tempDirs.push(dir)
  return dir
}

afterEach(() => {
  while (tempDirs.length) fs.rmSync(tempDirs.pop() as string, { recursive: true, force: true })
})

function lockOf(packages: Record<string, Record<string, unknown>>) {
  return { lockfileVersion: 3, packages: { '': { name: 'app', version: '1.0.0' }, ...packages } }
}

describe('SPDX expression evaluation (FR-005)', () => {
  it('requires every term of AND to be allowed', () => {
    expect(evaluateSpdx('(MIT AND Zlib)', POLICY).ok).toBe(true)
    expect(evaluateSpdx('MIT AND GPL-2.0-only', POLICY).ok).toBe(false)
  })

  it('accepts OR when one term is allowed and records the preferred choice', () => {
    const r = evaluateSpdx('Apache-2.0 OR MIT', POLICY)
    expect(r.ok).toBe(true)
    expect(r.chosen).toBe('MIT')
  })

  it('honours an explicit per-package choice', () => {
    const r = evaluateSpdx('(MIT OR GPL-3.0-or-later)', POLICY, 'jszip')
    expect(r).toEqual({ ok: true, chosen: 'MIT' })
  })

  it('handles nested parentheses', () => {
    expect(evaluateSpdx('((MIT OR Apache-2.0) AND (Zlib))', POLICY).ok).toBe(true)
    expect(evaluateSpdx('((LGPL-2.1-or-later OR SSPL-1.0) AND MIT)', POLICY).ok).toBe(false)
  })

  it('rejects empty or unknown expressions', () => {
    expect(evaluateSpdx('', POLICY).ok).toBe(false)
    expect(evaluateSpdx('UNLICENSED', POLICY).ok).toBe(false)
  })
})

describe('npm runtime audit', () => {
  it('ignores dev and devOptional packages and fails on missing or disallowed licenses', () => {
    const lock = lockOf({
      'node_modules/a': { version: '1.0.0', license: 'MIT' },
      'node_modules/b': { version: '1.0.0' },
      'node_modules/c': { version: '1.0.0', license: 'SSPL-1.0' },
      'node_modules/d': { version: '1.0.0', license: 'SSPL-1.0', dev: true },
      'node_modules/e': { version: '1.0.0', devOptional: true }
    })
    const runtime = collectNpmRuntime(lock)
    expect(runtime.map((p: { name: string }) => p.name)).toEqual(['a', 'b', 'c'])
    const violations = auditNpmRuntime(runtime, POLICY)
    expect(violations.map((v: { name: string }) => v.name).sort()).toEqual(['b', 'c'])
  })

  it('requires a recorded choice for dual licenses that include a copyleft term', () => {
    const lock = lockOf({ 'node_modules/jszip': { version: '3.10.2', license: '(MIT OR GPL-3.0-or-later)' } })
    expect(auditNpmRuntime(collectNpmRuntime(lock), POLICY)).toEqual([])
    expect(
      auditNpmRuntime(collectNpmRuntime(lock), { ...POLICY, choices: {} })
    ).toHaveLength(1)
  })

  it('resolves nested package names from lockfile paths', () => {
    const lock = lockOf({
      'node_modules/@scope/x': { version: '1.0.0', license: 'MIT' },
      'node_modules/a/node_modules/b': { version: '2.0.0', license: 'ISC' }
    })
    expect(collectNpmRuntime(lock).map((p: { name: string }) => p.name)).toEqual(['@scope/x', 'b'])
  })
})

describe('project license declaration (FR-001, FR-003)', () => {
  function fixture(opts: { pkg?: string; cargo?: string; bundle?: string; licenseText?: string } = {}) {
    const root = tmp('ev-license-')
    fs.mkdirSync(path.join(root, 'src-tauri'))
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ license: opts.pkg ?? 'GPL-3.0-only' }))
    fs.writeFileSync(
      path.join(root, 'src-tauri/Cargo.toml'),
      `[package]\nname = "x"\nlicense = "${opts.cargo ?? 'GPL-3.0-only'}"\n`
    )
    fs.writeFileSync(
      path.join(root, 'src-tauri/tauri.conf.json'),
      JSON.stringify({ bundle: { license: opts.bundle ?? 'GPL-3.0-only' } })
    )
    const text = opts.licenseText ?? 'GNU GENERAL PUBLIC LICENSE\n'
    fs.writeFileSync(path.join(root, 'LICENSE'), text)
    return { root, sha: crypto.createHash('sha256').update('GNU GENERAL PUBLIC LICENSE\n').digest('hex') }
  }

  it('passes when every manifest declares GPL-3.0-only and LICENSE is unchanged', () => {
    const { root, sha } = fixture()
    expect(checkProjectLicense(root, { ...POLICY, licenseSha256: sha })).toEqual([])
  })

  it('reports each manifest that differs', () => {
    const { root, sha } = fixture({ pkg: 'GPL-3.0', cargo: 'MIT', bundle: '' })
    const errors = checkProjectLicense(root, { ...POLICY, licenseSha256: sha })
    expect(errors).toHaveLength(3)
  })

  it('fails when the LICENSE text has been modified', () => {
    const { root, sha } = fixture({ licenseText: 'GNU GENERAL PUBLIC LICENSE (edited)\n' })
    expect(checkProjectLicense(root, { ...POLICY, licenseSha256: sha }).join('\n')).toMatch(/LICENSE/)
  })
})

describe('About data and third-party notices', () => {
  function project() {
    const root = tmp('ev-about-')
    fs.mkdirSync(path.join(root, 'src-tauri'))
    fs.writeFileSync(
      path.join(root, 'package.json'),
      JSON.stringify({ name: 'app', version: '1.2.3', license: 'GPL-3.0-only', dependencies: { a: '^1', jszip: '^3' } })
    )
    fs.writeFileSync(
      path.join(root, 'src-tauri/tauri.conf.json'),
      JSON.stringify({ productName: 'Fork Viewer', version: '1.2.3' })
    )
    const lock = lockOf({
      'node_modules/a': { version: '1.0.4', license: 'Apache-2.0 OR MIT' },
      'node_modules/jszip': { version: '3.10.2', license: '(MIT OR GPL-3.0-or-later)' },
      'node_modules/t': { version: '0.1.0', license: 'ISC' }
    })
    fs.writeFileSync(path.join(root, 'package-lock.json'), JSON.stringify(lock))
    for (const [name, file, text] of [
      ['a', 'LICENSE_MIT', 'MIT License\nCopyright (c) A'],
      ['jszip', 'LICENSE.markdown', 'MIT License\nCopyright (c) JSZip'],
      ['t', 'LICENSE', 'ISC License\nCopyright (c) T']
    ]) {
      fs.mkdirSync(path.join(root, 'node_modules', name), { recursive: true })
      fs.writeFileSync(path.join(root, 'node_modules', name, file), text)
    }
    return { root, lock }
  }

  it('builds deterministic About data listing direct dependencies with chosen licenses', () => {
    const { root } = project()
    const about = buildAbout(root, POLICY, { separatedAt: '2026-11-17' })
    expect(about).toEqual({
      name: 'Fork Viewer',
      version: '1.2.3',
      license: 'GPL-3.0-only',
      repository: 'https://github.com/Ezenitac-AiService/EasyViewer',
      upstream: 'https://github.com/edith2580/EasyViewer',
      separatedAt: '2026-11-17',
      thirdParty: [
        { name: 'a', version: '1.0.4', license: 'MIT' },
        { name: 'jszip', version: '3.10.2', license: 'MIT' }
      ]
    })
    expect(buildAbout(root, POLICY, { separatedAt: '2026-11-17' })).toEqual(about)
  })

  it('renders notices for every runtime package including transitive ones, sorted', () => {
    const { root, lock } = project()
    const text = renderNpmNotices(root, collectNpmRuntime(lock))
    expect(text.indexOf('a@1.0.4')).toBeLessThan(text.indexOf('jszip@3.10.2'))
    expect(text.indexOf('jszip@3.10.2')).toBeLessThan(text.indexOf('t@0.1.0'))
    expect(text).toContain('Copyright (c) T')
  })

  it('fails notice rendering when a runtime package ships no license file', () => {
    const { root, lock } = project()
    fs.rmSync(path.join(root, 'node_modules/t/LICENSE'))
    expect(() => renderNpmNotices(root, collectNpmRuntime(lock))).toThrow(/t@0.1.0/)
  })

  it('generates the standard MIT notice from package.json when an MIT package ships no license file', () => {
    const { root, lock } = project()
    fs.rmSync(path.join(root, 'node_modules/a/LICENSE_MIT'))
    fs.writeFileSync(
      path.join(root, 'node_modules/a/package.json'),
      JSON.stringify({ author: { name: 'Jane Doe', email: 'jane@example.com' } })
    )
    const patched = JSON.parse(JSON.stringify(lock))
    patched.packages['node_modules/a'].license = 'MIT'
    const text = renderNpmNotices(root, collectNpmRuntime(patched))
    expect(text).toContain('Copyright (c) Jane Doe')
    expect(text).toContain('Permission is hereby granted')
    expect(text).not.toContain('jane@example.com')
  })

  it('never emits an e-mail address as the copyright holder', () => {
    expect(authorName('someone@example.com', 'pkg')).toBe('pkg contributors')
    expect(authorName('Julian Gruber <mail@x.com> (http://x.com)', 'pkg')).toBe('Julian Gruber')
    expect(authorName(undefined, 'pkg')).toBe('pkg contributors')
  })

  it('accepts a missing license file only for packages listed with a reason', () => {
    const { root, lock } = project()
    fs.rmSync(path.join(root, 'node_modules/t/LICENSE'))
    const text = renderNpmNotices(root, collectNpmRuntime(lock), { t: '타입 정의 전용' })
    expect(text).toContain('=== t@0.1.0 (ISC) ===\n패키지에 라이선스 파일이 없음: 타입 정의 전용')
  })

  it('checks that THIRD_PARTY_LICENSES.md lists exactly the direct dependencies', () => {
    const md = '| `a` | x | y | `MIT` |\n| `jszip` | x | y | `MIT` |\n'
    expect(checkThirdPartyTable(md, ['a', 'jszip'])).toEqual([])
    expect(checkThirdPartyTable(md, ['a', 'jszip', 'vue'])).toEqual(['THIRD_PARTY_LICENSES.md에 없는 직접 의존성: vue'])
  })
})
