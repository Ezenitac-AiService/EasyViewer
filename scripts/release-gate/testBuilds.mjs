// SPDX-License-Identifier: GPL-3.0-only
import fs from 'node:fs'
import path from 'node:path'

/**
 * Test-build rules of the release gate (spec 004 FR-004–FR-007, contracts/release-test-builds.md,
 * research R4–R5, data-model §2–§4). Linux and Android ship as test builds only (constitution v6.1.0).
 */

export const TEST_BUILD_PLATFORMS = ['linux', 'android']
export const OMISSION_REASONS = ['build-failed', 'security', 'no-signing-key']
export const EXCLUSIONS_FILE = '.github/release-exclusions.json'
/** First release with the test-build rules; older releases are not counted (research R4). */
export const MARKER_SINCE = 'v1.0.0-alpha.1'
export const MAX_CONSECUTIVE_OMISSIONS = 3

const TEST_MARKED = /-test(-rehearsal)?\.(deb|AppImage|rpm|apk)$/
const TEST_BUILD_FILE = /\.(deb|AppImage|rpm|apk)$/
const PLATFORM_FILE = { linux: /\.(deb|AppImage|rpm)$/, android: /\.apk$/ }
/** The v1.0.0-alpha.1 notes said Android was left out for lack of the fork key, before the marker existed. */
const LEGACY_NO_KEY = /이번 릴리스에는 Android APK가 없습니다\.\s*포크 소유 서명 키/
const DATE = /^\d{4}-\d{2}-\d{2}$/
const EXCLUSION_KEYS = new Set(['platform', 'advisory', 'since'])

export const omittedMarker = (platform, reason) => `<!-- pagelight:omitted ${platform}=${reason} -->`

/** Returns errors for `.github/release-exclusions.json` (data-model §4). */
export function validateExclusions(list) {
  if (!Array.isArray(list)) return [`${EXCLUSIONS_FILE}: 배열이어야 합니다`]
  const errors = []
  list.forEach((e, i) => {
    const at = `${EXCLUSIONS_FILE}[${i}]`
    if (!e || typeof e !== 'object') return errors.push(`${at}: 객체여야 합니다`)
    if (!TEST_BUILD_PLATFORMS.includes(e.platform)) errors.push(`${at}: platform은 linux 또는 android만 됩니다(macOS·iOS는 이 방식으로 뺄 수 없음)`)
    if (typeof e.advisory !== 'string' || !e.advisory.trim()) errors.push(`${at}: advisory(비공개 식별자)가 필요합니다`)
    if (typeof e.since !== 'string' || !DATE.test(e.since)) errors.push(`${at}: since는 YYYY-MM-DD여야 합니다`)
    const extra = Object.keys(e).filter((k) => !EXCLUSION_KEYS.has(k))
    if (extra.length) errors.push(`${at}: 허용되지 않는 필드 ${extra.join(', ')}(결함 세부를 적지 않습니다)`)
  })
  return errors
}

export function readExclusions(root) {
  const p = path.join(root, EXCLUSIONS_FILE)
  if (!fs.existsSync(p)) return { list: [], errors: [] }
  let list
  try {
    list = JSON.parse(fs.readFileSync(p, 'utf-8'))
  } catch {
    return { list: [], errors: [`${EXCLUSIONS_FILE}: JSON을 읽을 수 없습니다`] }
  }
  const errors = validateExclusions(list)
  return { list: errors.length ? [] : list, errors }
}

const excluded = (exclusions, platform) => exclusions.some((e) => e.platform === platform)

/** Gate outputs that decide which test-build jobs run (contracts §2). */
export function gateOutputs({ exclusions, hasSigningKey, rehearsal = false }) {
  return {
    linux: !excluded(exclusions, 'linux'),
    android: (hasSigningKey || rehearsal) && !excluded(exclusions, 'android')
  }
}

/** Publish-phase checks on the collected files and the rendered notes (contracts §3 step 4). */
export function checkTestBuildAssets(files, { notes, linuxResult, androidResult, exclusions = [] }) {
  const errors = []
  const unmarked = files.filter((f) => TEST_BUILD_FILE.test(f) && !TEST_MARKED.test(f))
  if (unmarked.length) errors.push(`테스트용 빌드 표식(-test)이 없는 파일: ${unmarked.join(', ')}`)
  const markedDmg = files.filter((f) => /\.dmg$/.test(f) && /-test/.test(f))
  if (markedDmg.length) errors.push(`macOS 산출물에는 -test 표식을 붙이지 않습니다: ${markedDmg.join(', ')}`)
  const results = { linux: linuxResult, android: androidResult }
  for (const platform of TEST_BUILD_PLATFORMS) {
    const result = results[platform]
    if (result && result !== 'success' && !new RegExp(`pagelight:omitted ${platform}=(${OMISSION_REASONS.join('|')})`).test(notes ?? '')) {
      errors.push(`${platform} 테스트용 빌드가 빠졌는데 릴리스 노트에 누락 안내(${omittedMarker(platform, '<reason>')})가 없습니다`)
    }
    if (excluded(exclusions, platform)) {
      const leaked = files.filter((f) => PLATFORM_FILE[platform].test(f))
      if (leaked.length) errors.push(`보안상 제외된 ${platform} 산출물이 있습니다: ${leaked.join(', ')}`)
    }
  }
  return errors
}

/** How a published release treats a platform: null when included, otherwise the omission reason. */
export function omissionReason(release, platform) {
  if (release.assets.some((f) => PLATFORM_FILE[platform].test(f))) return null
  const m = new RegExp(`pagelight:omitted ${platform}=([\\w-]+)`).exec(release.body ?? '')
  if (m) return m[1]
  if (platform === 'android' && LEGACY_NO_KEY.test(release.body ?? '')) return 'no-signing-key'
  return 'build-failed'
}

/**
 * Consecutive omissions counted from the newest published release (FR-005c). Rehearsals and
 * releases before MARKER_SINCE are ignored; Android left out for lack of a signing key neither
 * counts nor breaks the streak.
 */
export function consecutiveOmissions(releases, platform) {
  const tags = []
  for (const release of releases) {
    if (release.tag.endsWith('-rehearsal')) continue
    const reason = omissionReason(release, platform)
    if (reason === null) break
    if (reason !== 'no-signing-key') tags.push(release.tag)
    if (release.tag === MARKER_SINCE) break
  }
  return { count: tags.length, tags }
}

/** Prebuild checks: exclusions file and the consecutive-omission stop (contracts §2). */
export function checkPrebuildTestBuilds(root, env) {
  const errors = []
  const blocked = []
  const { list, errors: exclusionErrors } = readExclusions(root)
  errors.push(...exclusionErrors)
  const releases = typeof env.recentReleases === 'function' ? env.recentReleases() : null
  if (releases === null) {
    blocked.push('이전 게시 릴리스를 조회할 수 없어 테스트용 빌드 연속 누락을 확인하지 못했습니다')
  } else {
    for (const platform of TEST_BUILD_PLATFORMS) {
      const { count, tags } = consecutiveOmissions(releases, platform)
      if (count >= MAX_CONSECUTIVE_OMISSIONS) {
        errors.push(
          `${platform} 테스트용 빌드가 ${count}회 연속 빠졌습니다(${tags.join(', ')}). 고치거나 지원 범위에서 빼는 변경을 먼저 결정하세요`
        )
      }
    }
  }
  return { errors, blocked, exclusions: list }
}
