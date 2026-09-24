interface StorageRecord<T> {
  key: string
  value: T
}

interface StorageUpdate<T> {
  key: string
  value: T | null
}

interface PrefixTransactionOptions {
  dbName: string
  storeName: string
  prefixes: readonly string[]
  additionalKeys?: readonly string[]
}

function openDatabase(options: PrefixTransactionOptions): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined')
    return Promise.reject(new Error('[workbench] indexedDB is not available'))
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(options.dbName)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(options.storeName))
        request.result.createObjectStore(options.storeName, { keyPath: 'key' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(new Error(request.error?.message || '[workbench] failed to open IndexedDB'))
    request.onblocked = () => reject(new Error('[workbench] IndexedDB open is blocked'))
  })
}

function isSelectedKey(key: string, options: PrefixTransactionOptions): boolean {
  return options.prefixes.some(prefix => key.startsWith(prefix))
    || options.additionalKeys?.includes(key) === true
}

export async function readItemsByPrefix<T>(
  options: PrefixTransactionOptions,
): Promise<ReadonlyMap<string, T>> {
  const db = await openDatabase(options)
  return await new Promise((resolve, reject) => {
    const transaction = db.transaction(options.storeName, 'readonly')
    const store = transaction.objectStore(options.storeName)
    const values = new Map<string, T>()
    const request = store.openCursor()
    request.onsuccess = () => {
      const cursor = request.result
      if (!cursor)
        return
      const record = cursor.value as StorageRecord<T>
      if (typeof record?.key === 'string' && isSelectedKey(record.key, options))
        values.set(record.key, record.value)
      cursor.continue()
    }
    request.onerror = () => transaction.abort()
    transaction.oncomplete = () => {
      db.close()
      resolve(values)
    }
    transaction.onerror = () => {
      db.close()
      reject(new Error(transaction.error?.message || '[workbench] failed to read IndexedDB namespace'))
    }
    transaction.onabort = () => {
      db.close()
      reject(new Error(transaction.error?.message || '[workbench] aborted IndexedDB namespace read'))
    }
  })
}

export async function updateItemsByPrefix<T>(
  options: PrefixTransactionOptions,
  updater: (values: ReadonlyMap<string, T | null>) => readonly StorageUpdate<T>[],
): Promise<void> {
  const db = await openDatabase(options)
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(options.storeName, 'readwrite')
    const store = transaction.objectStore(options.storeName)
    const current = new Map<string, T | null>()
    let updaterError: unknown
    const request = store.openCursor()

    request.onsuccess = () => {
      const cursor = request.result
      if (cursor) {
        const record = cursor.value as StorageRecord<T>
        if (typeof record?.key === 'string' && isSelectedKey(record.key, options))
          current.set(record.key, record.value)
        cursor.continue()
        return
      }

      options.additionalKeys?.forEach((key) => {
        if (!current.has(key))
          current.set(key, null)
      })
      try {
        const updates = updater(new Map(current))
        const updatedKeys = new Set<string>()
        updates.forEach((item) => {
          if (!item || typeof item.key !== 'string' || !item.key)
            throw new TypeError('[workbench] namespace updater returned an invalid key')
          if (!isSelectedKey(item.key, options))
            throw new TypeError(`[workbench] namespace updater returned an undeclared key: ${item.key}`)
          if (updatedKeys.has(item.key))
            throw new TypeError(`[workbench] namespace updater returned a duplicate key: ${item.key}`)
          updatedKeys.add(item.key)
          if (item.value === null)
            store.delete(item.key)
          else
            store.put({ key: item.key, value: item.value } satisfies StorageRecord<T>)
        })
      }
      catch (error) {
        updaterError = error
        transaction.abort()
      }
    }
    request.onerror = () => {
      updaterError = request.error
      transaction.abort()
    }
    transaction.oncomplete = () => {
      db.close()
      resolve()
    }
    transaction.onerror = () => {
      db.close()
      reject(updaterError ?? new Error(transaction.error?.message || '[workbench] failed to update IndexedDB namespace'))
    }
    transaction.onabort = () => {
      db.close()
      reject(updaterError ?? new Error(transaction.error?.message || '[workbench] aborted IndexedDB namespace update'))
    }
  })
}
