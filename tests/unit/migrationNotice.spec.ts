// SPDX-License-Identifier: GPL-3.0-only
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { MigrationRecord } from '@/services/platform/migrationService'

/** spec 003 US6 / T067: MigrationNotice follows the contracts/data-migration.md §2 table. */

const fake = vi.hoisted(() => ({
  record: null as unknown,
  order: [] as string[],
  needsPrompt: false,
  migrateResult: { migrated: 1, missing: 0, failed: 0 },
  reconstructResult: { added: 0, skipped: 0, failed: 0 },
  connections: [] as unknown[]
}))

vi.mock('@/services/platform/migrationService', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/services/platform/migrationService')>()
  return {
    ...orig,
    platformMigration: {
      getRecord: vi.fn(async () => fake.record),
      acknowledge: vi.fn(async () => void fake.order.push('acknowledge')),
      markReconstructed: vi.fn(async () => void fake.order.push('markReconstructed')),
      countMigratableCredentials: (list: unknown[]) => list.length,
      needsKeychainPrompt: () => fake.needsPrompt,
      migrateCredentials: vi.fn(async () => {
        fake.order.push('migrateCredentials')
        return fake.migrateResult
      }),
      skipCredentials: vi.fn(async () => void fake.order.push('skipCredentials')),
      requestDiscardRestart: vi.fn(async () => void fake.order.push('requestDiscardRestart'))
    }
  }
})
vi.mock('@/services/platform/libraryReconstruction', () => ({
  createDesktopBookFileSource: () => ({}),
  reconstructLibrary: vi.fn(async () => {
    fake.order.push('reconstruct')
    return fake.reconstructResult
  })
}))
vi.mock('@/services/network/webdavService', () => ({
  loadWebDavHistory: vi.fn(async () => fake.connections)
}))

import MigrationNotice from '@/components/library/MigrationNotice.vue'
import { platformMigration } from '@/services/platform/migrationService'
import { useBookStore } from '@/stores/useBookStore'

function record(over: Partial<MigrationRecord> = {}): MigrationRecord {
  return {
    schema: 1,
    state: 'migrated',
    sourceIdentifier: 'com.edith.easyviewer',
    startedAt: '2026-11-18T00:00:00Z',
    finishedAt: '2026-11-18T00:00:01Z',
    copied: { dataDir: true, webviewStore: true },
    skippedEntries: 0,
    reconstructed: true,
    noticeAcknowledged: false,
    credentials: { migrated: 0, missing: 0, failed: 0 },
    ...over
  }
}

async function mountNotice() {
  const store = useBookStore()
  store.isInitialized = true
  const wrapper = mount(MigrationNotice, { attachTo: document.body })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  fake.record = null
  fake.order = []
  fake.needsPrompt = false
  fake.migrateResult = { migrated: 1, missing: 0, failed: 0 }
  fake.reconstructResult = { added: 0, skipped: 0, failed: 0 }
  fake.connections = []
  vi.clearAllMocks()
})
afterEach(() => {
  document.body.innerHTML = ''
  document.documentElement.className = ''
})

describe('MigrationNotice', () => {
  it('renders nothing without a record or after acknowledgement', async () => {
    let w = await mountNotice()
    expect(w.find('[role="dialog"]').exists()).toBe(false)
    w.unmount()
    fake.record = record({ noticeAcknowledged: true })
    w = await mountNotice()
    expect(w.find('[role="dialog"]').exists()).toBe(false)
  })

  it('migrated: says the original stays, warns about mixed upstream data and offers discard', async () => {
    fake.record = record()
    const w = await mountNotice()
    const text = w.text()
    expect(text).toContain('이전 버전 데이터를 옮겼습니다')
    expect(text).toContain('원본은 원래 위치에 그대로')
    expect(text).toContain('원저작자 앱이 만든 데이터가 섞여 있을 수 있습니다')
    expect(w.find('[data-testid="migration-discard"]').exists()).toBe(true)
  })

  it('discard asks for confirmation, records discard_pending via restart and deletes nothing now', async () => {
    fake.record = record()
    const w = await mountNotice()
    await w.find('[data-testid="migration-discard"]').trigger('click')
    expect(platformMigration.requestDiscardRestart).not.toHaveBeenCalled()
    expect(w.text()).toContain('앱이 다시 시작됩니다')
    await w.find('[data-testid="migration-discard-confirm"]').trigger('click')
    await flushPromises()
    expect(fake.order).toEqual(['requestDiscardRestart'])
  })

  it('declined: explains nothing was moved and how to recover manually', async () => {
    fake.record = record({ state: 'declined', copied: { dataDir: false, webviewStore: false } })
    const text = (await mountNotice()).text()
    expect(text).toContain('이전 버전 데이터를 옮기지 않았습니다')
    expect(text).toContain('원본은 원래 위치에 그대로')
    expect(text).toContain('책 파일을 다시 가져오')
  })

  it('failed: keeps the original and shows the manual recovery with the error category', async () => {
    fake.record = record({ state: 'failed', error: 'busy', copied: { dataDir: false, webviewStore: false } })
    const w = await mountNotice()
    expect(w.text()).toContain('옮기지 못했습니다')
    expect(w.text()).toContain('원본은 원래 위치에 그대로')
    expect(w.text()).toContain('책 파일을 다시 가져오')
    expect(w.text()).toContain('데이터를 쓰고 있었습니다')
    expect(w.find('[data-testid="migration-discard"]').exists()).toBe(false)
  })

  it('kept-new: says the new location won without merging', async () => {
    fake.record = record({ state: 'skipped_target_not_empty', copied: { dataDir: false, webviewStore: false } })
    expect((await mountNotice()).text()).toContain('새 위치의 데이터를 우선했습니다')
  })

  it('partial or an unread WebView store: rebuilds the library once and lists the lost items', async () => {
    fake.record = record({ state: 'partial', reconstructed: false })
    fake.reconstructResult = { added: 3, skipped: 0, failed: 0 }
    const w = await mountNotice()
    expect(fake.order.slice(0, 2)).toEqual(['reconstruct', 'markReconstructed'])
    expect(w.text()).toContain('책 파일 3권')
    for (const lost of ['읽기 진행률', '책갈피', '표시 설정']) expect(w.text()).toContain(lost)
  })

  it('tells the user which book files could not be added during the rebuild', async () => {
    fake.record = record({ state: 'migrated', reconstructed: false, noticeAcknowledged: true })
    fake.reconstructResult = { added: 0, skipped: 1, failed: 2 }
    const w = await mountNotice()
    // Shown even after the main notice was acknowledged, because it is new information.
    expect(w.find('[role="dialog"]').exists()).toBe(true)
    expect(w.text()).toContain('책 파일 2개')
    expect(w.text()).toContain('손상되었거나')
    expect(w.text()).toContain('[책 추가]')
  })

  it('does not rebuild twice', async () => {
    fake.record = record({ reconstructed: true })
    await mountNotice()
    expect(fake.order).not.toContain('reconstruct')
  })

  it('macOS: warns about up to N keychain prompts and lets the user migrate or skip', async () => {
    fake.record = record({ credentials: undefined })
    fake.connections = [{ id: 'a' }, { id: 'b' }]
    fake.needsPrompt = true
    let w = await mountNotice()
    expect(w.text()).toContain('최대 2번')
    expect(platformMigration.migrateCredentials).not.toHaveBeenCalled()
    await w.find('[data-testid="credentials-skip"]').trigger('click')
    await flushPromises()
    expect(fake.order).toContain('skipCredentials')
    expect(platformMigration.migrateCredentials).not.toHaveBeenCalled()
    w.unmount()

    fake.order = []
    w = await mountNotice()
    await w.find('[data-testid="credentials-migrate"]').trigger('click')
    await flushPromises()
    expect(fake.order).toContain('migrateCredentials')
  })

  it('without a keychain prompt migrates automatically and asks to re-enter failed connections', async () => {
    fake.record = record({ credentials: undefined })
    fake.connections = [{ id: 'a' }, { id: 'b' }]
    fake.migrateResult = { migrated: 1, missing: 0, failed: 1 }
    const w = await mountNotice()
    expect(fake.order).toContain('migrateCredentials')
    expect(w.text()).toContain('연결 1개')
    expect(w.text()).toContain('다시 입력')
  })

  it('closes with the button, Escape and a backdrop tap, acknowledging once', async () => {
    for (const how of ['button', 'escape', 'backdrop'] as const) {
      fake.record = record()
      fake.order = []
      const w = await mountNotice()
      if (how === 'button') await w.find('[data-testid="migration-close"]').trigger('click')
      if (how === 'escape') document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      if (how === 'backdrop') await w.find('[data-testid="migration-backdrop"]').trigger('click')
      await flushPromises()
      expect(w.find('[role="dialog"]').exists(), how).toBe(false)
      expect(fake.order.filter((o) => o === 'acknowledge'), how).toHaveLength(1)
      w.unmount()
    }
  })

  it.each(['light', 'dark', 'sepia'])('renders an accessible dialog in the %s theme', async (theme) => {
    document.documentElement.className = theme
    fake.record = record()
    const w = await mountNotice()
    const dialog = w.find('[role="dialog"]')
    expect(dialog.attributes('aria-modal')).toBe('true')
    expect(dialog.attributes('aria-labelledby')).toBeTruthy()
    expect(dialog.attributes('style')).toContain('var(--ev-surface)')
  })
})
