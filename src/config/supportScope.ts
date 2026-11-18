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
  focus: readonly string[]
  maintained: readonly string[]
  unsupported: readonly { platform: string; recommend: string }[]
  devOnly: readonly string[]
  iosDelivery: 'source-build-only'
  linuxBaseline: {
    distro: string
    formats: readonly string[]
    webkit: string
    displayServers: readonly string[]
  }
}

export const SUPPORT_SCOPE: SupportScope = Object.freeze({
  focus: Object.freeze(['macOS', 'iOS', 'Linux']),
  maintained: Object.freeze(['Android']),
  unsupported: Object.freeze([Object.freeze({ platform: 'Windows', recommend: UPSTREAM_REPO_URL })]),
  devOnly: Object.freeze(['Web']),
  iosDelivery: 'source-build-only',
  linuxBaseline: Object.freeze({
    distro: 'Ubuntu 22.04 이상 또는 동급 배포판',
    formats: Object.freeze(['deb', 'AppImage']),
    webkit: 'WebKitGTK 4.1',
    displayServers: Object.freeze(['X11', 'Wayland'])
  })
})

export interface RenderOptions {
  windowsWording?: WindowsWording
}

/** Renders the canonical Korean support-scope text (contracts/support-scope-wording.md §1). */
export function renderSupportScopeKo(options: RenderOptions = {}): string {
  const windowsWording = options.windowsWording ?? 'recommend'
  const s = SUPPORT_SCOPE
  const lb = s.linuxBaseline
  const windowsLine =
    windowsWording === 'recommend'
      ? `**Windows는 이 포크의 지원·배포 대상이 아닙니다. Windows에서는 원저작자의 [EasyViewer](${UPSTREAM_REPO_URL})를 사용하세요.**`
      : '**이 포크는 Windows를 지원하지 않습니다.**'

  return [
    `이 포크는 **${s.focus.join(' · ')}**를 중점 지원합니다. iOS는 공개 배포 채널 없이 소스 빌드로만 제공합니다.`,
    `${s.maintained.join('·')}는 우선순위를 낮춘 유지 플랫폼으로 계속 배포합니다.`,
    windowsLine,
    '웹 브라우저 실행은 개발 보조용입니다.',
    `Linux는 ${lb.distro}(${lb.formats.join('·')}, ${lb.webkit}, ${lb.displayServers.join('·')})에서 검증합니다. 그 밖의 배포판은 동작할 수 있으나 검증하지 않습니다.`
  ].join('\n')
}

/** Single English line used only in the README fork banner (spec 003 decision 11). */
export function supportScopeBannerEn(options: RenderOptions = {}): string {
  const windowsWording = options.windowsWording ?? 'recommend'
  const windowsPart =
    windowsWording === 'recommend'
      ? 'For Windows, please use the original EasyViewer by edith2580.'
      : 'This fork does not support Windows.'
  return `This is an independent fork. It supports macOS, iOS (source build only) and Linux; Android is maintained. ${windowsPart}`
}
