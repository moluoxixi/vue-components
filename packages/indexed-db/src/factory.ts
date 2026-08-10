import type { IndexedDBStorageOptions } from './types'
import { IndexDBStorage } from './IndexDBStorage'

export function createIndexDBStorage(options: IndexedDBStorageOptions): IndexDBStorage {
  return new IndexDBStorage(options)
}
