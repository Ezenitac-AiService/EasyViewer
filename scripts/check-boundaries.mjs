import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const TARGET_DIRS = [
  'src/views',
  'src/stores',
  'src/components',
  'src/engines',
  'src/services/sync'
]

const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.vue'])

function walkFiles(dir) {
  if (!fs.existsSync(dir)) return []
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...walkFiles(full))
    } else if (entry.isFile() && SCAN_EXTENSIONS.has(path.extname(entry.name))) {
      out.push(full)
    }
  }
  return out
}

function isAllowedLocalBlobFetch(line) {
  return /\bfetch\s*\(\s*(?:blobUrl|['"`]blob:)/.test(line)
}

/**
 * Scans presentation, store, component, engine, and sync layers for architectural boundary violations.
 */
export function scanWorkspaceBoundaries(rootDir = process.cwd()) {
  const violations = []

  for (const relDir of TARGET_DIRS) {
    const absDir = path.join(rootDir, relDir)
    const isEngineDir = relDir === 'src/engines'

    for (const absFile of walkFiles(absDir)) {
      const relFile = path.relative(rootDir, absFile).replace(/\\/g, '/')
      const content = fs.readFileSync(absFile, 'utf-8')
      const lines = content.split(/\r?\n/)

      lines.forEach((rawLine, idx) => {
        const lineNum = idx + 1
        const trimmed = rawLine.trim()
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
          return
        }

        if (rawLine.includes('@tauri-apps/')) {
          violations.push({
            file: relFile,
            line: lineNum,
            rule: 'direct-tauri-import',
            detail: '플랫폼 추상화 경계(src/services/platform|storage|network) 외부에서 @tauri-apps/* 직접 참조 금지'
          })
        }

        if (/\blocalStorage\b/.test(rawLine)) {
          violations.push({
            file: relFile,
            line: lineNum,
            rule: 'direct-localstorage',
            detail: 'platformStorage 추상화를 우회하는 직접 localStorage 접근 금지'
          })
        }

        if (/\bindexedDB\b/.test(rawLine)) {
          violations.push({
            file: relFile,
            line: lineNum,
            rule: 'direct-indexeddb',
            detail: 'platformStorage 추상화를 우회하는 직접 indexedDB 접근 금지'
          })
        }

        if (/\bnew\s+XMLHttpRequest\b|\bXMLHttpRequest\b/.test(rawLine)) {
          violations.push({
            file: relFile,
            line: lineNum,
            rule: 'direct-network-call',
            detail: 'remoteFetch 추상화를 우회하는 XMLHttpRequest 사용 금지'
          })
        } else if (/\bfetch\s*\(/.test(rawLine) && !isAllowedLocalBlobFetch(rawLine)) {
          violations.push({
            file: relFile,
            line: lineNum,
            rule: 'direct-network-call',
            detail: 'remoteFetch 추상화를 우회하는 직접 fetch() 호출 금지(로컬 blob: 예외 제외)'
          })
        }

        if (
          isEngineDir &&
          (/['"]@\/(?:views|stores|services)\//.test(rawLine) ||
            /from\s+['"](?:\.\.\/)+?(?:views|stores|services)\//.test(rawLine))
        ) {
          violations.push({
            file: relFile,
            line: lineNum,
            rule: 'engine-upward-dependency',
            detail: 'src/engines/ 레이어에서 상위 views/stores/services 역의존 금지'
          })
        }
      })
    }
  }

  return { violations }
}

function main() {
  const { violations } = scanWorkspaceBoundaries(process.cwd())
  if (violations.length > 0) {
    console.error(`[check:boundaries] 경계 위반 ${violations.length}건 발견:`)
    for (const v of violations) {
      console.error(`  - ${v.file}:${v.line} [${v.rule}] ${v.detail}`)
    }
    process.exit(1)
  }
  console.log('[check:boundaries] 경계 위반 0건 — 모든 레이어 격리 규칙 통과')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
