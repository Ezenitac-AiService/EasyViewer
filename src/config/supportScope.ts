// SPDX-License-Identifier: GPL-3.0-only
/**
 * Single source of truth for this fork's platform support scope (spec 003 FR-006).
 * Public documents embed the rendered Korean text between
 * `<!-- support-scope:start -->` and `<!-- support-scope:end -->`; scripts/check-support-scope.mjs
 * verifies they match. The About dialog imports this module directly.
 */

export const UPSTREAM_REPO_URL = 'https://github.com/edith2580/EasyViewer'
export const FORK_REPO_URL = 'https://github.com/Ezenitac-AiService/EasyViewer'

export type WindowsWording = 'recommend' | 'unsupported-only'

export interface SupportScope {
  /** Core platform: the only core build (constitution v6.1.0). */
  focus: readonly string[]
  /** Maintained with lower priority. */
  maintained: readonly string[]
  /** Distributed as test builds only; no quality or response guarantee. */
  testBuild: readonly string[]
  /** Outside the fork's scope; users are pointed to the upstream app. */
  excluded: readonly { platform: string; recommend: string }[]
  devOnly: readonly string[]
  iosDelivery: 'source-build-only'
  androidMinimum: string
  linuxBaseline: {
    distro: string
    distroEn: string
    formats: readonly string[]
    webkit: string
    displayServers: readonly string[]
  }
}

export const SUPPORT_SCOPE: SupportScope = Object.freeze({
  focus: Object.freeze(['macOS']),
  maintained: Object.freeze(['iOS']),
  testBuild: Object.freeze(['Linux', 'Android']),
  excluded: Object.freeze([Object.freeze({ platform: 'Windows', recommend: UPSTREAM_REPO_URL })]),
  devOnly: Object.freeze(['Web']),
  iosDelivery: 'source-build-only',
  androidMinimum: '7.0 (API 24)',
  linuxBaseline: Object.freeze({
    distro: 'Ubuntu 22.04 이상 또는 동급 배포판',
    distroEn: 'Ubuntu 22.04 or later and equivalent distributions',
    formats: Object.freeze(['deb', 'AppImage']),
    webkit: 'WebKitGTK 4.1',
    displayServers: Object.freeze(['X11', 'Wayland'])
  })
})

export interface RenderOptions {
  windowsWording?: WindowsWording
}

/** Renders the canonical Korean support-scope text (spec 004 contracts/support-scope-text.md §1). */
export function renderSupportScopeKo(options: RenderOptions = {}): string {
  const windowsWording = options.windowsWording ?? 'recommend'
  const s = SUPPORT_SCOPE
  const lb = s.linuxBaseline
  const windowsLine =
    windowsWording === 'recommend'
      ? `**Windows는 이 포크의 범위가 아닙니다. Windows에서는 원저작자의 [EasyViewer](${UPSTREAM_REPO_URL})를 사용하세요.**`
      : '**이 포크는 Windows를 지원하지 않습니다.**'

  return [
    `이 포크는 **${s.focus.join(' · ')}**를 중점 지원합니다.`,
    `${s.maintained.join('·')}는 우선순위를 낮춘 유지 플랫폼이며, 공개 배포 채널 없이 소스 빌드로만 제공합니다.`,
    `${s.testBuild.join('·')}는 **테스트용 빌드**로만 배포합니다. 품질·기능 동등성·실기기 검증·대응 일정을 보장하지 않습니다.`,
    windowsLine,
    '웹 브라우저 실행은 개발 보조용입니다.',
    `Linux 테스트용 빌드는 ${lb.distro}(${lb.formats.join('·')}, ${lb.webkit}, ${lb.displayServers.join('·')})에서 빌드합니다. Android 테스트용 빌드는 Android ${s.androidMinimum.replace(' (', '(')} 이상이 대상입니다.`
  ].join('\n')
}

/** Renders the canonical English support-scope text (spec 004 contracts/support-scope-text.md §2). */
export function renderSupportScopeEn(options: RenderOptions = {}): string {
  const windowsWording = options.windowsWording ?? 'recommend'
  const s = SUPPORT_SCOPE
  const lb = s.linuxBaseline
  const windowsLine =
    windowsWording === 'recommend'
      ? `**Windows is outside the scope of this fork. On Windows, use the original [EasyViewer](${UPSTREAM_REPO_URL}).**`
      : '**This fork does not support Windows.**'

  return [
    `This fork focuses on **${s.focus.join(', ')}**.`,
    `${s.maintained.join(', ')} is maintained with lower priority and is provided as a source build only, without a public distribution channel.`,
    `${s.testBuild.join(' and ')} are distributed as **test builds** only, with no guarantee of quality, feature parity, real-device verification or response time.`,
    windowsLine,
    'Running in a web browser is a development aid only.',
    `Linux test builds are built for ${lb.distroEn} (${lb.formats.join(', ')}, ${lb.webkit}, ${lb.displayServers.join(' and ')}). Android test builds target Android ${s.androidMinimum} or later.`
  ].join('\n')
}

/** Single English line used only in the README fork banner (spec 004 contracts/support-scope-text.md §3). */
export function supportScopeBannerEn(options: RenderOptions = {}): string {
  const windowsWording = options.windowsWording ?? 'recommend'
  const windowsPart =
    windowsWording === 'recommend'
      ? 'For Windows, please use the original EasyViewer by edith2580.'
      : 'This fork does not support Windows.'
  return `This is an independent fork. It focuses on macOS; iOS is a source build only, and Linux and Android are test builds. ${windowsPart}`
}
