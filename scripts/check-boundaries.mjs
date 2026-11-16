import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const TARGET_DIRS = ['src/views', 'src/stores', 'src/components', 'src/engines', 'src/services/sync']
const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.vue'])
const LINE_LIMIT_ROOTS = [
  { dir: 'src', exts: new Set(['.ts', '.vue']) },
  { dir: 'src-tauri/src', exts: new Set(['.rs']) },
  { dir: 'scripts', exts: new Set(['.mjs']) }
]
const APPROVED_SIZE_EXCEPTIONS = {}

function walkFiles(dir, exts) {
  if (!fs.existsSync(dir)) return []
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...walkFiles(full, exts))
    } else if (entry.isFile() && exts.has(path.extname(entry.name))) {
      out.push(full)
    }
  }
  return out
}

function isAllowedLocalBlobFetch(line) {
  return /\bfetch\s*\(\s*(?:blobUrl|['"`]blob:)/.test(line)
}

/**
 * Scans presentation, store, component, engine, sync, and production source line limits.
 */
export function scanWorkspaceBoundaries(rootDir = process.cwd(), options = {}) {
  const {
    enforceMaxLines = true,
    forbidViewPlatformStorage = true,
    maxLines = 450,
    sizeExceptions = APPROVED_SIZE_EXCEPTIONS
  } = options
  const violations = []

  for (const relDir of TARGET_DIRS) {
    const absDir = path.join(rootDir, relDir)
    const isEngineDir = relDir === 'src/engines'
    const isViewOrStoreDir = relDir === 'src/views' || relDir === 'src/stores'

    for (const absFile of walkFiles(absDir, SCAN_EXTENSIONS)) {
      const relFile = path.relative(rootDir, absFile).replace(/\\/g, '/')
      const lines = fs.readFileSync(absFile, 'utf-8').split(/\r?\n/)

      lines.forEach((rawLine, idx) => {
        const lineNum = idx + 1
        const trimmed = rawLine.trim()
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return

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
        if (forbidViewPlatformStorage && relDir === 'src/views' && /\bplatformStorage\b/.test(rawLine)) {
          violations.push({
            file: relFile,
            line: lineNum,
            rule: 'view-direct-storage',
            detail: 'src/views/에서 platformStorage 직접 호출 금지 (useBookStore/도메인 서비스 경유 필수)'
          })
        }
        if (
          forbidViewPlatformStorage &&
          isViewOrStoreDir &&
          /from\s+['"](?:epubjs|jszip)(?:\/|['"])|import\s*\(\s*['"](?:epubjs|jszip)/.test(rawLine)
        ) {
          violations.push({
            file: relFile,
            line: lineNum,
            rule: 'direct-epub-lib-import',
            detail: 'views/stores에서 epubjs/jszip 직접 임포트 금지 (DocumentReaderPort/metadataExtractor 경유 필수)'
          })
        }
      })
    }
  }

  if (enforceMaxLines) {
    for (const { dir, exts } of LINE_LIMIT_ROOTS) {
      for (const absFile of walkFiles(path.join(rootDir, dir), exts)) {
        const relFile = path.relative(rootDir, absFile).replace(/\\/g, '/')
        const lineCount = fs.readFileSync(absFile, 'utf-8').split(/\r?\n/).length
        if (lineCount > maxLines && !sizeExceptions[relFile]) {
          violations.push({
            file: relFile,
            line: lineCount,
            rule: 'max-lines-exceeded',
            detail: `단일 프로덕션 파일 길이(${lineCount}줄)가 상한(${maxLines}줄)을 초과했습니다.`
          })
        }
      }
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
