import type { CoverAssetRecord, LocationIndexCacheRecord } from '@/types'
import {
  STORE_BOOK_COVERS,
  STORE_BOOK_FILES,
  STORE_KEY_VALUE,
  STORE_LOCATION_INDEXES,
  getIdbConnection,
  idbRequest,
  idbTransactionDone
} from './idbClient'

export async function idbGetBookFile(bookId: string): Promise<ArrayBuffer | null> {
  const db = await getIdbConnection()
  const tx = db.transaction(STORE_BOOK_FILES, 'readonly')
  const res = await idbRequest<ArrayBuffer | undefined>(tx.objectStore(STORE_BOOK_FILES).get(bookId))
  return res || null
}

export async function idbPutBookFile(bookId: string, data: ArrayBuffer): Promise<void> {
  const db = await getIdbConnection()
  const tx = db.transaction(STORE_BOOK_FILES, 'readwrite')
  tx.objectStore(STORE_BOOK_FILES).put(data, bookId)
  await idbTransactionDone(tx)
}

export async function idbRemoveBookFile(bookId: string): Promise<void> {
  const db = await getIdbConnection()
  const tx = db.transaction(STORE_BOOK_FILES, 'readwrite')
  tx.objectStore(STORE_BOOK_FILES).delete(bookId)
  await idbTransactionDone(tx)
}

async function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') {
    return blob.arrayBuffer()
  }
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result)
        return
      }
      reject(new Error('Failed to read blob as ArrayBuffer'))
    }
    reader.onerror = () => reject(reader.error ?? new Error('FileReader error'))
    reader.readAsArrayBuffer(blob)
  })
}

export async function saveCoverBlob(bookId: string, blob: Blob): Promise<void> {
  const bytes = await blobToArrayBuffer(blob)
  const db = await getIdbConnection()
  const tx = db.transaction(STORE_BOOK_COVERS, 'readwrite')
  const record = {
    blob,
    bytes,
    mimeType: blob.type || 'image/jpeg',
    updatedAt: Date.now()
  } as CoverAssetRecord & { bytes?: ArrayBuffer }
  tx.objectStore(STORE_BOOK_COVERS).put(record, bookId)
  await idbTransactionDone(tx)
}

export async function loadCoverBlob(bookId: string): Promise<Blob | null> {
  const db = await getIdbConnection()
  const tx = db.transaction(STORE_BOOK_COVERS, 'readonly')
  const rec = await idbRequest<(CoverAssetRecord & { bytes?: ArrayBuffer }) | undefined>(
    tx.objectStore(STORE_BOOK_COVERS).get(bookId)
  )
  if (!rec) return null
  if (rec.blob instanceof Blob && typeof rec.blob.size === 'number') {
    return rec.blob
  }
  if (rec.bytes) {
    return new Blob([rec.bytes], { type: rec.mimeType || 'image/jpeg' })
  }
  return null
}

export async function removeCoverBlob(bookId: string): Promise<void> {
  const db = await getIdbConnection()
  const tx = db.transaction(STORE_BOOK_COVERS, 'readwrite')
  tx.objectStore(STORE_BOOK_COVERS).delete(bookId)
  await idbTransactionDone(tx)
}

export async function saveLocationIndex(
  contentHash: string,
  record: LocationIndexCacheRecord
): Promise<void> {
  if (!contentHash) return
  const db = await getIdbConnection()
  const tx = db.transaction(STORE_LOCATION_INDEXES, 'readwrite')
  tx.objectStore(STORE_LOCATION_INDEXES).put(record, contentHash)
  await idbTransactionDone(tx)
}

export async function loadLocationIndex(
  contentHash: string
): Promise<LocationIndexCacheRecord | null> {
  if (!contentHash) return null
  const db = await getIdbConnection()
  const tx = db.transaction(STORE_LOCATION_INDEXES, 'readonly')
  const rec = await idbRequest<LocationIndexCacheRecord | undefined>(
    tx.objectStore(STORE_LOCATION_INDEXES).get(contentHash)
  )
  return rec ?? null
}

export async function idbGetKeyValue(key: string): Promise<string | undefined> {
  const db = await getIdbConnection()
  const tx = db.transaction(STORE_KEY_VALUE, 'readonly')
  return idbRequest<string | undefined>(tx.objectStore(STORE_KEY_VALUE).get(key))
}

export async function idbSetKeyValue(key: string, value: string): Promise<void> {
  const db = await getIdbConnection()
  const tx = db.transaction(STORE_KEY_VALUE, 'readwrite')
  tx.objectStore(STORE_KEY_VALUE).put(value, key)
  await idbTransactionDone(tx)
}
