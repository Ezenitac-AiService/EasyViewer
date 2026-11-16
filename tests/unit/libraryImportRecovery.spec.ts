import { describe, it, expect, vi, beforeEach } from 'vitest'
import { StorageWriteError } from '@/types'
import { useLibraryImport } from '@/composables/library/useLibraryImport'
import type { SelectedBookFile } from '@/services/platform/dialogService'

describe('useLibraryImport recovery, progress & duplicate guard (T027)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('tracks multi-file import progress, prevents concurrent duplicate imports, and supports StorageWriteError recovery', async () => {
    let releaseFirst!: () => void
    const addBook = vi.fn(async (file: SelectedBookFile) => {
      if (file.name === 'first.epub') {
        await new Promise<void>((resolve) => {
          releaseFirst = resolve
        })
        return { book: { id: 'b1' }, deduplicated: false }
      }
      if (file.name === 'fail.epub') {
        throw new StorageWriteError('Disk full or read-only', '/readonly/books')
      }
      return { book: { id: 'b2' }, deduplicated: false }
    })

    const switchToDefaultStorage = vi.fn().mockResolvedValue(undefined)
    const pickCustomStorage = vi.fn().mockResolvedValue(true)
    const promptStorageRecovery = vi.fn().mockResolvedValue('default' as const)
    const showToast = vi.fn()

    const importer = useLibraryImport({
      addBook,
      switchToDefaultStorage,
      pickCustomStorage,
      promptStorageRecovery,
      showToast
    })

    const files: SelectedBookFile[] = [
      { name: 'first.epub', size: 100, readBuffer: async () => new ArrayBuffer(10) },
      { name: 'fail.epub', size: 100, readBuffer: async () => new ArrayBuffer(10) }
    ]

    const firstRun = importer.importSelectedFiles(files)
    expect(importer.isImporting.value).toBe(true)

    // Concurrent duplicate import attempt should be ignored while in progress
    await importer.importSelectedFiles([files[0]])
    expect(addBook).toHaveBeenCalledTimes(1)

    releaseFirst()
    await firstRun

    expect(importer.isImporting.value).toBe(false)
    expect(promptStorageRecovery).toHaveBeenCalledTimes(1)
    expect(switchToDefaultStorage).toHaveBeenCalledTimes(1)
  })

  it('uses InAppConfirmModal instead of window.confirm in web environment', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { webConfirmDialogState, resolveWebConfirmDialog, TauriOrWebDialogService } = await import(
      '@/services/platform/dialogService'
    )
    const svc = new TauriOrWebDialogService()
    const promise = svc.confirmAction({
      title: '도서 삭제',
      message: '정말 삭제하시겠습니까?',
      kind: 'warning'
    })
    expect(webConfirmDialogState.value?.open).toBe(true)
    expect(confirmSpy).not.toHaveBeenCalled()
    resolveWebConfirmDialog(true)
    await expect(promise).resolves.toBe(true)
  })

  it('renders importProgress banner while LibraryView is importing and reports deduplicated books (T045)', async () => {
    const { createPinia, setActivePinia } = await import('pinia')
    const { mount, flushPromises } = await import('@vue/test-utils')
    const { createMemoryHistory, createRouter } = await import('vue-router')
    const { useBookStore } = await import('@/stores/useBookStore')
    const { default: LibraryView } = await import('@/views/LibraryView.vue')

    setActivePinia(createPinia())
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', name: 'library', component: { template: '<div />' } },
        { path: '/reader/:id', name: 'reader', component: { template: '<div />' } }
      ]
    })

    const bookStore = useBookStore()
    let releaseImport!: () => void
    const existingBook = {
      id: 'dup-book-1',
      title: 'Existing Book',
      author: 'Author',
      format: 'txt' as const,
      addedAt: 1,
      fileSize: 50,
      isOfflineCached: true
    }
    bookStore.books.push(existingBook)
    vi.spyOn(bookStore, 'initLibrary').mockResolvedValue(undefined)
    vi.spyOn(bookStore, 'addBookFromBuffer').mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseImport = () => resolve(existingBook)
        })
    )

    const wrapper = mount(LibraryView, {
      global: { plugins: [router] }
    })
    await flushPromises()

    const input = wrapper.get('input[type="file"]')
    const file = new File(['hello duplicate content'], 'dup.txt', { type: 'text/plain' })
    Object.defineProperty(file, 'arrayBuffer', {
      value: async () => new TextEncoder().encode('hello duplicate content').buffer
    })
    Object.defineProperty(input.element, 'files', {
      value: [file],
      configurable: true
    })

    const changePromise = input.trigger('change')
    await flushPromises()

    expect(wrapper.find('[data-testid="import-progress-banner"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('dup.txt')

    releaseImport()
    await changePromise
    await flushPromises()

    expect(wrapper.find('[data-testid="import-progress-banner"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('이미 서재에 등록된 도서입니다.')
  })
})
