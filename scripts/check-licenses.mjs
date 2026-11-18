// SPDX-License-Identifier: GPL-3.0-only
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

/**
 * Third-party license audit and notice generation (spec 003 FR-001, FR-003, FR-005).
 *
 * Modes:
 *   (default)       policy audit + manifest check + About data + full notices must match disk
 *   --no-notices    policy audit + manifest check + About data only (no cargo-about needed)
 *   --write         regenerate src/generated/about.json and src/generated/third-party-notices.txt
 * Exit codes: 0 ok, 1 violation, 2 BLOCKED (cargo-about missing for notice generation).
 */

export const FORK_REPO_URL = 'https://github.com/Ezenitac-AiService/EasyViewer'
export const UPSTREAM_REPO_URL = 'https://github.com/edith2580/EasyViewer'
export const ABOUT_PATH = 'src/generated/about.json'
export const NOTICES_PATH = 'src/generated/third-party-notices.txt'
export const SEPARATED_AT = '2026-11-17'

// ---------------------------------------------------------------------------
// SPDX expression evaluation
// ---------------------------------------------------------------------------

function tokenize(expr) {
  return String(expr || '')
    .replace(/\(/g, ' ( ')
    .replace(/\)/g, ' ) ')
    .split(/\s+/)
    .filter(Boolean)
}

function parseExpression(tokens) {
  let pos = 0
  function parsePrimary() {
    const tok = tokens[pos++]
    if (tok === '(') {
      const node = parseOr()
      if (tokens[pos++] !== ')') throw new Error('unbalanced parentheses')
      return node
    }
    if (!tok || tok === ')' || /^(AND|OR|WITH)$/i.test(tok)) throw new Error(`unexpected token ${tok}`)
    let id = tok
    if (tokens[pos] && /^WITH$/i.test(tokens[pos])) {
      id = `${id} WITH ${tokens[pos + 1]}`
      pos += 2
    }
    return { type: 'id', id }
  }
  function parseAnd() {
    let left = parsePrimary()
    while (tokens[pos] && /^AND$/i.test(tokens[pos])) {
      pos++
      left = { type: 'and', left, right: parsePrimary() }
    }
    return left
  }
  function parseOr() {
    let left = parseAnd()
    while (tokens[pos] && /^OR$/i.test(tokens[pos])) {
      pos++
      left = { type: 'or', left, right: parseAnd() }
    }
    return left
  }
  const node = parseOr()
  if (pos !== tokens.length) throw new Error('trailing tokens')
  return node
}

function evalNode(node, allow, preference) {
  if (node.type === 'id') {
    return allow.has(node.id) ? { ok: true, chosen: node.id } : { ok: false }
  }
  const l = evalNode(node.left, allow, preference)
  const r = evalNode(node.right, allow, preference)
  if (node.type === 'and') {
    return l.ok && r.ok ? { ok: true, chosen: `${l.chosen} AND ${r.chosen}` } : { ok: false }
  }
  const options = [l, r].filter((x) => x.ok)
  if (options.length === 0) return { ok: false }
  options.sort((a, b) => rank(a.chosen, preference) - rank(b.chosen, preference))
  return options[0]
}

function rank(id, preference) {
  const i = preference.indexOf(id)
  return i < 0 ? preference.length : i
}

function leafIds(node, out = []) {
  if (node.type === 'id') out.push(node.id)
  else {
    leafIds(node.left, out)
    leafIds(node.right, out)
  }
  return out
}

/** Evaluates an SPDX expression against the policy. Returns { ok, chosen }. */
export function evaluateSpdx(expr, policy, packageName) {
  let tree
  try {
    tree = parseExpression(tokenize(expr))
  } catch {
    return { ok: false }
  }
  const allow = new Set(policy.allow)
  const explicit = packageName ? policy.choices?.[packageName] : undefined
  if (explicit) {
    const ok = leafIds(tree).includes(explicit) && allow.has(explicit)
    return ok ? { ok: true, chosen: explicit } : { ok: false }
  }
  const ids = leafIds(tree)
  const hasCopyleftAlternative = tree.type === 'or' && ids.some((id) => !allow.has(id))
  const res = evalNode(tree, allow, policy.preference || policy.allow)
  // A dual license with a non-allowed term must have an explicit recorded choice.
  if (res.ok && hasCopyleftAlternative && !explicit) {
    return { ok: false, reason: 'choice-required' }
  }
  return res
}

// ---------------------------------------------------------------------------
// npm runtime packages
// ---------------------------------------------------------------------------

export function collectNpmRuntime(lock) {
  const out = []
  for (const [key, meta] of Object.entries(lock.packages || {})) {
    if (!key || meta.dev || meta.devOptional || meta.link) continue
    const idx = key.lastIndexOf('node_modules/')
    const name = key.slice(idx + 'node_modules/'.length)
    out.push({ name, version: meta.version || '', license: meta.license || '', path: key })
  }
  return out.sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version))
}

export function auditNpmRuntime(runtime, policy) {
  const violations = []
  for (const p of runtime) {
    if (!p.license) {
      violations.push({ name: p.name, version: p.version, reason: 'license 필드 없음' })
      continue
    }
    const res = evaluateSpdx(p.license, policy, p.name)
    if (!res.ok) {
      const reason = res.reason === 'choice-required' ? '복수 라이선스 선택 기록 필요' : '허용 목록 밖'
      violations.push({ name: p.name, version: p.version, license: p.license, reason })
    }
  }
  return violations
}

// ---------------------------------------------------------------------------
// Project license declaration
// ---------------------------------------------------------------------------

export function checkProjectLicense(root, policy) {
  const errors = []
  const want = policy.projectLicense
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'))
  if (pkg.license !== want) errors.push(`package.json license=${pkg.license ?? '(없음)'} != ${want}`)
  const cargo = fs.readFileSync(path.join(root, 'src-tauri/Cargo.toml'), 'utf-8')
  const pkgSection = /\[package\]([\s\S]*?)(?:\r?\n\[|$)/.exec(cargo)?.[1] ?? ''
  const cargoLicense = /^\s*license\s*=\s*"([^"]+)"/m.exec(pkgSection)?.[1]
  if (cargoLicense !== want) errors.push(`Cargo.toml license=${cargoLicense ?? '(없음)'} != ${want}`)
  const conf = JSON.parse(fs.readFileSync(path.join(root, 'src-tauri/tauri.conf.json'), 'utf-8'))
  if (conf.bundle?.license !== want) {
    errors.push(`tauri.conf.json bundle.license=${conf.bundle?.license || '(없음)'} != ${want}`)
  }
  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'LICENSE'))).digest('hex')
  if (policy.licenseSha256 && sha !== policy.licenseSha256) {
    errors.push(`LICENSE 전문이 바뀌었습니다(sha256 ${sha})`)
  }
  return errors
}

// ---------------------------------------------------------------------------
// About data, THIRD_PARTY_LICENSES.md, notices
// ---------------------------------------------------------------------------

export function buildAbout(root, policy, { separatedAt = SEPARATED_AT } = {}) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'))
  const conf = JSON.parse(fs.readFileSync(path.join(root, 'src-tauri/tauri.conf.json'), 'utf-8'))
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf-8'))
  const thirdParty = Object.keys(pkg.dependencies || {})
    .sort()
    .map((name) => {
      const meta = lock.packages?.[`node_modules/${name}`] || {}
      const res = evaluateSpdx(meta.license || '', policy, name)
      return { name, version: meta.version || '', license: res.ok ? res.chosen : meta.license || '' }
    })
  return {
    name: conf.productName,
    version: pkg.version,
    license: policy.projectLicense,
    repository: FORK_REPO_URL,
    upstream: UPSTREAM_REPO_URL,
    separatedAt,
    thirdParty
  }
}

export function checkThirdPartyTable(markdown, directNames) {
  const listed = new Set([...markdown.matchAll(/^\|\s*`([^`]+)`/gm)].map((m) => m[1]))
  return directNames
    .filter((n) => !listed.has(n))
    .map((n) => `THIRD_PARTY_LICENSES.md에 없는 직접 의존성: ${n}`)
}

function cargoDirectDeps(root) {
  const cargo = fs.readFileSync(path.join(root, 'src-tauri/Cargo.toml'), 'utf-8')
  const section = /\[dependencies\]([\s\S]*?)(?:\r?\n\[|$)/.exec(cargo)?.[1] ?? ''
  return [...section.matchAll(/^\s*([A-Za-z0-9_-]+)\s*=/gm)].map((m) => m[1])
}

const LICENSE_FILE_RE = /^(LICEN[CS]E|COPYING|NOTICE)([._-].*)?$/i

const MIT_TEXT = `Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`

/** Author display name from package.json without e-mail or URL (never emits personal e-mail). */
export function authorName(author, fallback) {
  const raw = typeof author === 'string' ? author : author?.name || ''
  const name = raw.replace(/<[^>]*>/g, '').replace(/\([^)]*\)/g, '').trim()
  return name && !name.includes('@') ? name : `${fallback} contributors`
}

export function renderNpmNotices(root, runtime, noLicenseFile = {}) {
  const parts = []
  for (const p of runtime) {
    const dir = path.join(root, p.path)
    const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => LICENSE_FILE_RE.test(f)).sort() : []
    if (files.length === 0) {
      const reason = noLicenseFile[p.name]
      if (reason) {
        parts.push(`=== ${p.name}@${p.version} (${p.license}) ===\n패키지에 라이선스 파일이 없음: ${reason}\n`)
        continue
      }
      if (p.license === 'MIT') {
        const pkgJsonPath = path.join(dir, 'package.json')
        const pj = fs.existsSync(pkgJsonPath) ? JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8')) : {}
        const holder = authorName(pj.author, p.name)
        parts.push(
          `=== ${p.name}@${p.version} (MIT) ===\n(패키지에 라이선스 파일이 없어 package.json 선언을 근거로 표준 MIT 문구를 생성함)\nCopyright (c) ${holder}\n\n${MIT_TEXT}\n`
        )
        continue
      }
      throw new Error(`라이선스 파일이 없는 런타임 패키지: ${p.name}@${p.version}`)
    }
    const body = files.map((f) => fs.readFileSync(path.join(dir, f), 'utf-8').trim()).join('\n\n')
    parts.push(`=== ${p.name}@${p.version} (${p.license}) ===\n${body}\n`)
  }
  return parts.join('\n')
}

function renderRustNotices(root) {
  const res = spawnSync('cargo', ['about', 'generate', '--fail', 'about.hbs'], {
    cwd: path.join(root, 'src-tauri'),
    encoding: 'utf-8',
    maxBuffer: 64 * 1024 * 1024
  })
  if (res.error || res.status !== 0) {
    return { blocked: true, detail: (res.stderr || res.error?.message || '').split('\n').slice(-5).join('\n') }
  }
  return { blocked: false, text: res.stdout.trim() }
}

export function renderNotices(root, policy) {
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf-8'))
  const rust = renderRustNotices(root)
  if (rust.blocked) return rust
  const header = [
    '서드파티 구성요소 고지 (Third-Party Notices)',
    `프로젝트 라이선스: ${policy.projectLicense}`,
    '이 파일은 scripts/check-licenses.mjs --write 로 생성됩니다. 직접 수정하지 마세요.',
    ''
  ].join('\n')
  const npm = renderNpmNotices(root, collectNpmRuntime(lock), policy.noLicenseFile || {})
  return {
    blocked: false,
    text: `${header}\n##### 프론트엔드(npm) 런타임 구성요소 #####\n\n${npm}\n##### 네이티브(Rust) 구성요소 #####\n\n${rust.text}\n`
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

export function runAudit(root, { write = false, notices = true } = {}) {
  const policy = JSON.parse(fs.readFileSync(path.join(root, 'scripts/license-policy.json'), 'utf-8'))
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf-8'))
  const errors = []

  for (const v of auditNpmRuntime(collectNpmRuntime(lock), policy)) {
    errors.push(`npm ${v.name}@${v.version}: ${v.reason}${v.license ? ` (${v.license})` : ''}`)
  }
  errors.push(...checkProjectLicense(root, policy))

  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'))
  const tableMd = fs.existsSync(path.join(root, 'THIRD_PARTY_LICENSES.md'))
    ? fs.readFileSync(path.join(root, 'THIRD_PARTY_LICENSES.md'), 'utf-8')
    : ''
  errors.push(...checkThirdPartyTable(tableMd, [...Object.keys(pkg.dependencies || {}), ...cargoDirectDeps(root)]))

  const about = `${JSON.stringify(buildAbout(root, policy), null, 2)}\n`
  const aboutPath = path.join(root, ABOUT_PATH)
  if (write) {
    fs.mkdirSync(path.dirname(aboutPath), { recursive: true })
    fs.writeFileSync(aboutPath, about)
  } else if (!fs.existsSync(aboutPath) || fs.readFileSync(aboutPath, 'utf-8') !== about) {
    errors.push(`${ABOUT_PATH}가 최신이 아닙니다. node scripts/check-licenses.mjs --write 를 실행하세요`)
  }

  let blocked = null
  if (notices || write) {
    let rendered
    try {
      rendered = renderNotices(root, policy)
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err))
      return { errors, blocked }
    }
    if (rendered.blocked) {
      blocked = `cargo-about 실행 불가: ${rendered.detail}`
    } else {
      const noticesPath = path.join(root, NOTICES_PATH)
      if (write) fs.writeFileSync(noticesPath, rendered.text)
      else if (!fs.existsSync(noticesPath) || fs.readFileSync(noticesPath, 'utf-8') !== rendered.text) {
        errors.push(`${NOTICES_PATH}가 실제 의존성과 다릅니다. --write 로 다시 생성하세요`)
      }
    }
  }
  return { errors, blocked }
}

function main() {
  const args = new Set(process.argv.slice(2))
  const { errors, blocked } = runAudit(process.cwd(), {
    write: args.has('--write'),
    notices: !args.has('--no-notices')
  })
  for (const e of errors) console.error(`[check:licenses] ${e}`)
  if (errors.length > 0) process.exit(1)
  if (blocked) {
    console.error(`[check:licenses] BLOCKED: ${blocked}`)
    process.exit(2)
  }
  console.log('[check:licenses] 라이선스 감사 통과')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
