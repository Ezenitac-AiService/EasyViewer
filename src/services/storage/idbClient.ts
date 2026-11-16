export const IDB_NAME = 'EasyViewerDB'
export const IDB_VERSION = 2

export const STORE_BOOK_FILES = 'book_files'
export const STORE_BOOK_COVERS = 'book_covers'
export const STORE_LOCATION_INDEXES = 'location_indexes'
export const STORE_KEY_VALUE = 'key_value'

let dbPromise: Promise<IDBDatabase> | null = null
let activeDb: IDBDatabase | null = null

function ensureStores(db: IDBDatabase): void {
  if (!db.objectStoreNames.contains(STORE_BOOK_FILES)) {
    db.createObjectStore(STORE_BOOK_FILES)
  }
  if (!db.objectStoreNames.contains(STORE_BOOK_COVERS)) {
    db.createObjectStore(STORE_BOOK_COVERS)
  }
  if (!db.objectStoreNames.contains(STORE_LOCATION_INDEXES)) {
    db.createObjectStore(STORE_LOCATION_INDEXES)
  }
  if (!db.objectStoreNames.contains(STORE_KEY_VALUE)) {
    db.createObjectStore(STORE_KEY_VALUE)
  }
}

/**
 * Returns the singleton IndexedDB v2 connection, guarding against multi-tab version upgrades.
 */
export function getIdbConnection(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is unavailable in this environment'))
  }
  if (dbPromise) return dbPromise

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION)
    req.onupgradeneeded = () => {
      ensureStores(req.result)
    }
    req.onblocked = () => {
      // Allow other tabs/handles to close cleanly; reject only if still blocked on error
    }
    req.onsuccess = () => {
      const db = req.result
      activeDb = db
      db.onversionchange = () => {
        db.close()
        if (activeDb === db) activeDb = null
        dbPromise = null
      }
      resolve(db)
    }
    req.onerror = () => {
      dbPromise = null
      reject(req.error || new Error('IndexedDB open failed'))
    }
  })

  return dbPromise
}

export function idbRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export function idbTransactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'))
  })
}

/**
 * Resets the singleton handle and clears EasyViewerDB for isolated unit tests.
 */
export async function resetIdbClientForTests(): Promise<void> {
  const hadActiveDb = Boolean(activeDb)
  if (activeDb) {
    try {
      activeDb.close()
    } catch {
      // Ignore already closed handles
    }
    activeDb = null
  }
  dbPromise = null
  if (hadActiveDb && typeof indexedDB !== 'undefined' && typeof indexedDB.deleteDatabase === 'function') {
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 25)
      const done = () => {
        clearTimeout(timer)
        resolve()
      }
      const req = indexedDB.deleteDatabase(IDB_NAME)
      req.onsuccess = done
      req.onerror = done
      req.onblocked = done
    })
  }
}
