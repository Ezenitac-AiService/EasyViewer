// SPDX-License-Identifier: GPL-3.0-only
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { supportScopeBannerEn } from '@/config/supportScope'
import { checkReadmeHeader } from '../../scripts/docs/readmeHeader.mjs'

/** Spec 005 contracts/readme-structure.md §1 and contracts/doc-checks.md D7. */

const ROOT_DIR = path.resolve(__dirname, '../..')
const tempDirs: string[] = []
afterEach(() => {
  while (tempDirs.length) fs.rmSync(tempDirs.pop() as string, { recursive: true, force: true })
})

function repo(files: Record<string, string>) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ev-readme-'))
  tempDirs.push(root)
  for (const [rel, content] of Object.entries(files)) fs.writeFileSync(path.join(root, rel), content)
  return root
}

const R = 'https://github.com/Ezenitac-AiService/EasyViewer'
const PLATFORM = 'macOS%20(focus)%20%7C%20iOS%20(source%20build)%20%7C%20Linux%20%C2%B7%20Android%20(test%20build)'
const badges = (anchor: string, platform = PLATFORM) => [
  `[![CI](${R}/actions/workflows/ci.yml/badge.svg)](${R}/actions/workflows/ci.yml)`,
  `[![Release build](${R}/actions/workflows/release.yml/badge.svg)](${R}/actions/workflows/release.yml)`,
  `[![GitHub Release](https://img.shields.io/github/v/release/Ezenitac-AiService/EasyViewer?include_prereleases)](${R}/releases)`,
  `[![License: GPL-3.0-only](https://img.shields.io/badge/license-GPL--3.0--only-blue.svg)](./LICENSE)`,
  `[![Platform](https://img.shields.io/badge/platform-${platform}-lightgrey.svg)](${anchor})`,
  `[![Forked from](https://img.shields.io/badge/forked%20from-edith2580%2FEasyViewer%20(v0.1.6)-informational?logo=github)](https://github.com/edith2580/EasyViewer)`
]

function readme(lang: 'ko' | 'en', opts: { badges?: string[]; order?: string[]; extraHeader?: string } = {}) {
  const anchor = lang === 'ko' ? '#지원-플랫폼과-릴리스' : '#supported-platforms-and-releases'
  const section = lang === 'ko' ? '## 지원 플랫폼과 릴리스' : '## Supported platforms and releases'
  const parts: Record<string, string> = {
    title: '# Pagelight',
    switcher: '**언어 / Language**: **[한국어](README.md)** | [English](README.en.md)',
    badges: (opts.badges ?? badges(anchor)).join('\n'),
    banner: `> ${supportScopeBannerEn()}`,
    intro: lang === 'ko' ? 'TXT·EPUB 문서 뷰어입니다.' : 'A TXT and EPUB viewer.',
    important: '> [!IMPORTANT]\n> 처음 실행 안내',
    note: '> [!NOTE]\n> 독립 포크 안내'
  }
  const order = opts.order ?? ['title', 'switcher', 'badges', 'banner', 'intro', 'important', 'note']
  return [...order.map((k) => parts[k]), ...(opts.extraHeader ? [opts.extraHeader] : []), section, 'body', ''].join('\n\n')
}

const good = (over: Record<string, string> = {}) => repo({ 'README.md': readme('ko'), 'README.en.md': readme('en'), ...over })

describe('README header (D7)', () => {
  it('passes the contract order in both languages', () => {
    expect(checkReadmeHeader(good())).toEqual([])
  })

  it('fails when the element order differs', () => {
    const root = good({ 'README.md': readme('ko', { order: ['title', 'switcher', 'banner', 'badges', 'intro', 'important', 'note'] }) })
    expect(checkReadmeHeader(root).some((e: string) => e.startsWith('README.md') && e.includes('순서'))).toBe(true)
  })

  it('fails when a header element is missing', () => {
    const root = good({ 'README.en.md': readme('en', { order: ['title', 'switcher', 'badges', 'banner', 'intro', 'note'] }) })
    expect(checkReadmeHeader(root).some((e: string) => e.startsWith('README.en.md'))).toBe(true)
  })

  it('fails when there are not exactly six badges in order', () => {
    const ko = '#지원-플랫폼과-릴리스'
    const fewer = good({ 'README.md': readme('ko', { badges: badges(ko).slice(0, 5) }) })
    expect(checkReadmeHeader(fewer).some((e: string) => e.includes('배지'))).toBe(true)
    const swapped = badges(ko)
    ;[swapped[0], swapped[1]] = [swapped[1], swapped[0]]
    expect(checkReadmeHeader(good({ 'README.md': readme('ko', { badges: swapped }) })).some((e: string) => e.includes('배지'))).toBe(true)
  })

  it('fails when the platform badge hides the tiers or names Windows', () => {
    const ko = '#지원-플랫폼과-릴리스'
    const flat = good({ 'README.md': readme('ko', { badges: badges(ko, 'macOS%20%7C%20iOS%20%7C%20Linux%20%7C%20Android') }) })
    expect(checkReadmeHeader(flat).some((e: string) => e.includes('플랫폼 배지'))).toBe(true)
    const win = good({ 'README.md': readme('ko', { badges: badges(ko, `${PLATFORM}%20%7C%20Windows`) }) })
    expect(checkReadmeHeader(win).some((e: string) => e.includes('Windows'))).toBe(true)
  })

  it('fails when the platform badge does not point to the supported-platforms section of the same document', () => {
    const wrong = good({ 'README.md': readme('ko', { badges: badges('#지원-기능') }) })
    expect(checkReadmeHeader(wrong).some((e: string) => e.includes('앵커'))).toBe(true)
    const otherLang = good({ 'README.en.md': readme('en', { badges: badges('#지원-플랫폼과-릴리스') }) })
    expect(checkReadmeHeader(otherLang).some((e: string) => e.startsWith('README.en.md') && e.includes('앵커'))).toBe(true)
  })

  it('fails when the header still holds the support-scope block or the license line', () => {
    const block = good({ 'README.md': readme('ko', { extraHeader: '<!-- support-scope:start -->\n원문\n<!-- support-scope:end -->' }) })
    expect(checkReadmeHeader(block).some((e: string) => e.includes('지원 범위 원문'))).toBe(true)
    const license = good({ 'README.en.md': readme('en', { extraHeader: '> **License**: GPL-3.0-only' }) })
    expect(checkReadmeHeader(license).some((e: string) => e.includes('라이선스'))).toBe(true)
  })

  it('passes on this repository', () => {
    expect(checkReadmeHeader(ROOT_DIR)).toEqual([])
  })
})
