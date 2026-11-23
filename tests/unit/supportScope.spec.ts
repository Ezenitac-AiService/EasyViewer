// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from 'vitest'
import {
  SUPPORT_SCOPE,
  UPSTREAM_REPO_URL,
  renderSupportScopeKo,
  supportScopeBannerEn
} from '@/config/supportScope'

const CANONICAL_KO = [
  '이 포크는 **macOS**를 중점 지원합니다.',
  'iOS·Linux·Android는 우선순위를 낮춘 유지 플랫폼입니다. iOS는 공개 배포 채널 없이 소스 빌드로만 제공합니다.',
  '**Windows는 이 포크의 지원·배포 대상이 아닙니다. Windows에서는 원저작자의 [EasyViewer](https://github.com/edith2580/EasyViewer)를 사용하세요.**',
  '웹 브라우저 실행은 개발 보조용입니다.',
  'Linux는 Ubuntu 22.04 이상 또는 동급 배포판(deb·AppImage, WebKitGTK 4.1, X11·Wayland)에서 검증합니다. 그 밖의 배포판은 동작할 수 있으나 검증하지 않습니다.'
].join('\n')

describe('Support scope single source (FR-006)', () => {
  it('defines the platform tiers exactly as decided in spec 003', () => {
    expect(SUPPORT_SCOPE.focus).toEqual(['macOS'])
    expect(SUPPORT_SCOPE.maintained).toEqual(['iOS', 'Linux', 'Android'])
    expect(SUPPORT_SCOPE.unsupported).toEqual([
      { platform: 'Windows', recommend: 'https://github.com/edith2580/EasyViewer' }
    ])
    expect(SUPPORT_SCOPE.devOnly).toEqual(['Web'])
    expect(SUPPORT_SCOPE.iosDelivery).toBe('source-build-only')
    expect(UPSTREAM_REPO_URL).toBe('https://github.com/edith2580/EasyViewer')
  })

  it('renders the canonical Korean wording from contracts/support-scope-wording.md §1', () => {
    expect(renderSupportScopeKo()).toBe(CANONICAL_KO)
  })

  it('includes the Linux verification baseline', () => {
    const text = renderSupportScopeKo()
    expect(text).toContain('Ubuntu 22.04')
    expect(text).toContain('WebKitGTK 4.1')
    expect(SUPPORT_SCOPE.linuxBaseline.formats).toEqual(['deb', 'AppImage'])
  })

  it('provides a single-line English banner', () => {
    const banner = supportScopeBannerEn()
    expect(banner).not.toContain('\n')
    expect(banner).toContain('focuses on macOS')
    expect(banner).toMatch(/iOS \(source build only\), Linux and Android are maintained with lower priority/)
    expect(banner).toContain('Windows')
  })

  it('narrows only the Windows sentence when the upstream author objects', () => {
    const recommend = renderSupportScopeKo({ windowsWording: 'recommend' })
    const narrowed = renderSupportScopeKo({ windowsWording: 'unsupported-only' })
    const recommendLines = recommend.split('\n')
    const narrowedLines = narrowed.split('\n')
    expect(narrowedLines).toHaveLength(recommendLines.length)
    expect(narrowedLines[2]).toBe('**이 포크는 Windows를 지원하지 않습니다.**')
    narrowedLines.forEach((line, i) => {
      if (i !== 2) expect(line).toBe(recommendLines[i])
    })
    expect(narrowed).not.toContain('edith2580')
  })

  it('never contains wording that defines the upstream project role', () => {
    const text = renderSupportScopeKo() + supportScopeBannerEn()
    for (const banned of ['역할 분담', '역할을 나눠', '경쟁하지 않', 'Windows 전용', '레거시', '구버전']) {
      expect(text).not.toContain(banned)
    }
  })
})
