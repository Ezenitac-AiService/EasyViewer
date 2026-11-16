import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import WebDavExplorerView from '@/components/library/WebDavExplorerView.vue'
import RemoteUrlDownloadTab from '@/components/library/RemoteUrlDownloadTab.vue'
import * as remoteFetchModule from '@/services/network/remoteFetch'
import { RemoteFetchConsentError } from '@/services/network/remoteFetch'
import { useBookStore } from '@/stores/useBookStore'
import type { WebDavItem } from '@/types'

describe('NetworkDownloadModal & WebDavExplorerView orchestration (T037)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
  })

  it('sorts WebDavExplorerView folders before files and filters by search query', async () => {
    const items: WebDavItem[] = [
      { name: 'b-novel.epub', path: '/b-novel.epub', isDirectory: false, size: 2048, format: 'epub' },
      { name: 'FolderA', path: '/FolderA', isDirectory: true },
      { name: 'a-poem.txt', path: '/a-poem.txt', isDirectory: false, size: 512, format: 'txt' }
    ]

    const wrapper = mount(WebDavExplorerView, {
      props: {
        serverUrl: 'https://nas.example.com',
        currentPath: '/',
        items,
        isConnecting: false,
        downloadingItemPath: '',
        downloadedPaths: new Set<string>(),
        errorMessage: '',
        toastMessage: ''
      }
    })

    const itemButtons = wrapper.findAll('main button')
    expect(itemButtons).toHaveLength(3)
    expect(itemButtons[0].text()).toContain('FolderA')
    expect(itemButtons[1].text()).toContain('a-poem.txt')
    expect(itemButtons[2].text()).toContain('b-novel.epub')

    await wrapper.get('input[placeholder*="이름 검색"]').setValue('poem')
    const filtered = wrapper.findAll('main button')
    expect(filtered).toHaveLength(1)
    expect(filtered[0].text()).toContain('a-poem.txt')
  })

  it('prompts private-network consent on RemoteUrlDownloadTab and retries after approval', async () => {
    const store = useBookStore()
    const importSpy = vi
      .spyOn(store, 'importFromUrl')
      .mockRejectedValueOnce(
        new RemoteFetchConsentError(
          'PRIVATE_NETWORK_CONFIRM_REQUIRED',
          'http://192.168.0.10',
          '사설망 연결 확인이 필요합니다.'
        )
      )
      .mockResolvedValueOnce({
        id: 'book-remote-1',
        title: 'Remote Novel',
        author: 'Author',
        format: 'txt',
        addedAt: Date.now(),
        fileSize: 120,
        isOfflineCached: true
      })

    const wrapper = mount(RemoteUrlDownloadTab)
    vi.spyOn(remoteFetchModule, 'grantHostConsent').mockResolvedValue(undefined)
    await wrapper.get('input[type="url"]').setValue('http://192.168.0.10/novel.txt')
    await wrapper.get('form').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.text()).toContain('사설 네트워크(http://192.168.0.10)')
    await wrapper.get('button:not([type="submit"])').trigger('click')
    await flushPromises()

    expect(importSpy).toHaveBeenCalledTimes(2)
    expect(wrapper.emitted('downloaded')).toBeTruthy()
    expect(wrapper.emitted('close')).toBeTruthy()
  })
})
