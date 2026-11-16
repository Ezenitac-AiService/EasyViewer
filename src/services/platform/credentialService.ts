import type { WebDavConnection } from '@/types'
import { isTauriEnv, platformStorage } from '@/services/storage/platformAdapter'

const WEB_CREDENTIAL_STORAGE_KEY = 'webdav_credentials_web_consent_v2'

export interface SetCredentialOptions {
  remember?: boolean
  webStorageConsent?: boolean
  sessionOnly?: boolean
}

export interface PlatformCredentialPort {
  getPassword(connectionId: string): Promise<string>
  setPassword(connectionId: string, password: string, options?: SetCredentialOptions): Promise<void>
  removePassword(connectionId: string): Promise<void>
  migrateLegacyPlaintext(connections: WebDavConnection[]): Promise<{
    sanitized: WebDavConnection[]
    migratedCount: number
  }>
}

function accountKey(connectionId: string): string {
  return `easyviewer:webdav:${connectionId}`
}

async function readWebConsentedSecrets(): Promise<Record<string, string>> {
  const stored = await platformStorage.getItem<Record<string, string>>(WEB_CREDENTIAL_STORAGE_KEY, {})
  return stored && typeof stored === 'object' ? { ...stored } : {}
}

class DefaultCredentialService implements PlatformCredentialPort {
  private sessionSecrets = new Map<string, string>()

  async getPassword(connectionId: string): Promise<string> {
    if (!connectionId) return ''

    const inSession = this.sessionSecrets.get(connectionId)
    if (inSession !== undefined) return inSession

    if (isTauriEnv()) {
      try {
        const { getPasswords } = await import('tauri-plugin-keyring-store-api')
        const [secret] = await getPasswords([accountKey(connectionId)])
        if (typeof secret === 'string' && secret.length > 0) {
          return secret
        }
      } catch {
        // Keyring miss or unavailable; fall through cleanly
      }
      return ''
    }

    const webStored = await readWebConsentedSecrets()
    return typeof webStored[connectionId] === 'string' ? webStored[connectionId] : ''
  }

  async setPassword(
    connectionId: string,
    password: string,
    options: SetCredentialOptions = {}
  ): Promise<void> {
    if (!connectionId) {
      throw new Error('자격 증명 저장을 위한 연결 식별자가 필요합니다.')
    }

    const remember = Boolean(options.remember) && !options.sessionOnly
    if (!remember) {
      this.sessionSecrets.set(connectionId, password)
      return
    }

    this.sessionSecrets.set(connectionId, password)

    if (isTauriEnv()) {
      const { setPasswords } = await import('tauri-plugin-keyring-store-api')
      await setPasswords([{ account: accountKey(connectionId), secret: password }])
      return
    }

    if (!options.webStorageConsent) {
      throw new Error(
        '웹 환경에서 비밀번호를 저장하려면 브라우저 로컬 저장소 안내에 대한 명시적 동의(webStorageConsent)가 필요합니다.'
      )
    }

    const webStored = await readWebConsentedSecrets()
    webStored[connectionId] = password
    await platformStorage.setItem(WEB_CREDENTIAL_STORAGE_KEY, webStored)
  }

  async removePassword(connectionId: string): Promise<void> {
    if (!connectionId) return
    this.sessionSecrets.delete(connectionId)

    if (isTauriEnv()) {
      try {
        const { deletePasswords } = await import('tauri-plugin-keyring-store-api')
        await deletePasswords([accountKey(connectionId)])
      } catch {
        // Ignore if entry did not exist
      }
      return
    }

    const webStored = await readWebConsentedSecrets()
    if (connectionId in webStored) {
      delete webStored[connectionId]
      await platformStorage.setItem(WEB_CREDENTIAL_STORAGE_KEY, webStored)
    }
  }

  async migrateLegacyPlaintext(connections: WebDavConnection[]): Promise<{
    sanitized: WebDavConnection[]
    migratedCount: number
  }> {
    let migratedCount = 0
    const sanitized: WebDavConnection[] = []

    for (const raw of connections) {
      const legacyPassword = typeof raw.password === 'string' ? raw.password : ''
      const copy: WebDavConnection = { ...raw }
      delete copy.password

      if (legacyPassword) {
        migratedCount++
        if (isTauriEnv()) {
          await this.setPassword(raw.id, legacyPassword, { remember: true })
          copy.rememberPassword = true
          copy.credentialScope = 'native-secure'
        } else {
          // On web, never persist unconsented legacy plaintext back into storage; hold for active session only.
          await this.setPassword(raw.id, legacyPassword, { remember: false })
          copy.rememberPassword = false
          copy.credentialScope = 'session'
        }
      } else if (!copy.credentialScope) {
        copy.credentialScope = copy.rememberPassword
          ? isTauriEnv()
            ? 'native-secure'
            : 'web-acknowledged'
          : 'session'
      }

      sanitized.push(copy)
    }

    return { sanitized, migratedCount }
  }
}

export const platformCredential: PlatformCredentialPort = new DefaultCredentialService()
