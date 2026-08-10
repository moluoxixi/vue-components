export interface IndexedDBManagerOptions {
  dbName: string
  storeName: string
  version?: number
}

export interface IndexedDBStorageOptions extends IndexedDBManagerOptions {}

export interface StorageItem<T = unknown> {
  key: string
  value: T
}

export interface StorageRecord<T = unknown> extends StorageItem<T> {}

export interface IndexedDBManagerStats {
  dbName: string
  isConnected: boolean
  storeName: string
  totalKeys: number
}
