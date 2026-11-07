import type { HeadlessTablePersistence, HeadlessTablePreferencesStorage } from '../types'
import { renderToString } from '@vue/server-renderer'
import { describe, expect, it, vi } from 'vitest'
import { createSSRApp, defineComponent, effectScope, h, nextTick, ref } from 'vue'
import { useHeadlessTable } from '../index'

function memoryStorage(): HeadlessTablePreferencesStorage {
  const data = new Map<string, string>()
  return {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value) },
    removeItem: (key) => { data.delete(key) },
  }
}
const columns = [{ field: 'name' }, { field: 'status' }]
function setup(persistence: HeadlessTablePersistence, extra = {}) {
  const scope = effectScope()
  const table = scope.run(() => useHeadlessTable<{ id: number }>({ columns, data: [], getRowId: row => row.id, persistence, ...extra }))!
  return { table, stop: () => scope.stop() }
}

describe('column preferences', () => {
  it('restores order, visibility and widths after remount and clears overrides on reset', async () => {
    const storage = memoryStorage()
    const first = setup({ key: 'orders:user-a', storage })
    first.table.setColumnOrder(['status', 'name'])
    first.table.setColumnVisible('name', false)
    first.table.setColumnWidth('status', 240)
    await nextTick()
    first.stop()
    const second = setup({ key: 'orders:user-a', storage })
    expect(second.table.columnOrder.value).toEqual(['status', 'name'])
    expect(second.table.columnVisibility.value).toEqual({ name: false })
    expect(second.table.columnWidths.value).toEqual({ status: 240 })
    second.table.resetColumnSettings()
    await nextTick()
    expect(second.table.columnWidths.value).toEqual({})
    expect(storage.getItem('mx-table:orders:user-a')).toBeNull()
    second.stop()
  })

  it('isolates reactive keys and versions without writing the old account state into the new key', async () => {
    const storage = memoryStorage()
    const persistence = ref({ key: 'a', storage, version: 1 })
    const subject = setup(persistence.value, { persistence })
    subject.table.setColumnWidth('name', 320)
    await nextTick()
    persistence.value = { key: 'b', storage, version: 1 }
    await nextTick()
    expect(subject.table.columnWidths.value).toEqual({})
    expect(storage.getItem('mx-table:b')).toBeNull()
    persistence.value = { key: 'a', storage, version: 1 }
    expect(subject.table.columnWidths.value).toEqual({ name: 320 })
    persistence.value = { key: 'a', storage, version: 2 }
    expect(subject.table.columnWidths.value).toEqual({})
    subject.stop()
  })

  it('waits for async columns, drops removed IDs and preserves source defaults for new columns', async () => {
    const storage = memoryStorage()
    storage.setItem('mx-table:orders', JSON.stringify({ version: 1, state: {
      columnOrder: ['deleted', 'status', 'status'],
      columnVisibility: { name: false, deleted: false },
      columnWidths: { status: 220, name: -20, deleted: 400 },
    } }))
    const schema = ref<typeof columns>([])
    const subject = setup({ key: 'orders', storage }, { columns: schema })
    expect(storage.getItem('mx-table:orders')).toContain('deleted')
    schema.value = [...columns, { field: 'new' }]
    await nextTick()
    expect(subject.table.columnOrder.value).toEqual(['status'])
    expect(subject.table.columnWidths.value).toEqual({ status: 220 })
    expect(subject.table.columns.value.map(column => column.field)).toEqual(['status', 'new'])
    schema.value = [{ field: 'name' }, { field: 'new' }]
    await nextTick()
    expect(subject.table.columnWidths.value).toEqual({})
    expect(storage.getItem('mx-table:orders')).not.toContain('status')
    subject.stop()
  })

  it('keeps each controlled state slice above stored preferences', () => {
    const storage = memoryStorage()
    storage.setItem('mx-table:orders', JSON.stringify({ version: 1, state: {
      columnOrder: ['status', 'name'],
      columnVisibility: { name: false },
      columnWidths: { name: 300 },
    } }))
    const widths = ref({ name: 180 })
    const subject = setup({ key: 'orders', storage }, { state: { columnWidths: widths } })
    expect(subject.table.columnWidths.value).toEqual({ name: 180 })
    expect(subject.table.columnOrder.value).toEqual(['status', 'name'])
    subject.stop()
  })

  it('survives corrupted storage and read/write/remove failures', async () => {
    const onPersistenceError = vi.fn()
    const storage = memoryStorage()
    storage.setItem('mx-table:orders', '{bad json')
    const subject = setup({ key: 'orders', storage }, { onPersistenceError })
    expect(onPersistenceError.mock.calls[0][0].operation).toBe('read')
    storage.setItem = () => {
      throw new Error('quota')
    }
    storage.removeItem = () => {
      throw new Error('denied')
    }
    subject.table.setColumnWidth('name', 200)
    await nextTick()
    expect(subject.table.columnWidths.value.name).toBe(200)
    expect(onPersistenceError.mock.calls.at(-1)![0].operation).toBe('write')
    subject.table.resetColumnSettings()
    expect(onPersistenceError.mock.calls.at(-1)![0].operation).toBe('remove')
    subject.stop()
  })

  it('rejects non-positive widths and normalizes external pagination', () => {
    const pagination = ref({ currentPage: 99, pageSize: 0.5 })
    const subject = setup({ key: 'orders', storage: memoryStorage() }, { state: { pagination } })
    expect(pagination.value).toEqual({ currentPage: 1, pageSize: 1 })
    pagination.value = { currentPage: 42, pageSize: 0 }
    expect(pagination.value).toEqual({ currentPage: 1, pageSize: 10 })
    expect(() => subject.table.setColumnWidth('name', -20)).toThrow(RangeError)
    subject.stop()
  })

  it('does not let repeated nested filter resets mutate the initial snapshot', () => {
    const subject = setup({ key: 'orders', storage: memoryStorage() }, { initialState: { filters: { nested: { query: 'initial' } } } })
    subject.table.resetFilters()
    ;(subject.table.filters.value.nested as { query: string }).query = 'changed'
    subject.table.resetFilters()
    expect(subject.table.filters.value).toEqual({ nested: { query: 'initial' } })
    subject.stop()
  })
  it('does not access browser preferences during SSR', async () => {
    const getItem = vi.fn(() => {
      throw new Error('storage must not be read on the server')
    })
    const app = createSSRApp(defineComponent({
      setup() {
        useHeadlessTable<{ id: number }>({
          columns,
          data: [],
          getRowId: row => row.id,
          persistence: { key: 'ssr', storage: { ...memoryStorage(), getItem } },
        })
        return () => h('div', 'server table')
      },
    }))
    expect(await renderToString(app)).toContain('server table')
    expect(getItem).not.toHaveBeenCalled()
  })
  it('flushes pending edits to the previous key before a same-tick account switch', () => {
    const storage = memoryStorage()
    const persistence = ref({ key: 'a', storage })
    const subject = setup(persistence.value, { persistence })
    subject.table.setColumnWidth('name', 330)
    persistence.value.key = 'b'
    expect(storage.getItem('mx-table:a')).toContain('330')
    expect(storage.getItem('mx-table:b')).toBeNull()
    expect(subject.table.columnWidths.value).toEqual({})
    subject.stop()
  })

  it('merges saved slices with newly supplied initial defaults', () => {
    const storage = memoryStorage()
    storage.setItem('mx-table:orders', JSON.stringify({ version: 1, state: { columnWidths: { name: 300 } } }))
    const subject = setup({ key: 'orders', storage }, {
      initialState: { columnOrder: ['status', 'name'], columnVisibility: { status: false }, columnWidths: { name: 160, status: 200 } },
    })
    expect(subject.table.columnOrder.value).toEqual(['status', 'name'])
    expect(subject.table.columnVisibility.value).toEqual({ status: false })
    expect(subject.table.columnWidths.value).toEqual({ name: 300, status: 200 })
    subject.stop()
  })
})
