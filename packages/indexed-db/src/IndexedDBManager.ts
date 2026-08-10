import type { IndexedDBManagerOptions, IndexedDBManagerStats, StorageItem, StorageRecord } from './types'
import { assertNonEmptyString } from './validation'

function createRequestPromise<T>(request: IDBRequest<T>, errorMessage: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(new Error(request.error?.message || errorMessage))
  })
}

function createTransactionPromise(transaction: IDBTransaction, errorMessage: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(new Error(transaction.error?.message || errorMessage))
    transaction.onabort = () => reject(new Error(transaction.error?.message || errorMessage))
  })
}

export class IndexedDBManager {
  private db: IDBDatabase | null = null
  private initPromise: Promise<IDBDatabase> | null = null
  private readonly dbName: string
  private readonly storeName: string
  private readonly version: number

  constructor(options: IndexedDBManagerOptions) {
    assertNonEmptyString(options.dbName, 'dbName')
    assertNonEmptyString(options.storeName, 'storeName')

    this.dbName = options.dbName
    this.storeName = options.storeName
    this.version = options.version ?? 1
  }

  static isSupported(): boolean {
    return typeof indexedDB !== 'undefined'
  }

  async init(): Promise<IDBDatabase> {
    if (!IndexedDBManager.isSupported()) {
      throw new Error('[indexed-db] indexedDB is not available in current runtime')
    }

    if (this.db) {
      return this.db
    }

    if (this.initPromise) {
      return await this.initPromise
    }

    this.initPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version)

      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'key' })
        }
      }

      request.onsuccess = () => {
        this.db = request.result
        this.db.onclose = () => {
          this.db = null
          this.initPromise = null
        }
        this.db.onversionchange = () => {
          this.db?.close()
          this.db = null
          this.initPromise = null
        }
        this.initPromise = null
        resolve(this.db)
      }

      request.onerror = () => {
        this.initPromise = null
        reject(new Error(request.error?.message || '[indexed-db] failed to open database'))
      }

      request.onblocked = () => {
        reject(new Error('[indexed-db] database upgrade is blocked by another connection'))
      }
    })

    return await this.initPromise
  }

  private async getStore(mode: IDBTransactionMode): Promise<{ store: IDBObjectStore, transaction: IDBTransaction }> {
    const db = await this.init()
    const transaction = db.transaction(this.storeName, mode)
    return {
      store: transaction.objectStore(this.storeName),
      transaction,
    }
  }

  async setItem<T>(key: string, value: T): Promise<void> {
    assertNonEmptyString(key, 'key')

    const { store, transaction } = await this.getStore('readwrite')
    store.put({ key, value } satisfies StorageRecord<T>)
    await createTransactionPromise(transaction, `[indexed-db] failed to set item: ${key}`)
  }

  async getItem<T = unknown>(key: string): Promise<T | null> {
    assertNonEmptyString(key, 'key')

    const { store } = await this.getStore('readonly')
    const record = await createRequestPromise<StorageRecord<T> | undefined>(
      store.get(key),
      `[indexed-db] failed to get item: ${key}`,
    )

    return record?.value ?? null
  }

  async removeItem(key: string): Promise<void> {
    assertNonEmptyString(key, 'key')

    const { store, transaction } = await this.getStore('readwrite')
    store.delete(key)
    await createTransactionPromise(transaction, `[indexed-db] failed to remove item: ${key}`)
  }

  async clear(): Promise<void> {
    const { store, transaction } = await this.getStore('readwrite')
    store.clear()
    await createTransactionPromise(transaction, '[indexed-db] failed to clear store')
  }

  async keys(): Promise<string[]> {
    const { store } = await this.getStore('readonly')
    const keys = await createRequestPromise<IDBValidKey[]>(
      store.getAllKeys(),
      '[indexed-db] failed to read keys',
    )

    return keys.map(String)
  }

  async length(): Promise<number> {
    const { store } = await this.getStore('readonly')
    return await createRequestPromise<number>(
      store.count(),
      '[indexed-db] failed to count items',
    )
  }

  async setItems<T>(items: Array<StorageItem<T>>): Promise<void> {
    if (items.length === 0) {
      return
    }

    const { store, transaction } = await this.getStore('readwrite')
    for (const item of items) {
      assertNonEmptyString(item.key, 'item.key')
      store.put({ key: item.key, value: item.value } satisfies StorageRecord<T>)
    }
    await createTransactionPromise(transaction, '[indexed-db] failed to set items')
  }

  async getItems<T = unknown>(keys: string[]): Promise<Record<string, T | null>> {
    keys.forEach(key => assertNonEmptyString(key, 'key'))

    const { store, transaction } = await this.getStore('readonly')
    const recordPromises = keys.map(key =>
      createRequestPromise<StorageRecord<T> | undefined>(
        store.get(key),
        `[indexed-db] failed to get item: ${key}`,
      ),
    )
    const [records] = await Promise.all([
      Promise.all(recordPromises),
      createTransactionPromise(transaction, '[indexed-db] failed to get items'),
    ])
    const entries = keys.map((key, index) => [key, records[index]?.value ?? null] as const)

    return Object.fromEntries(entries)
  }

  async getStats(): Promise<IndexedDBManagerStats> {
    return {
      dbName: this.dbName,
      isConnected: this.db !== null,
      storeName: this.storeName,
      totalKeys: await this.length(),
    }
  }

  close(): void {
    this.db?.close()
    this.db = null
    this.initPromise = null
  }
}
