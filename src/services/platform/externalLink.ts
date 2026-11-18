// SPDX-License-Identifier: GPL-3.0-only
import { isTauriEnv } from '@/services/storage/platformAdapter'

/**
 * Allow-listed external links (spec 003 FR-004, contracts/about-screen.md §3).
 * The Rust capability (opener:allow-open-url) holds the same four patterns; this is the
 * frontend half of the double check required by constitution principle VII.
 */
const ALLOWED_REPO_PATHS = ['/Ezenitac-AiService/EasyViewer', '/edith2580/EasyViewer'] as const

export function isAllowedExternalUrl(raw: string): boolean {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 2048) return false
  // Reject dot segments before URL normalisation can hide them.
  if (/(^|\/)\.\.?(\/|$)/.test(raw.replace(/^https:\/\/[^/]+/, ''))) return false
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return false
  }
  if (url.protocol !== 'https:') return false
  if (url.hostname !== 'github.com' || url.port !== '') return false
  if (url.username !== '' || url.password !== '') return false
  return ALLOWED_REPO_PATHS.some(
    (prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`)
  )
}

/** Opens an allow-listed URL in the system browser. Returns false (and opens nothing) otherwise. */
export async function openExternalLink(raw: string): Promise<boolean> {
  if (!isAllowedExternalUrl(raw)) return false
  if (isTauriEnv()) {
    const { openUrl } = await import('@tauri-apps/plugin-opener')
    await openUrl(raw)
    return true
  }
  window.open(raw, '_blank', 'noopener,noreferrer')
  return true
}
