import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

const mockPickStorageDirectory = vi.fn().mockResolvedValue('/mock/storage/folder')
const mockConfirmAction = vi.fn().mockResolvedValue(true)
const mockSubscribe = vi.fn().mockResolvedValue(() => {})
const mockSetStorageDir = vi.fn().mockResolvedValue(undefined)
const mockGetStorageDir = vi.fn().mockResolvedValue('/mock/default')

vi.mock('@/services/platform', () => ({
  getPlatformCapabilities: vi.fn().mockResolvedValue({
    canPickStorageDir: true,
    canOpenStorageDir: true,
    canDeleteLocalFile: true,
    supportsNativeDragDrop: true,
    hasSecureCredentialStore: true
  }),
  platformDialog: {
    pickBookFiles: vi.fn().mockResolvedValue({ files: [], cancelled: true }),
    pickStorageDirectory: mockPickStorageDirectory,
    confirmAction: mockConfirmAction
  },
  platformPath: {
    dirname: vi.fn().mockResolvedValue('/mock/storage'),
    basename: vi.fn((p: string) => p.split('/').pop() || p)
  },
  platformDragDrop: {
    subscribe: mockSubscribe
  },
  platformStorage: {
    getStorageDir: mockGetStorageDir,
    isCustomStorageDir: vi.fn().mockResolvedValue(false),
    setStorageDir: mockSetStorageDir,
    openStorageDir: vi.fn().mockResolvedValue(undefined),
    allowStorageDirs: vi.fn().mockResolvedValue(undefined),
    migrateLegacyBookFile: vi.fn().mockResolvedValue(undefined),
    saveBookFile: vi.fn().mockResolvedValue('/mock/storage/book.txt'),
    loadBookBinary: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    removeBookBinary: vi.fn().mockResolvedValue(undefined),
    setItem: vi.fn().mockResolvedValue(undefined),
    getItem: vi.fn().mockImplementation(async (_k: string, def: unknown) => def)
  },
  isTauriEnv: () => false,
  isDesktopApp: async () => true
}))

describe('LibraryView platform boundary integration (US2)', () => {
  it('routes drag-drop subscription, folder selection, and delete confirmation through platform ports', async () => {
    setActivePinia(createPinia())
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', name: 'library', component: { template: '<div />' } },
        { path: '/reader/:id', name: 'reader', component: { template: '<div />' } }
      ]
    })

    const { useBookStore } = await import('@/stores/useBookStore')
    const bookStore = useBookStore()
    const { default: LibraryView } = await import('@/views/LibraryView.vue')

    const wrapper = mount(LibraryView, {
      global: {
        plugins: [router]
      }
    })

    await vi.waitFor(() => {
      expect(mockSubscribe).toHaveBeenCalledTimes(1)
    })

    await bookStore.addBookFromBuffer(new TextEncoder().encode('본문').buffer, '경계테스트.txt', 'txt')
    await bookStore.setDeleteFileOnRemove(true)
    await wrapper.vm.$nextTick()

    const folderToggle = wrapper.find('button[title="소설 저장 폴더"]')
    expect(folderToggle.exists()).toBe(true)
    await folderToggle.trigger('click')
    const changeBtn = wrapper.findAll('button').find((b) => b.text().includes('폴더 변경'))
    expect(changeBtn).toBeDefined()
    await changeBtn!.trigger('click')

    await vi.waitFor(() => {
      expect(mockPickStorageDirectory).toHaveBeenCalled()
      expect(mockSetStorageDir).toHaveBeenCalledWith('/mock/storage/folder')
    })

    const deleteBtn = wrapper.findAll('button').find((b) => (b.attributes('title') || '').includes('서재에서 삭제'))
    expect(deleteBtn).toBeDefined()
    await deleteBtn!.trigger('click')

    await vi.waitFor(() => {
      expect(mockConfirmAction).toHaveBeenCalled()
    })

    wrapper.unmount()
  })
})
