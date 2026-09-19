import { IndexDBStorage } from '@moluoxixi/indexed-db'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  readItemsByPrefix,
  updateItemsByPrefix,
} from '../persistence/adapters/indexed-db-prefix-transaction'
import 'fake-indexeddb/auto'

interface NamespaceValue {
  generation: number
  value: string
}

const closeables: Array<{ close: () => void }> = []
let sequence = 0

afterEach(() => {
  closeables.splice(0).forEach(closeable => closeable.close())
})

function options(dbName: string) {
  return { dbName, storeName: 'workspace-projects', prefixes: ['scope:'] }
}

function snapshot(values: ReadonlyMap<string, NamespaceValue | null>): Record<string, NamespaceValue | null> {
  return Object.fromEntries([...values.entries()].sort(([left], [right]) => left.localeCompare(right)))
}

describe('IndexedDB prefix transactions', () => {
  it('serializes concurrent namespace replacement and deletion without a mixed result', async () => {
    const dbName = `prefix-transaction-concurrent-${sequence++}`
    const storage = new IndexDBStorage({ dbName, storeName: 'workspace-projects' })
    closeables.push(storage)
    await storage.setItems({
      'scope:manifest': { generation: 1, value: 'old-manifest' },
      'scope:entity': { generation: 1, value: 'old-entity' },
      'scope:stale': { generation: 1, value: 'stale' },
      'other:record': { generation: 1, value: 'unrelated' },
    })

    const observed: Array<Record<string, NamespaceValue | null>> = []
    const replace = updateItemsByPrefix<NamespaceValue>(options(dbName), (values) => {
      observed.push(snapshot(values))
      return [
        { key: 'scope:manifest', value: { generation: 2, value: 'new-manifest' } },
        { key: 'scope:entity', value: { generation: 2, value: 'new-entity' } },
        { key: 'scope:bytes', value: { generation: 2, value: 'new-bytes' } },
        { key: 'scope:stale', value: null },
      ]
    })
    const remove = updateItemsByPrefix<NamespaceValue>(options(dbName), (values) => {
      observed.push(snapshot(values))
      return [...values.keys()].map(key => ({ key, value: null }))
    })

    await expect(Promise.all([replace, remove])).resolves.toEqual([undefined, undefined])
    const finalSnapshot = snapshot(await readItemsByPrefix<NamespaceValue>(options(dbName)))
    const replacement = {
      'scope:bytes': { generation: 2, value: 'new-bytes' },
      'scope:entity': { generation: 2, value: 'new-entity' },
      'scope:manifest': { generation: 2, value: 'new-manifest' },
    }
    expect([{}, replacement]).toContainEqual(finalSnapshot)
    expect(observed).toHaveLength(2)
    expect(observed).toContainEqual({
      'scope:entity': { generation: 1, value: 'old-entity' },
      'scope:manifest': { generation: 1, value: 'old-manifest' },
      'scope:stale': { generation: 1, value: 'stale' },
    })
    expect(observed.some(value =>
      Object.keys(value).length === 0 || JSON.stringify(value) === JSON.stringify(replacement)))
      .toBe(true)
    await expect(storage.getItem('other:record')).resolves.toEqual({
      generation: 1,
      value: 'unrelated',
    })
  })

  it('rolls back the complete namespace when a put fails', async () => {
    const dbName = `prefix-transaction-put-failure-${sequence++}`
    const storage = new IndexDBStorage({ dbName, storeName: 'workspace-projects' })
    closeables.push(storage)
    await storage.setItems({
      'scope:manifest': { generation: 1, value: 'old-manifest' },
      'scope:entity': { generation: 1, value: 'old-entity' },
      'other:record': { generation: 1, value: 'unrelated' },
    })
    const before = snapshot(await readItemsByPrefix<NamespaceValue>(options(dbName)))
    const originalPut = IDBObjectStore.prototype.put
    let putCount = 0
    const putSpy = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
      this: IDBObjectStore,
      value,
      key,
    ) {
      putCount += 1
      if (putCount === 2)
        throw new DOMException('Injected namespace write failure.', 'QuotaExceededError')
      return key === undefined ? originalPut.call(this, value) : originalPut.call(this, value, key)
    })

    try {
      await expect(updateItemsByPrefix<NamespaceValue>(options(dbName), () => [
        { key: 'scope:manifest', value: { generation: 2, value: 'new-manifest' } },
        { key: 'scope:entity', value: { generation: 2, value: 'new-entity' } },
        { key: 'scope:bytes', value: { generation: 2, value: 'new-bytes' } },
      ])).rejects.toThrow('Injected namespace write failure')
    }
    finally {
      putSpy.mockRestore()
    }

    await expect(readItemsByPrefix<NamespaceValue>(options(dbName))).resolves.toEqual(
      new Map(Object.entries(before)),
    )
    await expect(storage.getItem('other:record')).resolves.toEqual({
      generation: 1,
      value: 'unrelated',
    })
  })

  it('exposes each readonly snapshot as entirely old or entirely new', async () => {
    const dbName = `prefix-transaction-read-snapshot-${sequence++}`
    const storage = new IndexDBStorage({ dbName, storeName: 'workspace-projects' })
    closeables.push(storage)
    await storage.setItems({
      'scope:manifest': { generation: 0, value: 'manifest-0' },
      'scope:entity': { generation: 0, value: 'entity-0' },
      'scope:bytes': { generation: 0, value: 'bytes-0' },
    })

    for (let generation = 1; generation <= 8; generation += 1) {
      const previous = generation - 1
      const write = updateItemsByPrefix<NamespaceValue>(options(dbName), () => [
        { key: 'scope:manifest', value: { generation, value: `manifest-${generation}` } },
        { key: 'scope:entity', value: { generation, value: `entity-${generation}` } },
        { key: 'scope:bytes', value: { generation, value: `bytes-${generation}` } },
      ])
      const read = readItemsByPrefix<NamespaceValue>(options(dbName))
      const [, concurrent] = await Promise.all([write, read])
      const generations = new Set([...concurrent.values()].map(value => value.generation))
      expect([[previous], [generation]]).toContainEqual([...generations])

      const committed = await readItemsByPrefix<NamespaceValue>(options(dbName))
      expect(new Set([...committed.values()].map(value => value.generation))).toEqual(new Set([generation]))
    }
  })
})
