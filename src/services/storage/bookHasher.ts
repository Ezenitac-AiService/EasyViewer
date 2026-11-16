/**
 * Computes full-content SHA-256 fingerprint using pure Web Crypto (browser & Node 24 compatible).
 */
export async function computeBufferSha256(buffer: ArrayBuffer): Promise<string> {
  const view = new Uint8Array(buffer)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', view)
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return `sha256-${hex}`
}

export function dataUriToBlob(dataUri: string): Blob | null {
  const match = /^data:([^;,]+)?;base64,(.+)$/i.exec(dataUri.trim())
  if (!match) return null
  try {
    const mime = match[1] || 'image/jpeg'
    const binary = atob(match[2])
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return new Blob([bytes], { type: mime })
  } catch {
    return null
  }
}
