// SPDX-License-Identifier: GPL-3.0-only
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

/**
 * Fork-separation safety gate (spec 003 FR-025, contracts/release-and-ci.md §3).
 *
 *   --separation                 items 1–5 (before asking GitHub Support to detach the fork)
 *   --release --tag <t> --assets <dir> [--rehearsal] [--phase prebuild|publish]
 *                                items 1–8 + version non-overlap + Android versionCode + no leftover draft.
 *                                `prebuild` (before any build): everything except the artifact items 6–7.
 *                                `publish` (on the collected artifacts): items 6–7 only.
 *   --static                     workflow rules: scripts exist, no upstream sync, least privilege, pinned actions
 * Exit codes: 0 pass, 1 fail, 2 BLOCKED (a required lookup could not run).
 */

export const BASELINE_TAG = 'upstream-base-v0.1.6'
export const BASELINE_SHA = '44c4d37749d29bd070e7a07aea4622eef0b97306'
const V = 'specs/003-independent-fork-separation/verification'
const DATE = /\d{4}-\d{2}-\d{2}/
const WINDOWS_ARTIFACT = /\.(exe|msi)$|windows|_x64_portable\.zip$|portable\.zip$/i
const MANUAL_ITEMS = new Set(['1', '2', '3', '8'])
const PHASES = new Set([undefined, 'full', 'prebuild', 'publish'])

function read(root, rel) {
  const p = path.join(root, rel)
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : ''
}

function json(root, rel) {
  const text = read(root, rel)
  return text ? JSON.parse(text) : {}
}

// ---------------------------------------------------------------------------
// FR-025 items
// ---------------------------------------------------------------------------

function itemBaseline(env) {
  const sha = env.remoteTagSha(BASELINE_TAG)
  if (!sha) return `기준선 태그 ${BASELINE_TAG}가 원격(origin)에 없습니다`
  if (sha !== BASELINE_SHA) return `기준선 태그가 ${BASELINE_SHA.slice(0, 7)}가 아닌 ${sha.slice(0, 7)}를 가리킵니다`
  return null
}

function itemSecurity(root) {
  const text = read(root, `${V}/security-coordination.md`)
  return /(통지 날짜|통지 시도 기록)[^\n]*\d{4}-\d{2}-\d{2}/.test(text)
    ? null
    : '보안 조율 기록(verification/security-coordination.md)에 통지 날짜 또는 통지 시도 기록이 없습니다'
}

function itemNotice(root) {
  const text = read(root, `${V}/upstream-notice.md`)
  if (!/고지 날짜[^\n]*\d{4}-\d{2}-\d{2}/.test(text)) return '원저작자 사전 고지 기록에 고지 날짜가 없습니다'
  if (!/이의 대응 결과\s*:\s*\S/.test(text)) return '원저작자 사전 고지 기록에 이의 대응 결과가 없습니다'
  return null
}

function itemCi(env, key, label) {
  const status = env.ciStatus()
  if (!status) return { blocked: `${label} 결과를 조회할 수 없습니다` }
  return status[key] === 'success' ? null : `${label}가 통과하지 않았습니다(${status[key] ?? '없음'})`
}

function listAssets(dir) {
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => !f.startsWith('.')).sort() : []
}

function itemChecksums(assetsDir) {
  const files = listAssets(assetsDir)
  if (!files.includes('SHA256SUMS.txt')) return 'SHA256SUMS.txt가 없습니다'
  const covered = new Set(
    fs.readFileSync(path.join(assetsDir, 'SHA256SUMS.txt'), 'utf-8')
      .split('\n')
      .map((l) => l.trim().split(/\s+\*?/).slice(1).join(' '))
      .filter(Boolean)
  )
  const missing = files.filter((f) => f !== 'SHA256SUMS.txt' && !covered.has(f))
  return missing.length ? `SHA256SUMS.txt에 없는 산출물: ${missing.join(', ')}` : null
}

function itemNoWindows(assetsDir) {
  const win = listAssets(assetsDir).filter((f) => WINDOWS_ARTIFACT.test(f))
  return win.length ? `Windows 산출물이 있습니다: ${win.join(', ')}` : null
}

function itemKeyBackup(root) {
  const text = read(root, `${V}/release-gate.md`)
  if (!/-\s*\[[xX]\]\s*8\./.test(text)) return '메인테이너의 Android 서명 키 백업 확인(항목 8)이 체크되지 않았습니다'
  if (!/서명 인증서 SHA-256\s*:\s*\S/.test(text)) return '서명 인증서 SHA-256 지문 기록이 없습니다'
  return null
}

function extraVersion(root, tag, rehearsal, env) {
  const errors = []
  const blocked = []
  const version = json(root, 'package.json').version
  const expected = rehearsal ? `v${version}-rehearsal` : `v${version}`
  if (tag !== expected) errors.push(`태그 ${tag}가 매니페스트 버전(${expected})과 다릅니다`)
  const upstream = env.upstreamVersions()
  if (upstream === null) blocked.push('업스트림 릴리스 목록을 조회할 수 없어 버전 비중복을 확인하지 못했습니다')
  else if (upstream.includes(version)) errors.push(`버전 비중복 위반: 원저작자가 이미 ${version}을 썼습니다`)
  return { errors, blocked }
}

function extraVersionCode(root) {
  const code = json(root, 'src-tauri/tauri.conf.json').bundle?.android?.versionCode
  if (!Number.isInteger(code)) return 'tauri.conf.json bundle.android.versionCode가 명시되어 있지 않습니다'
  const prev = Number(/직전 포크 릴리스 versionCode\s*:\s*(\d+)/.exec(read(root, `${V}/release-gate.md`))?.[1] ?? 0)
  return code > prev ? null : `Android versionCode(${code})가 직전 포크 릴리스(${prev})보다 커야 합니다`
}

export function runGate(root, opts, env) {
  const errors = []
  const warnings = []
  const blocked = []
  const items = []
  const record = (id, result) => {
    items.push({ id, ok: result === null })
    if (result === null) return
    if (typeof result === 'object' && result.blocked) {
      blocked.push(`[${id}] ${result.blocked}`)
      return
    }
    const msg = `[${id}] ${result}`
    if (opts.rehearsal && MANUAL_ITEMS.has(id)) warnings.push(msg)
    else errors.push(msg)
  }

  if (!PHASES.has(opts.phase)) errors.push(`알 수 없는 --phase 값: ${opts.phase}`)
  if (opts.rehearsal && !String(opts.tag || '').endsWith('-rehearsal')) {
    errors.push('리허설 태그는 반드시 -rehearsal로 끝나야 합니다')
  }

  const phase = opts.mode === 'release' ? opts.phase ?? 'full' : 'full'
  if (phase === 'publish') {
    record('6', itemChecksums(opts.assetsDir))
    record('7', itemNoWindows(opts.assetsDir))
    return { errors, warnings, blocked, items }
  }

  record('1', itemBaseline(env))
  record('2', itemSecurity(root))
  record('3', itemNotice(root))
  record('4', itemCi(env, 'ci', 'main 전체 CI'))
  record('5', itemCi(env, 'licenses', '라이선스 감사'))

  if (opts.mode === 'release') {
    if (phase !== 'prebuild') {
      record('6', itemChecksums(opts.assetsDir))
      record('7', itemNoWindows(opts.assetsDir))
    }
    record('8', itemKeyBackup(root))
    const v = extraVersion(root, opts.tag, opts.rehearsal, env)
    errors.push(...v.errors)
    blocked.push(...v.blocked)
    const vc = extraVersionCode(root)
    if (vc) errors.push(vc)
    const drafts = env.draftReleases() ?? []
    if (!opts.rehearsal && drafts.includes(opts.tag)) errors.push(`같은 태그(${opts.tag})의 초안 릴리스가 남아 있습니다`)
  }
  return { errors, warnings, blocked, items }
}

// ---------------------------------------------------------------------------
// Static workflow rules
// ---------------------------------------------------------------------------

const SYNC_RE = /(git\s+(fetch|merge|pull|rebase)\s+upstream|gh\s+repo\s+sync|edith2580\/EasyViewer\.git)/

export function checkStatic(root) {
  const errors = []
  const dir = path.join(root, '.github/workflows')
  if (!fs.existsSync(dir)) return errors
  const pkgScripts = json(root, 'package.json').scripts ?? {}
  for (const file of fs.readdirSync(dir).filter((f) => /\.ya?ml$/.test(f)).sort()) {
    const rel = `.github/workflows/${file}`
    const text = fs.readFileSync(path.join(dir, file), 'utf-8')
    for (const m of text.matchAll(/node\s+(scripts\/[\w./-]+\.m?js)/g)) {
      if (!fs.existsSync(path.join(root, m[1]))) errors.push(`${rel}: 존재하지 않는 스크립트 ${m[1]}`)
    }
    for (const m of text.matchAll(/npm\s+run\s+([\w:-]+)/g)) {
      if (!(m[1] in pkgScripts)) errors.push(`${rel}: package.json에 없는 npm 스크립트 ${m[1]}`)
    }
    if (SYNC_RE.test(text)) errors.push(`${rel}: 업스트림 동기화 명령이 있습니다`)
    errors.push(...checkWorkflowStructure(rel, text))
  }
  return errors
}

function checkWorkflowStructure(rel, text) {
  const errors = []
  const lines = text.split('\n')
  const topPerm = /^permissions:\s*\n\s+contents:\s*read\s*$/m.test(text) || /^permissions:\s*read-all\s*$/m.test(text)
  if (!topPerm) errors.push(`${rel}: 최상위 권한은 contents: read여야 합니다`)
  let inJobs = false
  let job = null
  let envIndent = -1
  for (const line of lines) {
    const indent = line.length - line.trimStart().length
    if (/^jobs:\s*$/.test(line)) inJobs = true
    else if (/^\S/.test(line)) inJobs = false
    const jobMatch = /^ {2}([\w-]+):\s*$/.exec(line)
    if (inJobs && jobMatch) job = jobMatch[1]
    // Top-level write access is already reported by the top-level permission rule above.
    if (inJobs && /contents:\s*write/.test(line) && job !== 'publish') {
      errors.push(`${rel}: contents: write는 publish 작업에만 둘 수 있습니다(${job})`)
    }
    if (/^\s*env:\s*$/.test(line)) envIndent = indent
    else if (envIndent >= 0 && indent <= envIndent && line.trim()) envIndent = -1
    if (/\$\{\{\s*secrets\./.test(line)) {
      // Step-level env sits at indent >= 8 under "- name:"; job/top-level env is shallower.
      if (envIndent < 0 || envIndent < 8) errors.push(`${rel}: 비밀값은 단계(step) env에만 둘 수 있습니다`)
    }
    const uses = /uses:\s*([^\s#]+)/.exec(line)
    if (uses && !uses[1].startsWith('actions/') && !uses[1].startsWith('./')) {
      if (!/@[0-9a-f]{40}$/.test(uses[1])) errors.push(`${rel}: 서드파티 액션 ${uses[1]}은 커밋 SHA로 고정해야 합니다`)
    }
  }
  return errors
}

// ---------------------------------------------------------------------------
// CLI environment (GitHub CLI / git)
// ---------------------------------------------------------------------------

function sh(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf-8' })
  return r.status === 0 ? r.stdout.trim() : null
}

export function realEnv(root) {
  const repo = process.env.GITHUB_REPOSITORY || 'Ezenitac-AiService/EasyViewer'
  return {
    remoteTagSha(tag) {
      const out = sh('git', ['-C', root, 'ls-remote', '--tags', 'origin', `refs/tags/${tag}^{}`])
      return out ? out.split(/\s+/)[0] : null
    },
    ciStatus() {
      const sha = sh('git', ['-C', root, 'rev-parse', 'HEAD'])
      if (!sha) return null
      const out = sh('gh', ['api', `repos/${repo}/actions/workflows/ci.yml/runs?head_sha=${sha}&status=completed`, '--jq', '.workflow_runs[0].id'])
      if (!out) return null
      const jobs = sh('gh', ['api', `repos/${repo}/actions/runs/${out}/jobs`, '--jq', '[.jobs[] | {name, conclusion}]'])
      if (!jobs) return null
      const list = JSON.parse(jobs)
      const all = list.every((j) => j.conclusion === 'success') ? 'success' : 'failure'
      return { ci: all, licenses: list.find((j) => j.name === 'licenses')?.conclusion ?? 'missing' }
    },
    upstreamVersions() {
      const out = sh('gh', ['api', 'repos/edith2580/EasyViewer/releases', '--paginate', '--jq', '.[].tag_name'])
      return out === null ? null : out.split('\n').filter(Boolean).map((t) => t.replace(/^v/, ''))
    },
    draftReleases() {
      const out = sh('gh', ['api', `repos/${repo}/releases`, '--jq', '.[] | select(.draft) | .tag_name'])
      return out === null ? [] : out.split('\n').filter(Boolean)
    }
  }
}

function main() {
  const argv = process.argv.slice(2)
  const arg = (name) => {
    const i = argv.indexOf(name)
    return i >= 0 ? argv[i + 1] : undefined
  }
  const root = process.cwd()
  if (argv.includes('--static')) {
    const errors = checkStatic(root)
    for (const e of errors) console.error(`[release-gate] ${e}`)
    if (errors.length) process.exit(1)
    console.log('[release-gate] 워크플로 정적 규칙 통과')
    return
  }
  const mode = argv.includes('--release') ? 'release' : 'separation'
  const r = runGate(
    root,
    {
      mode,
      tag: arg('--tag'),
      assetsDir: arg('--assets') ?? 'release-assets',
      rehearsal: argv.includes('--rehearsal'),
      phase: arg('--phase')
    },
    realEnv(root)
  )
  for (const w of r.warnings) console.warn(`[release-gate] 경고 ${w}`)
  for (const e of r.errors) console.error(`[release-gate] ${e}`)
  for (const b of r.blocked) console.error(`[release-gate] BLOCKED ${b}`)
  if (r.errors.length) process.exit(1)
  if (r.blocked.length) process.exit(2)
  console.log(`[release-gate] ${mode === 'release' ? '릴리스' : '분리'} 게이트 통과`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
