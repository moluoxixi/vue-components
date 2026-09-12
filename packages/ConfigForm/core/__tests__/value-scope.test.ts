import type { ConfigFormJsonObject } from '../src/json'
import type { ConfigFormScopePath } from '../src/value-scope'
import { describe, expect, it } from 'vitest'
import {
  createConfigFormValueScopeStore,
  getConfigFormValueScopeInstanceKey,
  selectConfigFormScopePath,
} from '../src/value-scope'

function sequentialIds(prefix = 'row') {
  let value = 0
  return () => `${prefix}-${++value}`
}

function createNestedStore(values?: ConfigFormJsonObject) {
  return createConfigFormValueScopeStore({
    createRowId: sequentialIds(),
    scopes: [
      { nodeId: 'profile-scope', field: 'profile', kind: 'object' },
      {
        nodeId: 'contacts-scope',
        field: 'contacts',
        kind: 'array',
        parentId: 'profile-scope',
        itemKey: 'id',
        minItems: 1,
        maxItems: 4,
      },
      {
        nodeId: 'address-scope',
        field: 'address',
        kind: 'object',
        parentId: 'contacts-scope',
      },
      {
        nodeId: 'phones-scope',
        field: 'phones',
        kind: 'array',
        parentId: 'address-scope',
        itemKey: 'code',
        maxItems: 3,
      },
    ],
    fields: [
      { nodeId: 'title-node', field: 'title', defaultValue: 'Draft' },
      { nodeId: 'literal-node', field: 'literal.dot', defaultValue: 'literal' },
      { nodeId: 'profile-name-node', field: 'name', scopeId: 'profile-scope', defaultValue: 'Profile' },
      { nodeId: 'contact-id-node', field: 'id', scopeId: 'contacts-scope' },
      { nodeId: 'contact-name-node', field: 'name', scopeId: 'contacts-scope', defaultValue: 'Contact' },
      { nodeId: 'city-node', field: 'city', scopeId: 'address-scope', defaultValue: 'Unknown' },
      { nodeId: 'phone-code-node', field: 'code', scopeId: 'phones-scope' },
      { nodeId: 'phone-value-node', field: 'value', scopeId: 'phones-scope', defaultValue: '' },
    ],
    values,
  })
}

describe('config-form value scope paths and values', () => {
  it('initializes root, object, array, and nested defaults without leaking row metadata', () => {
    const input = {
      extra: { preserved: true },
      profile: {
        contacts: [{ id: 'a', address: { phones: [{ code: 'home', value: '100' }] } }],
      },
    }
    const store = createNestedStore(input)
    input.profile.contacts[0]!.address.phones[0]!.value = 'mutated outside'

    expect(store.getValues()).toEqual({
      'extra': { preserved: true },
      'literal.dot': 'literal',
      'profile': {
        contacts: [{
          address: { city: 'Unknown', phones: [{ code: 'home', value: '100' }] },
          id: 'a',
          name: 'Contact',
        }],
        name: 'Profile',
      },
      'title': 'Draft',
    })
    expect(JSON.stringify(store.getValues())).not.toContain('rowId')

    const contact = store.listRows('contacts-scope')[0]!
    const phone = store.listRows('phones-scope', contact.scope)[0]!
    expect(store.resolvePath('title-node')).toEqual(['title'])
    expect(store.resolvePath('literal-node')).toEqual(['literal.dot'])
    expect(store.resolvePath('profile-name-node')).toEqual(['profile', 'name'])
    expect(store.resolvePath('contact-name-node', contact.scope)).toEqual(['profile', 'contacts', 0, 'name'])
    expect(store.resolvePath('phone-value-node', phone.scope)).toEqual([
      'profile',
      'contacts',
      0,
      'address',
      'phones',
      0,
      'value',
    ])
  })

  it('distinguishes missing declared values from unknown field nodes', () => {
    const store = createNestedStore({ profile: { contacts: [{}] } })
    const contactScope = store.listRows('contacts-scope')[0]!.scope

    expect(store.getValue('contact-id-node', contactScope)).toBeUndefined()
    expect(() => store.getValue('missing-node')).toThrowError(expect.objectContaining({
      code: 'CONFIG_FORM_VALUE_SCOPE_FIELD_NOT_FOUND',
      path: 'nodeId',
    }))
  })

  it('uses exact array ancestor chains and isolates child arrays under different rows', () => {
    const store = createNestedStore({
      profile: {
        contacts: [
          { id: 'a', address: { phones: [{ code: 'home', value: '100' }] } },
          { id: 'b', address: { phones: [{ code: 'work', value: '200' }] } },
        ],
      },
    })
    const [first, second] = store.listRows('contacts-scope')
    const firstPhones = store.listRows('phones-scope', first!.scope)
    const secondPhones = store.listRows('phones-scope', second!.scope)

    expect(firstPhones[0]!.rowId).not.toBe(secondPhones[0]!.rowId)
    expect(store.getValue('phone-value-node', firstPhones[0]!.scope)).toBe('100')
    expect(store.getValue('phone-value-node', secondPhones[0]!.scope)).toBe('200')
    expect(() => store.listRows('phones-scope')).toThrowError(expect.objectContaining({
      code: 'CONFIG_FORM_VALUE_SCOPE_ANCESTOR_MISMATCH',
    }))
    expect(() => store.listRows('phones-scope', [{ scopeId: 'wrong', rowId: first!.rowId }])).toThrowError(
      expect.objectContaining({ code: 'CONFIG_FORM_VALUE_SCOPE_ANCESTOR_MISMATCH' }),
    )
  })

  it('resolves stable row identities to new indexes after a move', () => {
    const store = createNestedStore({
      profile: { contacts: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] },
    })
    const [first, second] = store.listRows('contacts-scope')

    const moved = store.moveRow('contacts-scope', second!.rowId, 0)
    expect(moved.row.rowId).toBe(second!.rowId)
    expect(store.resolvePath('contact-name-node', second!.scope)).toEqual(['profile', 'contacts', 0, 'name'])
    expect(store.resolvePath('contact-name-node', first!.scope)).toEqual(['profile', 'contacts', 1, 'name'])
    expect(store.getValues().profile).toEqual({
      contacts: [
        { address: { city: 'Unknown', phones: [] }, id: 'b', name: 'B' },
        { address: { city: 'Unknown', phones: [] }, id: 'a', name: 'A' },
      ],
      name: 'Profile',
    })
  })

  it('deep-clones reads, writes, row snapshots, and repeated defaults', () => {
    const sharedDefault = { tags: ['initial'] }
    const store = createConfigFormValueScopeStore({
      createRowId: sequentialIds(),
      scopes: [{ nodeId: 'rows', field: 'rows', kind: 'array', minItems: 2 }],
      fields: [{ nodeId: 'settings-node', field: 'settings', scopeId: 'rows', defaultValue: sharedDefault }],
    })
    sharedDefault.tags.push('outside')

    const [first, second] = store.listRows('rows')
    const firstRead = store.getValue('settings-node', first!.scope) as { tags: string[] }
    firstRead.tags.push('read mutation')
    const snapshot = store.getValues()
    ;(snapshot.rows as { settings: { tags: string[] } }[])[0]!.settings.tags.push('snapshot mutation')
    first!.value.settings = { tags: ['row snapshot mutation'] }

    expect(store.getValue('settings-node', first!.scope)).toEqual({ tags: ['initial'] })
    expect(store.getValue('settings-node', second!.scope)).toEqual({ tags: ['initial'] })

    const written = { tags: ['written'] }
    store.setValue('settings-node', written, first!.scope)
    written.tags.push('outside write')
    expect(store.getValue('settings-node', first!.scope)).toEqual({ tags: ['written'] })
  })

  it('provides stable instance keys and current/parent/root selectors', () => {
    const scope: ConfigFormScopePath = [
      { scopeId: 'outer', rowId: 'one' },
      { scopeId: 'inner', rowId: 'two' },
    ]
    expect(getConfigFormValueScopeInstanceKey('field', scope)).toBe('["field",["outer","one"],["inner","two"]]')
    expect(selectConfigFormScopePath(scope, 'current')).toEqual(scope)
    expect(selectConfigFormScopePath(scope, 'parent')).toEqual([scope[0]])
    expect(selectConfigFormScopePath(scope, 'root')).toEqual([])
    expect(selectConfigFormScopePath([], 'parent')).toEqual([])
  })
})

describe('config-form value scope row operations', () => {
  it('adds, inserts, duplicates, moves, and removes while preserving unaffected IDs', () => {
    const store = createConfigFormValueScopeStore({
      createRowId: sequentialIds(),
      scopes: [
        { nodeId: 'rows', field: 'rows', kind: 'array', minItems: 1, maxItems: 4 },
        { nodeId: 'children', field: 'children', kind: 'array', parentId: 'rows' },
      ],
      fields: [
        { nodeId: 'name-node', field: 'name', scopeId: 'rows', defaultValue: 'new' },
        { nodeId: 'child-node', field: 'value', scopeId: 'children', defaultValue: '' },
      ],
      values: { rows: [{ name: 'A', children: [{ value: 'x' }, { value: 'y' }] }] },
    })
    const original = store.listRows('rows')[0]!
    const originalChildren = store.listRows('children', original.scope)

    const appended = store.appendRow('rows', { name: 'C' })
    const inserted = store.insertRow('rows', 1, { name: 'B' })
    expect(store.listRows('rows').map(row => [row.rowId, row.value.name])).toEqual([
      [original.rowId, 'A'],
      [inserted.row.rowId, 'B'],
      [appended.row.rowId, 'C'],
    ])

    const copied = store.duplicateRow('rows', original.rowId)
    const copiedChildren = store.listRows('children', copied.row.scope)
    expect(copied.row.value).toEqual(original.value)
    expect(copied.row.rowId).not.toBe(original.rowId)
    expect(copiedChildren.map(row => row.rowId)).not.toEqual(originalChildren.map(row => row.rowId))
    expect(store.listRows('rows').map(row => row.rowId)).toContain(original.rowId)

    expect(() => store.appendRow('rows')).toThrowError(expect.objectContaining({
      code: 'CONFIG_FORM_VALUE_SCOPE_MAX_ITEMS',
    }))

    store.moveRow('rows', appended.row.rowId, 0)
    expect(store.listRows('rows')[0]!.rowId).toBe(appended.row.rowId)
    expect(store.listRows('children', original.scope).map(row => row.rowId)).toEqual(
      originalChildren.map(row => row.rowId),
    )

    const removed = store.removeRow('rows', copied.row.rowId)
    expect(removed.removedRow.rowId).toBe(copied.row.rowId)
    expect(removed.invalidatedScopes).toContainEqual(copied.row.scope)
    copiedChildren.forEach(child => expect(removed.invalidatedScopes).toContainEqual(child.scope))
    expect(() => store.getValue('name-node', copied.row.scope)).toThrowError(expect.objectContaining({
      code: 'CONFIG_FORM_VALUE_SCOPE_ROW_NOT_FOUND',
    }))
  })

  it('enforces minItems atomically', () => {
    const store = createConfigFormValueScopeStore({
      createRowId: sequentialIds(),
      scopes: [{ nodeId: 'rows', field: 'rows', kind: 'array', minItems: 1 }],
      fields: [{ nodeId: 'value-node', field: 'value', scopeId: 'rows', defaultValue: '' }],
    })
    const beforeRows = store.listRows('rows')
    const beforeValues = store.getValues()

    expect(() => store.removeRow('rows', beforeRows[0]!.rowId)).toThrowError(expect.objectContaining({
      code: 'CONFIG_FORM_VALUE_SCOPE_MIN_ITEMS',
    }))
    expect(store.getValues()).toEqual(beforeValues)
    expect(store.listRows('rows')).toEqual(beforeRows)
  })
})

describe('config-form value scope replacement reconciliation', () => {
  it('reuses keyed outer and nested identities across reorders', () => {
    const store = createNestedStore({
      profile: {
        contacts: [
          { id: 'a', address: { phones: [{ code: 'home', value: '1' }, { code: 'work', value: '2' }] } },
          { id: 'b', address: { phones: [{ code: 'mobile', value: '3' }] } },
        ],
      },
    })
    const [aBefore, bBefore] = store.listRows('contacts-scope')
    const aPhonesBefore = store.listRows('phones-scope', aBefore!.scope)

    store.replaceValues({
      profile: {
        contacts: [
          { id: 'b', address: { phones: [{ code: 'mobile', value: 'updated' }] } },
          { id: 'a', address: { phones: [{ code: 'work', value: '2' }, { code: 'home', value: '1' }] } },
        ],
      },
    })

    const [bAfter, aAfter] = store.listRows('contacts-scope')
    const aPhonesAfter = store.listRows('phones-scope', aAfter!.scope)
    expect(bAfter!.rowId).toBe(bBefore!.rowId)
    expect(aAfter!.rowId).toBe(aBefore!.rowId)
    expect(aPhonesAfter.map(row => row.rowId)).toEqual([
      aPhonesBefore[1]!.rowId,
      aPhonesBefore[0]!.rowId,
    ])
    expect(store.resolvePath('phone-value-node', aPhonesBefore[0]!.scope)).toEqual([
      'profile',
      'contacts',
      1,
      'address',
      'phones',
      1,
      'value',
    ])
  })

  it('recreates unkeyed and missing-key identities on whole-value replacement', () => {
    const store = createConfigFormValueScopeStore({
      createRowId: sequentialIds(),
      scopes: [
        { nodeId: 'plain', field: 'plain', kind: 'array' },
        { nodeId: 'keyed', field: 'keyed', kind: 'array', itemKey: 'id' },
      ],
      fields: [],
      values: { plain: [{ value: 1 }], keyed: [{ value: 2 }] },
    })
    const plainBefore = store.listRows('plain')[0]!
    const keyedBefore = store.listRows('keyed')[0]!

    const result = store.replaceValues({ plain: [{ value: 1 }], keyed: [{ value: 2 }] })
    const plainAfter = store.listRows('plain')[0]!
    const keyedAfter = store.listRows('keyed')[0]!
    expect(plainAfter.rowId).not.toBe(plainBefore.rowId)
    expect(keyedAfter.rowId).not.toBe(keyedBefore.rowId)
    expect(result.invalidatedScopes).toContainEqual(plainBefore.scope)
    expect(result.invalidatedScopes).toContainEqual(keyedBefore.scope)
  })

  it('rejects ambiguous keyed replacement without changing values or identities', () => {
    const store = createNestedStore({
      profile: { contacts: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] },
    })
    const beforeValues = store.getValues()
    const beforeRows = store.listRows('contacts-scope')

    expect(() => store.replaceValues({
      profile: { contacts: [{ id: 'a' }, { id: 'a' }] },
    })).toThrowError(expect.objectContaining({
      code: 'CONFIG_FORM_VALUE_SCOPE_ITEM_KEY_AMBIGUOUS',
      path: 'values["profile"]["contacts"][1]["id"]',
    }))
    expect(store.getValues()).toEqual(beforeValues)
    expect(store.listRows('contacts-scope')).toEqual(beforeRows)
  })
})
