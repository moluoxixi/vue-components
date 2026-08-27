import { afterEach, describe, expect, it, vi } from 'vitest'

import { createIndexDBStorage, IndexDBStorage, IndexedDBManager } from '../src/index'
import 'fake-indexeddb/auto'

const openedStorages: IndexDBStorage[] = []

function createStorage(dbName: string): IndexDBStorage {
  const storage = createIndexDBStorage({
    dbName,
    storeName: 'kv',
  })
  openedStorages.push(storage)
  return storage
}

afterEach(() => {
  for (const storage of openedStorages) {
    storage.close()
  }
  openedStorages.length = 0
})

describe('indexDBStorage', () => {
  it('stores, reads, removes, and clears records', async () => {
    const storage = createStorage('storage-basic')

    await storage.setItem('user', { name: 'Ada' })

    await expect(storage.getItem('user')).resolves.toEqual({ name: 'Ada' })
    await expect(storage.keys()).resolves.toEqual(['user'])
    await expect(storage.length()).resolves.toBe(1)

    await storage.removeItem('user')
    await expect(storage.getItem('user')).resolves.toBeNull()

    await storage.setItem('a', 1)
    await storage.setItem('b', 2)
    await storage.clear()
    await expect(storage.length()).resolves.toBe(0)
  })

  it('supports batch object and array writes without a default global instance', async () => {
    const storage = createStorage('storage-batch')

    await storage.setItems({ a: 1, b: 2 })
    await storage.setItems([{ key: 'c', value: 3 }])

    await expect(storage.getItems<number>(['a', 'b', 'c', 'missing'])).resolves.toEqual({
      a: 1,
      b: 2,
      c: 3,
      missing: null,
    })
  })

  it('throws for invalid contracts instead of falling back silently', async () => {
    expect(() => new IndexDBStorage({ dbName: '', storeName: 'kv' })).toThrow('[indexed-db] dbName must be a non-empty string')

    const storage = createStorage('storage-invalid')

    await expect(storage.setItem('', 1)).rejects.toThrow('[indexed-db] key must be a non-empty string')
    await expect(storage.setItems([{ key: '', value: 1 }])).rejects.toThrow('[indexed-db] item.key must be a non-empty string')
  })

  it('updates or deletes one item atomically', async () => {
    const storage = createStorage('storage-update')
    await storage.setItem('counter', 1)

    await expect(storage.updateItem<number>('counter', current => (current ?? 0) + 1)).resolves.toBe(2)
    await expect(storage.getItem('counter')).resolves.toBe(2)
    await expect(storage.updateItem<number>('counter', () => null)).resolves.toBeNull()
    await expect(storage.getItem('counter')).resolves.toBeNull()
  })

  it('aborts an update when the synchronous updater rejects the change', async () => {
    const storage = createStorage('storage-update-abort')
    await storage.setItem('project', { revision: 1 })

    await expect(storage.updateItem('project', () => {
      throw new Error('revision conflict')
    })).rejects.toThrow('revision conflict')
    await expect(storage.getItem('project')).resolves.toEqual({ revision: 1 })
    // @ts-expect-error Promise-returning updaters are rejected by both the type and runtime contracts.
    await expect(storage.updateItem<{ revision: number }>('project', async current => current)).rejects.toThrow('updater must be synchronous')
    await expect(storage.getItem('project')).resolves.toEqual({ revision: 1 })
  })

  it('serializes compare-and-swap updates across database connections', async () => {
    const first = createStorage('storage-update-cas')
    const second = createStorage('storage-update-cas')
    await first.setItem('project', { revision: 1 })

    const commit = (storage: IndexDBStorage) => storage.updateItem<{ revision: number }>('project', (current) => {
      if (current?.revision !== 1)
        throw new Error('revision conflict')
      return { revision: 2 }
    })
    const results = await Promise.allSettled([commit(first), commit(second)])

    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1)
    await expect(first.getItem('project')).resolves.toEqual({ revision: 2 })
  })
})

describe('indexedDBManager', () => {
  it('reads batch keys through one readonly transaction', async () => {
    const manager = new IndexedDBManager({
      dbName: 'manager-batch-transaction',
      storeName: 'kv',
    })

    await manager.setItems([
      { key: 'a', value: 1 },
      { key: 'b', value: 2 },
      { key: 'c', value: 3 },
    ])

    const db = await manager.init()
    const transactionSpy = vi.spyOn(db, 'transaction')

    await expect(manager.getItems<number>(['a', 'b', 'c', 'missing'])).resolves.toEqual({
      a: 1,
      b: 2,
      c: 3,
      missing: null,
    })
    expect(transactionSpy).toHaveBeenCalledTimes(1)
    expect(transactionSpy).toHaveBeenCalledWith('kv', 'readonly')

    manager.close()
  })

  it('reports stats for the active database and store', async () => {
    const manager = new IndexedDBManager({
      dbName: 'manager-stats',
      storeName: 'kv',
    })

    await manager.setItem('one', 1)
    const stats = await manager.getStats()

    expect(stats).toEqual({
      dbName: 'manager-stats',
      isConnected: true,
      storeName: 'kv',
      totalKeys: 1,
    })

    manager.close()
  })
})
