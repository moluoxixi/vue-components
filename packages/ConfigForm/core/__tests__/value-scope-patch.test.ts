import { describe, expect, it } from 'vitest'
import { createConfigFormValueScopeStore } from '../index'

function createStore() {
  return createConfigFormValueScopeStore({
    fields: [
      { nodeId: 'title', field: 'title' },
      { nodeId: 'row-value', field: 'value', scopeId: 'rows' },
      { nodeId: 'item-value', field: 'value', scopeId: 'items' },
      { nodeId: 'other-value', field: 'value', scopeId: 'other' },
    ],
    scopes: [
      { nodeId: 'rows', field: 'rows', kind: 'array' },
      { nodeId: 'items', field: 'items', kind: 'array', parentId: 'rows' },
      { nodeId: 'other', field: 'other', kind: 'array' },
    ],
    values: {
      rows: [{ value: 'first', items: [{ value: 'nested' }] }],
      other: [{ value: 'untouched' }],
    },
  })
}

describe('value scope root patches', () => {
  it('preserves all row identities when adding and removing a root property', () => {
    const store = createStore()
    const rows = store.listRows('rows')
    const items = store.listRows('items', rows[0]!.scope)
    const other = store.listRows('other')
    expect(store.patchValues({ title: 'changed', external: true }).invalidatedScopes).toEqual([])
    expect(store.patchValues({}, ['title', 'external']).invalidatedScopes).toEqual([])
    expect(store.getValues()).not.toHaveProperty('title')
    expect(store.getValues()).not.toHaveProperty('external')
    expect(store.listRows('rows')).toEqual(rows)
    expect(store.listRows('items', rows[0]!.scope)).toEqual(items)
    expect(store.listRows('other')).toEqual(other)
  })

  it('reconciles only the explicitly replaced subtree and invalidates its descendants', () => {
    const store = createStore()
    const rows = store.listRows('rows')
    const items = store.listRows('items', rows[0]!.scope)
    const other = store.listRows('other')
    const result = store.patchValues({ rows: [{ value: 'new', items: [{ value: 'new nested' }] }] })
    expect(result.invalidatedScopes).toContainEqual(rows[0]!.scope)
    expect(result.invalidatedScopes).toContainEqual(items[0]!.scope)
    expect(store.listRows('rows')[0]!.rowId).not.toBe(rows[0]!.rowId)
    expect(store.listRows('other')).toEqual(other)
    expect(store.getValues().rows).toEqual([{ value: 'new', items: [{ value: 'new nested' }] }])
  })

  it('keeps values and identities unchanged when a patch fails validation', () => {
    const store = createStore()
    const values = store.getValues()
    const rows = store.listRows('rows')
    expect(() => store.patchValues({ title: 'must not commit', rows: 'invalid' })).toThrow()
    expect(() => store.patchValues({ title: 'must not commit' }, ['__proto__'])).toThrow()
    expect(store.getValues()).toEqual(values)
    expect(store.listRows('rows')).toEqual(rows)
  })
})
