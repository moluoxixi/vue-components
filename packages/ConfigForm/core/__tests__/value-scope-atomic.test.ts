import type { ConfigFormValueScopePatch } from '../index'
import { describe, expect, it, vi } from 'vitest'
import { createConfigFormValueScopeStore } from '../index'

function fixture() {
  return createConfigFormValueScopeStore({
    fields: [
      { nodeId: 'title', field: 'title', defaultValue: 'initial' },
      { nodeId: 'amount', field: 'amount', scopeId: 'rows' },
      { nodeId: 'detail', field: 'detail', scopeId: 'items' },
      { nodeId: 'other-value', field: 'value', scopeId: 'other' },
    ],
    scopes: [
      { nodeId: 'rows', field: 'rows', kind: 'array' },
      { nodeId: 'items', field: 'items', kind: 'array', parentId: 'rows' },
      { nodeId: 'other', field: 'other', kind: 'array' },
    ],
    values: {
      title: 'initial', extra: true,
      rows: [
        { amount: 1, items: [{ detail: 10 }, { detail: 11 }] },
        { amount: 2, items: [{ detail: 20 }] },
      ],
      other: [{ value: 'unchanged' }],
    },
  })
}

function identities(store: ReturnType<typeof fixture>) {
  const rows = store.listRows('rows')
  return {
    rows: rows.map(row => row.rowId),
    items: rows.map(row => store.listRows('items', row.scope).map(item => item.rowId)),
    other: store.listRows('other').map(row => row.rowId),
  }
}

describe('value scope atomic patches', () => {
  it('commits root set/remove and two-level stable addresses without rebuilding identities', () => {
    const store = fixture()
    const rows = store.listRows('rows')
    const item = store.listRows('items', rows[0]!.scope)[0]!
    const ids = identities(store)
    const result = store.applyPatch({
      set: { title: 'changed' }, remove: ['extra'],
      instances: [
        { nodeId: 'amount', scope: rows[0]!.scope, value: 3 },
        { nodeId: 'detail', scope: item.scope, value: 30 },
      ],
    })
    expect(result.invalidatedScopes).toEqual([])
    expect(identities(store)).toEqual(ids)
    expect(store.getValue('amount', rows[0]!.scope)).toBe(3)
    expect(store.getValue('detail', item.scope)).toBe(30)
    expect(result.values).not.toHaveProperty('extra')
    expect(JSON.stringify(result.values)).not.toContain('rowId')
  })

  it('rebases both address levels after sorting and rejects a removed address as one batch', () => {
    const store = fixture()
    const row = store.listRows('rows')[0]!
    const item = store.listRows('items', row.scope)[0]!
    store.moveRow('rows', row.rowId, 1)
    store.moveRow('items', item.rowId, 1, row.scope)
    store.applyPatch({ instances: [
      { nodeId: 'amount', scope: row.scope, value: 4 },
      { nodeId: 'detail', scope: item.scope, value: 40 },
    ] })
    expect(store.resolvePath('detail', item.scope)).toEqual(['rows', 1, 'items', 1, 'detail'])
    expect(store.getValue('detail', item.scope)).toBe(40)
    store.removeRow('items', item.rowId, row.scope)
    const before = store.getValues()
    const ids = identities(store)
    expect(() => store.applyPatch({ set: { title: 'must not commit' }, instances: [
      { nodeId: 'amount', scope: row.scope, value: 999 },
      { nodeId: 'detail', scope: item.scope, value: 999 },
    ] })).toThrow()
    expect(store.getValues()).toEqual(before)
    expect(identities(store)).toEqual(ids)
  })

  it.each(['duplicate', 'root set overlap', 'root remove overlap', 'root set/remove', 'duplicate remove', 'invalid scope', 'undefined', 'unsafe'])(
    'rejects %s before any value or identity change', (failure) => {
      const store = fixture()
      const row = store.listRows('rows')[0]!
      const write = { nodeId: 'amount', scope: row.scope, value: 99 }
      const patch: ConfigFormValueScopePatch = { set: { title: 'must not commit' }, instances: [write] }
      if (failure === 'duplicate') patch.instances = [write, write]
      if (failure === 'root set overlap') patch.set!.rows = []
      if (failure === 'root remove overlap') patch.remove = ['rows']
      if (failure === 'root set/remove') patch.remove = ['title']
      if (failure === 'duplicate remove') patch.remove = ['extra', 'extra']
      if (failure === 'invalid scope') patch.instances = [write, { ...write, scope: [] }]
      if (failure === 'undefined') patch.instances = [write, { nodeId: 'title', scope: [], value: undefined as never }]
      if (failure === 'unsafe') patch.set = JSON.parse('{"title":"changed","__proto__":{}}')
      const before = store.getValues()
      const ids = identities(store)
      expect(() => store.applyPatch(patch)).toThrow()
      expect(store.getValues()).toEqual(before)
      expect(identities(store)).toEqual(ids)
    },
  )

  it('checks the combined JSON budget and itemKey values before committing', () => {
    const store = fixture()
    const before = store.getValues()
    const row = store.listRows('rows')[0]!
    expect(() => store.applyPatch({ set: { title: Array.from({ length: 6000 }, () => 0) }, instances: [
      { nodeId: 'amount', scope: row.scope, value: Array.from({ length: 6000 }, () => 0) },
    ] })).toThrow(/size or depth/)
    expect(store.getValues()).toEqual(before)
    const keyed = createConfigFormValueScopeStore({
      scopes: [{ nodeId: 'rows', kind: 'array', field: 'rows', itemKey: 'id' }],
      fields: [{ nodeId: 'id', field: 'id', scopeId: 'rows' }],
      values: { rows: [{ id: 'one' }] },
    })
    expect(() => keyed.applyPatch({ set: { extra: true }, instances: [
      { nodeId: 'id', scope: keyed.listRows('rows')[0]!.scope, value: {} },
    ] })).toThrow(/itemKey/)
    expect(keyed.getValues()).toEqual({ rows: [{ id: 'one' }] })
  })

  it('removes declared default keys and an unrelated root scope without dropping other row identities', () => {
    const store = fixture()
    const ids = identities(store)
    const row = store.listRows('rows')[0]!
    const other = store.listRows('other')[0]!
    const result = store.applyPatch({ remove: ['title', 'other'], instances: [
      { nodeId: 'amount', scope: row.scope, value: 4 },
    ] })
    expect(result.values).not.toHaveProperty('title')
    expect(result.values).not.toHaveProperty('other')
    expect(result.invalidatedScopes).toEqual([other.scope])
    expect(store.listRows('other')).toEqual([])
    expect(identities(store).rows).toEqual(ids.rows)
    store.applyPatch({ set: { extra: false } })
    expect(store.getValues()).not.toHaveProperty('title')
    expect(store.getValues()).not.toHaveProperty('other')
    store.appendRow('other', { value: 'new' })
    expect(store.listRows('other')[0]!.value).toEqual({ value: 'new' })
    expect(identities(store).rows).toEqual(ids.rows)
  })

  it('keeps the live store unchanged during a candidate transaction and rolls back a later failure', () => {
    const store = fixture()
    const before = store.getValues()
    const ids = identities(store)
    expect(() => store.transaction((draft) => {
      draft.applyPatch({ set: { title: 'candidate' } })
      draft.appendRow('rows', { amount: 4 })
      expect(store.getValues()).toEqual(before)
      expect(identities(store)).toEqual(ids)
      draft.applyPatch({ set: { rows: false } })
    })).toThrow()
    expect(store.getValues()).toEqual(before)
    expect(identities(store)).toEqual(ids)
    store.transaction((draft) => {
      draft.applyPatch({ set: { title: 'committed' } })
      expect(store.getValue('title')).toBe('initial')
    })
    expect(store.getValue('title')).toBe('committed')
  })

  it('does not reserve candidate row IDs on rollback or allow async/reentrant commits', () => {
    const createRowId = vi.fn(() => 'reusable')
    const store = createConfigFormValueScopeStore({
      scopes: [{ nodeId: 'rows', kind: 'array', field: 'rows' }], fields: [], createRowId,
    })
    expect(() => store.transaction((draft) => {
      draft.appendRow('rows')
      throw new Error('rollback')
    })).toThrow('rollback')
    expect(store.appendRow('rows').row.rowId).toBe('reusable')
    expect(() => store.transaction(async draft => draft.applyPatch({ set: { extra: true } }))).toThrow(/synchronously/)
    expect(store.getValues()).not.toHaveProperty('extra')
    expect(() => store.transaction((draft) => {
      draft.applyPatch({ set: { extra: true } })
      store.applyPatch({ set: { concurrent: true } })
    })).toThrow(/changed during/)
    expect(store.getValues()).not.toHaveProperty('extra')
    expect(store.getValues()).toHaveProperty('concurrent', true)
  })
  it('removes stable fields at both levels without restoring defaults on the next patch', () => {
    const store = fixture()
    const ids = identities(store)
    const row = store.listRows('rows')[0]!
    const item = store.listRows('items', row.scope)[0]!
    store.applyPatch({ set: { extra: false }, instances: [
      { nodeId: 'title', scope: [], remove: true },
      { nodeId: 'amount', scope: row.scope, remove: true },
      { nodeId: 'detail', scope: item.scope, remove: true },
    ] })
    store.applyPatch({ set: { extra: true } })
    expect(store.getValue('title')).toBeUndefined()
    expect(store.getValue('amount', row.scope)).toBeUndefined()
    expect(store.getValue('detail', item.scope)).toBeUndefined()
    expect(identities(store)).toEqual(ids)
    const before = store.getValues()
    expect(() => store.applyPatch({ set: { extra: false }, instances: [
      { nodeId: 'detail', scope: item.scope, remove: true },
      { nodeId: 'detail', scope: item.scope, value: 99 },
    ] })).toThrow(/Duplicate/)
    expect(() => store.applyPatch({ instances: [
      { nodeId: 'detail', scope: item.scope, remove: true, value: 99 } as never,
    ] })).toThrow(/cannot also/)
    expect(() => store.applyPatch({ instances: [
      { nodeId: 'detail', scope: [], remove: true },
    ] })).toThrow()
    expect(store.getValues()).toEqual(before)
    expect(identities(store)).toEqual(ids)
  })

  it('keeps a removed root default omitted after an unrelated patch with nested stable operations', () => {
    const store = fixture()
    const row = store.listRows('rows')[0]!
    const items = store.listRows('items', row.scope)
    store.applyPatch({ remove: ['title'], instances: [
      { nodeId: 'detail', scope: items[0]!.scope, remove: true },
      { nodeId: 'detail', scope: items[1]!.scope, value: 90 },
    ] })
    expect(store.getValue('title')).toBeUndefined()
    store.applyPatch({ set: { extra: false } })
    expect(store.getValue('title')).toBeUndefined()
    expect(store.getValue('detail', items[0]!.scope)).toBeUndefined()
    expect(store.getValue('detail', items[1]!.scope)).toBe(90)
  })

  it('validates retained array identities and otherwise keeps itemKey replacement semantics', () => {
    const store = fixture()
    const rows = store.listRows('rows')
    const before = store.getValues()
    const ids = identities(store)
    const retained = { scopeId: 'rows', parentScope: [], valuePath: ['rows'], rowIds: rows.map(row => row.rowId) }
    expect(() => store.replaceValues(before, [{ ...retained, rowIds: ['missing'] }])).toThrow()
    expect(() => store.replaceValues(before, [{ ...retained, rowIds: [rows[0]!.rowId, rows[0]!.rowId] }])).toThrow()
    expect(() => store.replaceValues(before, [{ ...retained, rowIds: [] }])).toThrow()
    expect(store.getValues()).toEqual(before)
    expect(identities(store)).toEqual(ids)
    const result = store.replaceValues(before, [retained])
    expect(identities(store).rows).toEqual(ids.rows)
    expect(result.invalidatedScopes).toContainEqual(store.listRows('other')[0]!.scope === undefined ? [] : [{ scopeId: 'other', rowId: ids.other[0]! }])
    expect(identities(store).items).not.toEqual(ids.items)
  })

  it('reconciles keyed scope replacement inside a mixed atomic patch', () => {
    const store = createConfigFormValueScopeStore({
      scopes: [
        { nodeId: 'rows', field: 'rows', kind: 'array', itemKey: 'id' },
        { nodeId: 'items', field: 'items', kind: 'array', parentId: 'rows', itemKey: 'id' },
      ],
      fields: [{ nodeId: 'title', field: 'title' }],
      values: { rows: [{ id: 'a', items: [{ id: 'a1' }] }, { id: 'b', items: [] }] },
    })
    const rows = store.listRows('rows')
    const nested = store.listRows('items', rows[0]!.scope)
    const result = store.applyPatch({ set: { rows: [{ id: 'b', items: [] }, { id: 'a', items: [{ id: 'a1' }] }] }, instances: [
      { nodeId: 'title', scope: [], value: 'changed' },
    ] })
    expect(result.invalidatedScopes).toEqual([])
    expect(store.listRows('rows').map(row => row.rowId)).toEqual(rows.map(row => row.rowId).reverse())
    expect(store.listRows('items', rows[0]!.scope)).toEqual(nested)
  })
})
