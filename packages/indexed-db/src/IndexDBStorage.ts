import type { IndexedDBStorageOptions } from './types'
import type { StorageItemsInput } from './validation'
import { IndexedDBManager } from './IndexedDBManager'
import { assertStorageItems } from './validation'

export class IndexDBStorage {
  private readonly manager: IndexedDBManager

  constructor(options: IndexedDBStorageOptions) {
    this.manager = new IndexedDBManager(options)
  }

  async setItem<T>(key: string, value: T): Promise<void> {
    await this.manager.setItem(key, value)
  }

  async getItem<T = unknown>(key: string): Promise<T | null> {
    return await this.manager.getItem<T>(key)
  }

  async removeItem(key: string): Promise<void> {
    await this.manager.removeItem(key)
  }

  async clear(): Promise<void> {
    await this.manager.clear()
  }

  async keys(): Promise<string[]> {
    return await this.manager.keys()
  }

  async length(): Promise<number> {
    return await this.manager.length()
  }

  async setItems<T>(items: StorageItemsInput<T>): Promise<void> {
    await this.manager.setItems(assertStorageItems(items))
  }

  async getItems<T = unknown>(keys: string[]): Promise<Record<string, T | null>> {
    return await this.manager.getItems<T>(keys)
  }

  close(): void {
    this.manager.close()
  }
}
