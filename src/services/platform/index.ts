import type { PlatformCapabilities } from '@/types'
import { isDesktopApp, isTauriEnv, platformStorage } from '@/services/storage/platformAdapter'
import {
  isSupportedBookFileName,
  MAX_LOCAL_BOOK_BYTES,
  platformDialog,
  type PickBookFilesResult,
  type PlatformDialogPort,
  type SelectedBookFile
} from '@/services/platform/dialogService'
import { platformPath, type PlatformPathPort } from '@/services/platform/pathService'
import {
  platformDragDrop,
  type DroppedBookInput,
  type PlatformDragDropPort
} from '@/services/platform/dragDropService'
import { isAllowedExternalUrl, openExternalLink } from '@/services/platform/externalLink'
import {
  platformCredential,
  type PlatformCredentialPort,
  type SetCredentialOptions
} from '@/services/platform/credentialService'

export async function getPlatformCapabilities(): Promise<PlatformCapabilities> {
  const desktop = await isDesktopApp()
  const tauri = isTauriEnv()
  return {
    canPickStorageDir: desktop,
    canOpenStorageDir: desktop,
    canDeleteLocalFile: desktop,
    supportsNativeDragDrop: desktop || tauri,
    hasSecureCredentialStore: tauri
  }
}

export {
  isAllowedExternalUrl,
  isDesktopApp,
  openExternalLink,
  isSupportedBookFileName,
  isTauriEnv,
  MAX_LOCAL_BOOK_BYTES,
  platformCredential,
  platformDialog,
  platformDragDrop,
  platformPath,
  platformStorage,
  type DroppedBookInput,
  type PickBookFilesResult,
  type PlatformCredentialPort,
  type PlatformDialogPort,
  type PlatformDragDropPort,
  type PlatformPathPort,
  type SelectedBookFile,
  type SetCredentialOptions
}
