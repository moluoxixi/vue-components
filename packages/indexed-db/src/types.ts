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

export type StorageItemUpdater<T> = (current: T | null) => T | null

export type StorageItemsUpdater<T> = (
  current: ReadonlyMap<string, T | null>,
) => readonly StorageItem<T | null>[]

export interface IndexedDBManagerStats {
  dbName: string
  isConnected: boolean
  storeName: string
  totalKeys: number
}
