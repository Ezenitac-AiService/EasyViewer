import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import SyncModal from '@/components/library/SyncModal.vue'
import { useBookStore } from '@/stores/useBookStore'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { RemoteFetchConsentError } from '@/services/network/remoteFetch'
import * as remoteFetchModule from '@/services/network/remoteFetch'

describe('SyncModal consent & error handling (T062)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
  })

  it('shows error banner on handleRunSync failure and grants TrustedRemoteHostConsent + retries sync', async () => {
    const settingsStore = useSettingsStore()
    settingsStore.settings.syncEndpoint = 'http://192.168.1.50:8080/sync'

    const bookStore = useBookStore()
    const syncSpy = vi
      .spyOn(bookStore, 'syncNow')
      .mockRejectedValueOnce(
        new RemoteFetchConsentError(
          'PRIVATE_NETWORK_CONFIRM_REQUIRED',
          'http://192.168.1.50:8080',
          '사설 네트워크 접근에는 사용자 승인이 필요합니다.'
        )
      )
      .mockResolvedValueOnce({
        updatedCount: 2,
        message: '원격 서버 동기화 완료 (2건 갱신)'
      })
    const grantSpy = vi
      .spyOn(remoteFetchModule, 'grantHostConsent')
      .mockResolvedValue({
        hostKey: 'http://192.168.1.50:8080',
        allowPrivateNetwork: true,
        allowSelfSignedTls: false,
        consentedAt: Date.now()
      })

    const wrapper = mount(SyncModal, {
      props: { open: true }
    })

    const runBtn = wrapper.find('[data-testid="run-sync-btn"]')
    expect(runBtn.exists()).toBe(true)
    await runBtn.trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="sync-consent-banner"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('http://192.168.1.50:8080')

    await wrapper.find('[data-testid="approve-sync-consent-btn"]').trigger('click')
    await flushPromises()

    expect(grantSpy).toHaveBeenCalledWith('http://192.168.1.50:8080/sync', {
      allowPrivateNetwork: true,
      allowSelfSignedTls: undefined
    })
    expect(syncSpy).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[data-testid="sync-consent-banner"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('원격 서버 동기화 완료 (2건 갱신)')
  })

  it('renders error message without unhandled rejection when BLOCKED_HIGH_RISK occurs', async () => {
    const settingsStore = useSettingsStore()
    settingsStore.settings.syncEndpoint = 'http://127.0.0.1:8080/sync'

    const bookStore = useBookStore()
    vi.spyOn(bookStore, 'syncNow').mockRejectedValueOnce(
      new RemoteFetchConsentError(
        'BLOCKED_HIGH_RISK',
        'http://127.0.0.1:8080',
        '보안 정책에 의해 차단된 내부 네트워크 주소입니다.'
      )
    )

    const wrapper = mount(SyncModal, {
      props: { open: true }
    })

    await wrapper.find('[data-testid="run-sync-btn"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="sync-consent-banner"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="sync-error-banner"]').text()).toContain('차단')
  })
})
