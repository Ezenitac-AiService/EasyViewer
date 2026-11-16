import { ref } from 'vue'
import { StorageWriteError, type BookMeta } from '@/types'
import type { SelectedBookFile } from '@/services/platform/dialogService'

export type StorageRecoveryChoice = 'default' | 'choose' | 'cancel'

export interface LibraryImportProgress {
  current: number
  total: number
  fileName: string
}

export interface LibraryImportOptions {
  addBook: (file: SelectedBookFile) => Promise<{ book: BookMeta | { id: string }; deduplicated: boolean }>
  switchToDefaultStorage?: () => Promise<void>
  pickCustomStorage?: () => Promise<boolean>
  promptStorageRecovery?: (error: StorageWriteError) => Promise<StorageRecoveryChoice>
  showToast?: (message: string) => void
}

/**
 * Manages multi-file book imports with concurrency guards, progress feedback,
 * and StorageWriteError recovery actions.
 */
export function useLibraryImport(options: LibraryImportOptions) {
  const isImporting = ref(false)
  const importProgress = ref<LibraryImportProgress | null>(null)
  const importError = ref('')

  async function handleStorageWriteFailure(err: StorageWriteError): Promise<boolean> {
    if (!options.promptStorageRecovery) {
      importError.value = err.message
      return false
    }

    const choice = await options.promptStorageRecovery(err)
    if (choice === 'default' && options.switchToDefaultStorage) {
      await options.switchToDefaultStorage()
      options.showToast?.('기본 저장 폴더로 전환했습니다. 다시 가져오기를 시도해 주세요.')
      return true
    }
    if (choice === 'choose' && options.pickCustomStorage) {
      const switched = await options.pickCustomStorage()
      if (switched) {
        options.showToast?.('새 저장 폴더를 선택했습니다. 다시 가져오기를 시도해 주세요.')
      }
      return switched
    }
    return false
  }

  async function importSelectedFiles(files: SelectedBookFile[]): Promise<{
    addedCount: number
    deduplicatedCount: number
  }> {
    if (isImporting.value || files.length === 0) {
      return { addedCount: 0, deduplicatedCount: 0 }
    }

    isImporting.value = true
    importError.value = ''
    let addedCount = 0
    let deduplicatedCount = 0

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        importProgress.value = {
          current: i + 1,
          total: files.length,
          fileName: file.name
        }

        try {
          const result = await options.addBook(file)
          if (result.deduplicated) {
            deduplicatedCount++
          } else {
            addedCount++
          }
        } catch (err) {
          if (err instanceof StorageWriteError) {
            await handleStorageWriteFailure(err)
            break
          }
          const msg = err instanceof Error ? err.message : String(err)
          importError.value = msg
          options.showToast?.(`도서 추가 실패: ${msg}`)
        }
      }

      if (deduplicatedCount > 0 && addedCount === 0) {
        options.showToast?.('이미 서재에 등록된 도서입니다.')
      } else if (addedCount > 0) {
        options.showToast?.(
          files.length === 1
            ? '도서를 서재에 추가했습니다.'
            : `${addedCount}권의 도서를 서재에 추가했습니다.`
        )
      }
      return { addedCount, deduplicatedCount }
    } finally {
      isImporting.value = false
      importProgress.value = null
    }
  }

  return {
    isImporting,
    importProgress,
    importError,
    importSelectedFiles
  }
}
