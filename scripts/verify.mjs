import path from 'node:path'
import { spawnSync } from 'node:child_process'

const frontendOnly = process.argv.includes('--frontend-only')

function runStep(label, command, args, cwd = process.cwd()) {
  console.log(`\n[verify] >>> ${label}: ${command} ${args.join(' ')}`)
  const res = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  })
  if (res.error) {
    console.error(`[verify] ${label} 실행 오류: ${res.error.message}`)
    return 1
  }
  return res.status ?? 1
}

const frontendSteps = [
  ['TypeScript + Vite Build', 'npm', ['run', 'build']],
  ['Tier-1 Unit & Boundary Tests', 'npm', ['test']],
  ['Static Architectural Boundaries', 'npm', ['run', 'check:boundaries']],
  ['Version Sync Check', 'npm', ['run', 'check:version']],
  ['License Audit (policy, no notices)', 'node', ['scripts/check-licenses.mjs', '--no-notices']],
  ['Support Scope & Public Wording', 'node', ['scripts/check-support-scope.mjs']],
  ['App Identity (Pagelight)', 'npm', ['run', 'check:identity']],
  ['Workflow Rules (scripts exist, no upstream sync, least privilege, pinned actions)', 'node', ['scripts/check-release-gate.mjs', '--static']]
]

for (const [label, cmd, args] of frontendSteps) {
  const code = runStep(label, cmd, args)
  if (code !== 0) {
    console.error(`[verify] FAILED at "${label}" (exit ${code})`)
    process.exit(code)
  }
}

const cargoProbe = spawnSync('cargo', ['--version'], {
  stdio: 'pipe',
  shell: process.platform === 'win32'
})

if (cargoProbe.error || cargoProbe.status !== 0) {
  console.error(
    '\n[verify] BLOCKED: Rust 툴체인(cargo)이 설치되어 있지 않아 src-tauri cargo check 및 cargo test를 실행할 수 없습니다.'
  )
  if (frontendOnly) {
    console.warn('[verify] --frontend-only 플래그가 지정되어 exit 0 으로 종료합니다 (Rust 검증은 여전히 BLOCKED).')
    process.exit(0)
  }
  process.exit(2)
}

const tauriDir = path.join(process.cwd(), 'src-tauri')
const cargoCheckCode = runStep('Rust cargo check', 'cargo', ['check'], tauriDir)
if (cargoCheckCode !== 0) {
  process.exit(cargoCheckCode)
}

const cargoTestCode = runStep('Rust cargo test', 'cargo', ['test'], tauriDir)
if (cargoTestCode !== 0) {
  process.exit(cargoTestCode)
}

console.log('\n[verify] 모든 프론트엔드 및 Rust 검증 게이트 통과!')
