import { isTauriEnv } from '@/services/storage/platformAdapter'

export interface PlatformPathPort {
  dirname(filePath: string): Promise<string>
  basename(filePath: string): string
}

export function extractBasename(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/').replace(/\/+$/, '')
  if (!normalized) return ''
  const idx = normalized.lastIndexOf('/')
  return idx >= 0 ? normalized.slice(idx + 1) : normalized
}

export function fallbackDirname(filePath: string): string {
  const lastForward = filePath.lastIndexOf('/')
  const lastBack = filePath.lastIndexOf('\\')
  const idx = Math.max(lastForward, lastBack)
  if (idx < 0) return ''
  if (idx === 0) return filePath[0]
  return filePath.slice(0, idx)
}

export class PlatformPathService implements PlatformPathPort {
  async dirname(filePath: string): Promise<string> {
    if (!filePath) return ''
    if (isTauriEnv()) {
      try {
        const { dirname } = await import('@tauri-apps/api/path')
        return await dirname(filePath)
      } catch {
        return fallbackDirname(filePath)
      }
    }
    return fallbackDirname(filePath)
  }

  basename(filePath: string): string {
    return extractBasename(filePath)
  }
}

export const platformPath = new PlatformPathService()
