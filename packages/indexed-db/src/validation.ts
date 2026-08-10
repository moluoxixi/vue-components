import type { StorageItem } from './types'

export function assertNonEmptyString(value: unknown, fieldName: string): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`[indexed-db] ${fieldName} must be a non-empty string`)
  }
}

export function assertStorageItems<T>(items: StorageItemsInput<T>): StorageItem<T>[] {
  const normalizedItems = Array.isArray(items)
    ? items
    : Object.entries(items).map(([key, value]) => ({ key, value: value as T }))

  for (const item of normalizedItems) {
    assertNonEmptyString(item.key, 'item.key')
  }

  return normalizedItems
}

export type StorageItemsInput<T> = Array<StorageItem<T>> | Record<string, T>
