// SPDX-License-Identifier: GPL-3.0-only
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

/**
 * Windows exclusion gate (spec 004 FR-008–FR-011, contracts/windows-exclusion.md §2, data-model §5).
 * Looks only at behavior: something counts as Windows-only when it has an effect only when building
 * or running for Windows. The word "windows" alone (for example the app window list) never fails.
 * Only Git-tracked files are checked; outside a Git checkout the tree is walked without build output.
 */

/** Files allowed to mention Windows on purpose (data-model §5). */
export const ALLOWLIST = [
  'src/config/supportScope.ts',
  '.github/ISSUE_TEMPLATE/config.yml',
  'docs/windows-migration.md',
  'docs/windows-eol-notice.md',
  'src-tauri/src/security/path_guard.rs',
  'scripts/check-release-gate.mjs',
  'scripts/check-windows-exclusion.mjs',
  'src-tauri/gen/android/gradlew.bat'
]
const ALLOWED_PREFIXES = [/^specs\/00[1-3]-/]
const SKIP_DIRS = new Set(['node_modules', 'target', 'dist', '.git'])

function allowed(rel) {
  return ALLOWLIST.includes(rel) || ALLOWED_PREFIXES.some((re) => re.test(rel))
}

function walk(root, rel = '', out = []) {
  for (const entry of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue
    const child = rel ? `${rel}/${entry.name}` : entry.name
    if (entry.isDirectory()) walk(root, child, out)
    else if (entry.isFile()) out.push(child)
  }
  return out
}

export function trackedFiles(root) {
  const r = spawnSync('git', ['-C', root, 'ls-files', '-z'], { encoding: 'utf-8' })
  if (r.status === 0 && fs.existsSync(path.join(root, '.git'))) {
    return r.stdout.split('\0').filter((f) => f && fs.existsSync(path.join(root, f)))
  }
  return walk(root)
}

/** Every `cfg(...)`/`cfg!(...)`/`cfg_attr(...)` expression with balanced parentheses. */
function cfgExpressions(text) {
  const out = []
  for (const m of text.matchAll(/\bcfg(_attr)?!?\s*\(/g)) {
    let depth = 0
    let i = m.index + m[0].length - 1
    for (; i < text.length; i++) {
      if (text[i] === '(') depth++
      else if (text[i] === ')' && --depth === 0) break
    }
    out.push(text.slice(m.index, i + 1))
  }
  return out
}

const RULES = [
  {
    id: 'W1',
    label: 'Windows 빌드 조건',
    applies: (f) => (/^src-tauri\/.*\.rs$/.test(f) && !f.startsWith('src-tauri/gen/')) || f === 'src-tauri/Cargo.toml',
    check(text) {
      const hits = cfgExpressions(text).filter((e) => /\bwindows\b|target_os\s*=\s*"windows"|target_family\s*=\s*"windows"/.test(e))
      if (/windows_subsystem/.test(text)) hits.push('windows_subsystem')
      return hits
    }
  },
  {
    id: 'W2',
    label: 'Windows 번들 설정',
    applies: (f) => f === 'src-tauri/tauri.conf.json',
    check(text) {
      let conf
      try {
        conf = JSON.parse(text)
      } catch {
        return ['JSON을 읽을 수 없습니다']
      }
      const bundle = conf.bundle ?? {}
      const hits = []
      if (bundle.windows !== undefined) hits.push('bundle.windows')
      for (const icon of bundle.icon ?? []) if (/\.ico$/i.test(icon)) hits.push(`bundle.icon ${icon}`)
      const targets = Array.isArray(bundle.targets) ? bundle.targets : [bundle.targets].filter(Boolean)
      for (const t of targets) if (/^(nsis|msi|wix)$/i.test(t)) hits.push(`bundle.targets ${t}`)
      return hits
    }
  },
  {
    id: 'W3',
    label: 'Windows 권한 플랫폼',
    applies: (f) => /^src-tauri\/capabilities\/[^/]+\.json$/.test(f),
    check(text) {
      try {
        const platforms = JSON.parse(text).platforms ?? []
        return platforms.filter((p) => /^windows$/i.test(p)).map((p) => `platforms ${p}`)
      } catch {
        return ['JSON을 읽을 수 없습니다']
      }
    }
  },
  {
    id: 'W4',
    label: 'Windows 감사 대상',
    applies: (f) => f === 'src-tauri/deny.toml' || f === 'src-tauri/about.toml',
    check: (text) => [...text.matchAll(/["'][\w.-]*-windows-[\w.-]*["']/g)].map((m) => m[0])
  },
  {
    id: 'W5',
    label: 'Windows 전용 파일',
    applies: () => true,
    byName: (f) => /\.(ico|bat|ps1|cmd)$/i.test(f) || /(^|\/)(Square\d+x\d+Logo|StoreLogo)\.png$/.test(f)
  },
  {
    id: 'W6',
    label: 'Windows 러너',
    applies: (f) => /^\.github\/workflows\/[^/]+\.ya?ml$/.test(f),
    check: (text) => [...text.matchAll(/\bwindows-(latest|20\d\d)\b/g)].map((m) => m[0])
  },
  {
    id: 'W7',
    label: 'Windows 빌드 스크립트',
    applies: (f) => /^scripts\/[^/]+\.m?js$/.test(f) || f === 'package.json',
    check(text, f) {
      const body = f === 'package.json' ? Object.values(JSON.parse(text).scripts ?? {}).join('\n') : text
      const hits = [...body.matchAll(/x86_64-pc-windows[\w-]*/g)].map((m) => m[0])
      for (const m of body.matchAll(/--bundles[\s=]+([\w,]+)/g)) if (/\b(nsis|msi)\b/.test(m[1])) hits.push(m[0])
      return hits
    }
  }
]

export function checkWindowsExclusion(root, files = trackedFiles(root)) {
  const errors = []
  for (const f of files) {
    if (allowed(f)) continue
    for (const rule of RULES) {
      if (!rule.applies(f)) continue
      if (rule.byName) {
        if (rule.byName(f)) errors.push(`${rule.id} ${rule.label}: ${f}`)
        continue
      }
      const hits = rule.check(fs.readFileSync(path.join(root, f), 'utf-8'), f)
      for (const hit of hits) errors.push(`${rule.id} ${rule.label}: ${f} (${hit})`)
    }
  }
  return errors
}

function main() {
  const errors = checkWindowsExclusion(process.cwd())
  for (const e of errors) console.error(`[check:windows-exclusion] ${e}`)
  if (errors.length) process.exit(1)
  console.log('[check:windows-exclusion] Windows 전용 요소 0건')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
