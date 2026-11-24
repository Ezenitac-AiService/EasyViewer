// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from 'vitest'
import {
  SUPPORT_SCOPE,
  UPSTREAM_REPO_URL,
  renderSupportScopeEn,
  renderSupportScopeKo,
  supportScopeBannerEn
} from '@/config/supportScope'

/** Spec 004 contracts/support-scope-text.md §1–§3 (constitution v6.1.0 platform tiers). */

const CANONICAL_KO = [
  '이 포크는 **macOS**를 중점 지원합니다.',
  'iOS는 우선순위를 낮춘 유지 플랫폼이며, 공개 배포 채널 없이 소스 빌드로만 제공합니다.',
  'Linux·Android는 **테스트용 빌드**로만 배포합니다. 품질·기능 동등성·실기기 검증·대응 일정을 보장하지 않습니다.',
  '**Windows는 이 포크의 범위가 아닙니다. Windows에서는 원저작자의 [EasyViewer](https://github.com/edith2580/EasyViewer)를 사용하세요.**',
  '웹 브라우저 실행은 개발 보조용입니다.',
  'Linux 테스트용 빌드는 Ubuntu 22.04 이상 또는 동급 배포판(deb·AppImage, WebKitGTK 4.1, X11·Wayland)에서 빌드합니다. Android 테스트용 빌드는 Android 7.0(API 24) 이상이 대상입니다.'
].join('\n')

const CANONICAL_EN = [
  'This fork focuses on **macOS**.',
  'iOS is maintained with lower priority and is provided as a source build only, without a public distribution channel.',
  'Linux and Android are distributed as **test builds** only, with no guarantee of quality, feature parity, real-device verification or response time.',
  '**Windows is outside the scope of this fork. On Windows, use the original [EasyViewer](https://github.com/edith2580/EasyViewer).**',
  'Running in a web browser is a development aid only.',
  'Linux test builds are built for Ubuntu 22.04 or later and equivalent distributions (deb, AppImage, WebKitGTK 4.1, X11 and Wayland). Android test builds target Android 7.0 (API 24) or later.'
].join('\n')

const BANNER_EN =
  'This is an independent fork. It focuses on macOS; iOS is a source build only, and Linux and Android are test builds. For Windows, please use the original EasyViewer by edith2580.'

describe('Support scope single source (constitution v6.1.0)', () => {
  it('defines the four platform tiers', () => {
    expect(SUPPORT_SCOPE.focus).toEqual(['macOS'])
    expect(SUPPORT_SCOPE.maintained).toEqual(['iOS'])
    expect(SUPPORT_SCOPE.testBuild).toEqual(['Linux', 'Android'])
    expect(SUPPORT_SCOPE.excluded).toEqual([{ platform: 'Windows', recommend: 'https://github.com/edith2580/EasyViewer' }])
    expect(SUPPORT_SCOPE.devOnly).toEqual(['Web'])
    expect(SUPPORT_SCOPE.iosDelivery).toBe('source-build-only')
    expect(SUPPORT_SCOPE.androidMinimum).toBe('7.0 (API 24)')
    expect(SUPPORT_SCOPE.linuxBaseline.formats).toEqual(['deb', 'AppImage'])
    expect(UPSTREAM_REPO_URL).toBe('https://github.com/edith2580/EasyViewer')
  })

  it('renders the canonical Korean text', () => {
    expect(renderSupportScopeKo()).toBe(CANONICAL_KO)
  })

  it('renders the canonical English text', () => {
    expect(renderSupportScopeEn()).toBe(CANONICAL_EN)
  })

  it('provides the single-line English banner', () => {
    expect(supportScopeBannerEn()).toBe(BANNER_EN)
    expect(supportScopeBannerEn()).not.toContain('\n')
  })

  it.each([
    ['ko', renderSupportScopeKo, '**이 포크는 Windows를 지원하지 않습니다.**'],
    ['en', renderSupportScopeEn, '**This fork does not support Windows.**']
  ])('narrows only the Windows sentence when the upstream author objects (%s)', (_lang, render, narrowedLine) => {
    const recommend = render({ windowsWording: 'recommend' }).split('\n')
    const narrowed = render({ windowsWording: 'unsupported-only' }).split('\n')
    expect(narrowed).toHaveLength(recommend.length)
    expect(narrowed[3]).toBe(narrowedLine)
    narrowed.forEach((line, i) => {
      if (i !== 3) expect(line).toBe(recommend[i])
    })
    expect(narrowed.join('\n')).not.toContain('edith2580')
  })

  it('narrows the banner too', () => {
    const banner = supportScopeBannerEn({ windowsWording: 'unsupported-only' })
    expect(banner).toContain('This fork does not support Windows.')
    expect(banner).not.toContain('edith2580')
  })
})
