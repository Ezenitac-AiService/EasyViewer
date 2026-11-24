// SPDX-License-Identifier: GPL-3.0-only
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'
import { OMISSION_REASONS, omittedMarker, readExclusions } from './release-gate/testBuilds.mjs'

/**
 * Test-build section of the release notes (spec 004 FR-004, FR-005, FR-005a/b,
 * contracts/release-test-builds.md §3 step 2). Appended after `.github/release-notes.md`.
 *
 *   node scripts/release-notes.mjs --linux-result <r> --android-result <r> [--android-reason <reason>] --out <file>
 *
 * The output starts with `.github/release-notes.md` (or `--base <file>`), followed by this section.
 */

export const TEST_BUILD_FORM_URL =
  'https://github.com/Ezenitac-AiService/EasyViewer/issues/new?template=bug_report_test_build.yml'

const NAMES = { linux: 'Linux', android: 'Android' }

function reasonFor(platform, result, { androidReason, exclusions }) {
  if (exclusions.some((e) => e.platform === platform)) return 'security'
  if (platform === 'android' && androidReason) return androidReason
  return result === 'success' ? null : 'build-failed'
}

function omissionText(platform, reason, exclusions) {
  const name = NAMES[platform]
  if (reason === 'no-signing-key') {
    return [
      `> **${name}**: 이번 릴리스에는 ${name} 테스트용 빌드가 없습니다. 포크 소유 서명 키가 준비된 릴리스부터 제공합니다.`,
      `> This release has no ${name} test build. It will be provided from the release where the fork signing key is ready.`
    ]
  }
  if (reason === 'security') {
    const ids = exclusions.filter((e) => e.platform === platform).map((e) => e.advisory).join(', ')
    return [
      `> **${name}**: 보안 문제(${ids})를 고칠 때까지 ${name} 테스트용 빌드를 릴리스에서 뺍니다.`,
      `> The ${name} test build is left out until a security issue (${ids}) is fixed.`
    ]
  }
  return [
    `> **${name}**: 빌드 실패로 이번 릴리스에서 ${name} 테스트용 빌드가 빠졌습니다.`,
    `> The ${name} test build is not included in this release because its build failed.`
  ]
}

/** Renders the Korean/English test-build section with one omission notice and marker per missing platform. */
export function renderTestBuildNotes({ linuxResult, androidResult, androidReason, exclusions = [] }) {
  if (androidReason !== undefined && !OMISSION_REASONS.includes(androidReason)) {
    throw new Error(`알 수 없는 누락 사유: ${androidReason}`)
  }
  const results = { linux: linuxResult, android: androidResult }
  const included = []
  const omitted = []
  for (const platform of Object.keys(NAMES)) {
    const reason = reasonFor(platform, results[platform], { androidReason, exclusions })
    if (reason === null) included.push(NAMES[platform])
    else omitted.push([platform, reason])
  }
  const list = included.length ? included.join(', ') : '없음'
  const listEn = included.length ? included.join(', ') : 'none'
  const lines = [
    '## 테스트용 빌드 / Test builds',
    '',
    `포함된 테스트용 빌드: ${list}`,
    '',
    'Linux·Android 파일은 이름에 `-test`가 붙은 **테스트용 빌드**입니다. 품질·기능 동등성·실기기 검증·대응 일정을 보장하지 않습니다.',
    `문제는 [테스트 빌드 버그 양식](${TEST_BUILD_FORM_URL})으로 알려 주세요.`,
    '',
    `Included test builds: ${listEn}`,
    '',
    'Linux and Android files whose names end in `-test` are **test builds**, with no guarantee of quality, feature parity, real-device verification or response time.',
    `Please report problems with the [test build bug form](${TEST_BUILD_FORM_URL}).`
  ]
  for (const [platform, reason] of omitted) {
    lines.push('', ...omissionText(platform, reason, exclusions), omittedMarker(platform, reason))
  }
  return lines.join('\n') + '\n'
}

function main() {
  const argv = process.argv.slice(2)
  const arg = (name) => {
    const i = argv.indexOf(name)
    return i >= 0 ? argv[i + 1] : undefined
  }
  const { list, errors } = readExclusions(process.cwd())
  if (errors.length) {
    for (const e of errors) console.error(`[release-notes] ${e}`)
    process.exit(1)
  }
  const base = fs.readFileSync(arg('--base') ?? '.github/release-notes.md', 'utf-8')
  const section = renderTestBuildNotes({
    linuxResult: arg('--linux-result'),
    androidResult: arg('--android-result'),
    androidReason: arg('--android-reason') || undefined,
    exclusions: list
  })
  const out = `${base.trimEnd()}\n\n${section}`
  const target = arg('--out')
  if (target) fs.writeFileSync(target, out)
  else process.stdout.write(out)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
