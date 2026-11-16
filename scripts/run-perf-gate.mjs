import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const args = process.argv.slice(2)
const saveBaseline = args.includes('--save-baseline')
const root = process.cwd()
const baselinePath = path.join(root, 'specs/001-constitution-compliance-refactoring/perf-baseline.json')
const latestPath = path.join(root, 'test-results/perf-latest.json')

const run = spawnSync(
  'npx',
  ['playwright', 'test', 'tests/perf/baseline.spec.ts', '--project=chromium'],
  {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      EV_PERF_OUTPUT: saveBaseline ? baselinePath : latestPath
    }
  }
)

if (run.status !== 0) {
  process.exit(run.status ?? 1)
}

if (saveBaseline) {
  console.log(`[perf] 기준선 저장 완료: ${baselinePath}`)
  process.exit(0)
}

if (!fs.existsSync(baselinePath)) {
  console.error(`[perf] 기준선 파일이 없습니다: ${baselinePath} (--save-baseline 먼저 실행 필요)`)
  process.exit(1)
}

const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf-8'))
const current = JSON.parse(fs.readFileSync(latestPath, 'utf-8'))

if (baseline.environment !== current.environment) {
  console.error(
    `[perf] 실행 환경 불일치: baseline=${baseline.environment}, current=${current.environment}`
  )
  process.exit(1)
}

if (baseline.seededBookCount !== current.seededBookCount) {
  console.error(
    `[perf] 시드 도서 수 불일치: baseline=${baseline.seededBookCount}, current=${current.seededBookCount}`
  )
  process.exit(1)
}

let failed = false
for (const curMetric of current.metrics) {
  const baseMetric = baseline.metrics.find((m) => m.metric === curMetric.metric)
  if (!baseMetric) continue
  const deltaMs = Math.round((curMetric.medianMs - baseMetric.medianMs) * 100) / 100
  const ratio = Math.round((deltaMs / Math.max(baseMetric.medianMs, 1)) * 1000) / 1000
  const regressed = deltaMs > 15 && ratio > 0.10
  console.log(
    `[perf] ${curMetric.metric}: before=${baseMetric.medianMs}ms, after=${curMetric.medianMs}ms, delta=${deltaMs}ms (${(ratio * 100).toFixed(1)}%) -> ${regressed ? 'FAIL' : 'PASS'}`
  )
  if (regressed) failed = true
}

if (failed) {
  process.exit(1)
}
