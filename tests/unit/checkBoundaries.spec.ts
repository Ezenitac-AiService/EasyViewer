import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { scanWorkspaceBoundaries } from '../../scripts/check-boundaries.mjs'

describe('check-boundaries static boundary enforcement (US4 - TDD)', () => {
  const tempDirs: string[] = []

  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop()
      if (dir) fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it('passes with zero violations on the real EasyViewer workspace', () => {
    const result = scanWorkspaceBoundaries(process.cwd())
    expect(result.violations).toEqual([])
  })

  it('detects direct @tauri-apps/*, localStorage, indexedDB, network fetch/XHR, and engine upward imports while allowing local blob: fetch', () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ev-boundaries-'))
    tempDirs.push(tmpRoot)

    fs.mkdirSync(path.join(tmpRoot, 'src/views'), { recursive: true })
    fs.mkdirSync(path.join(tmpRoot, 'src/stores'), { recursive: true })
    fs.mkdirSync(path.join(tmpRoot, 'src/engines/epub'), { recursive: true })
    fs.mkdirSync(path.join(tmpRoot, 'src/services/platform'), { recursive: true })

    fs.writeFileSync(
      path.join(tmpRoot, 'src/views/BadView.vue'),
      `<script setup lang="ts">\nimport { invoke } from '@tauri-apps/api/core'\nlocalStorage.setItem('x', '1')\n</script>\n`
    )
    fs.writeFileSync(
      path.join(tmpRoot, 'src/stores/BadStore.ts'),
      `export const x = indexedDB.open('db')\nexport const y = fetch('https://evil.example.com')\n`
    )
    fs.writeFileSync(
      path.join(tmpRoot, 'src/engines/epub/BadEngine.ts'),
      `import { useBookStore } from '@/stores/useBookStore'\nconst r = new XMLHttpRequest()\n`
    )
    fs.writeFileSync(
      path.join(tmpRoot, 'src/engines/epub/AllowedBlob.ts'),
      `export async function readBlob(blobUrl: string) { return fetch(blobUrl) }\n`
    )
    // Platform service layer itself is allowed to touch @tauri-apps/*
    fs.writeFileSync(
      path.join(tmpRoot, 'src/services/platform/nativeAdapter.ts'),
      `export const load = () => import('@tauri-apps/api/core')\n`
    )

    const result = scanWorkspaceBoundaries(tmpRoot)
    const rules = result.violations.map((v) => `${path.basename(v.file)}:${v.rule}`)
    expect(rules).toContain('BadView.vue:direct-tauri-import')
    expect(rules).toContain('BadView.vue:direct-localstorage')
    expect(rules).toContain('BadStore.ts:direct-indexeddb')
    expect(rules).toContain('BadStore.ts:direct-network-call')
    expect(rules).toContain('BadEngine.ts:engine-upward-dependency')
    expect(rules).toContain('BadEngine.ts:direct-network-call')
    expect(rules.some((r) => r.startsWith('AllowedBlob.ts:'))).toBe(false)
    expect(rules.some((r) => r.startsWith('nativeAdapter.ts:'))).toBe(false)
  })

  it('rejects files exceeding 450 lines, direct platformStorage calls in views, and direct epubjs/jszip imports in views/stores (T008)', () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ev-size-limit-'))
    tempDirs.push(tmpRoot)

    fs.mkdirSync(path.join(tmpRoot, 'src/views'), { recursive: true })
    fs.mkdirSync(path.join(tmpRoot, 'src/stores'), { recursive: true })
    fs.mkdirSync(path.join(tmpRoot, 'src-tauri/src'), { recursive: true })

    fs.writeFileSync(
      path.join(tmpRoot, 'src/views/StorageLeakView.vue'),
      `<script setup lang="ts">\nimport { platformStorage } from '@/services/storage/platformAdapter'\nawait platformStorage.getStorageDir()\n</script>\n`
    )
    fs.writeFileSync(
      path.join(tmpRoot, 'src/stores/EpubLeakStore.ts'),
      `import ePub from 'epubjs'\nexport const x = ePub\n`
    )
    fs.writeFileSync(
      path.join(tmpRoot, 'src-tauri/src/oversized.rs'),
      Array.from({ length: 452 }, (_, idx) => `// line ${idx + 1}`).join('\n')
    )

    const result = scanWorkspaceBoundaries(tmpRoot)
    const rules = result.violations.map((v) => `${path.basename(v.file)}:${v.rule}`)
    expect(rules).toContain('StorageLeakView.vue:view-direct-storage')
    expect(rules).toContain('EpubLeakStore.ts:direct-epub-lib-import')
    expect(rules).toContain('oversized.rs:max-lines-exceeded')
  })
})
