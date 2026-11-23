// SPDX-License-Identifier: GPL-3.0-only
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/** Pinned fixes for production advisories that the weekly dependency audit reported. */

const ROOT_DIR = path.resolve(__dirname, '../..')
const lock = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package-lock.json'), 'utf-8'))

const parse = (v: string) => v.split('.').map((n) => Number.parseInt(n, 10))
const atLeast = (v: string, min: string) => {
  const [a, b] = [parse(v), parse(min)]
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i]
  return true
}

describe('production dependency advisories', () => {
  it('resolves every @xmldom/xmldom copy to 0.9.12 or later (GHSA advisories up to 0.8.14)', () => {
    const copies = Object.entries(lock.packages as Record<string, { version?: string }>)
      .filter(([key]) => key.endsWith('node_modules/@xmldom/xmldom'))
      .map(([key, pkg]) => [key, pkg.version ?? ''] as const)
    expect(copies.length).toBeGreaterThan(0)
    for (const [key, version] of copies) expect(atLeast(version, '0.9.12'), `${key}@${version}`).toBe(true)
  })

  it('keeps the override that forces the fixed xmldom under epubjs', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf-8'))
    expect(pkg.overrides?.epubjs?.['@xmldom/xmldom']).toMatch(/^\^0\.9\.(1[2-9]|[2-9]\d)/)
  })
})
