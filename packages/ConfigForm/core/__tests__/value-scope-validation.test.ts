import type { ConfigFormJsonObject } from '../src/json'
import type { ConfigFormValueScopeDefinition, ConfigFormValueScopeError } from '../src/value-scope'
import { describe, expect, it } from 'vitest'
import {
  CONFIG_FORM_VALUE_SCOPE_MAX_DEPTH,
  createConfigFormValueScopeStore,
} from '../src/value-scope'

function expectScopeError(
  action: () => unknown,
  code: string,
  path?: string,
): void {
  expect(action).toThrowError(expect.objectContaining<Partial<ConfigFormValueScopeError>>({
    code,
    ...(path === undefined ? {} : { path }),
  }))
}

describe('config-form value scope schema validation', () => {
  it('accepts the same business field under different scopes', () => {
    const store = createConfigFormValueScopeStore({
      scopes: [
        { nodeId: 'left', field: 'left', kind: 'object' },
        { nodeId: 'right', field: 'right', kind: 'object' },
      ],
      fields: [
        { nodeId: 'left-name', field: 'name', scopeId: 'left', defaultValue: 'L' },
        { nodeId: 'right-name', field: 'name', scopeId: 'right', defaultValue: 'R' },
      ],
    })

    expect(store.getValues()).toEqual({ left: { name: 'L' }, right: { name: 'R' } })
  })

  it.each([
    {
      code: 'CONFIG_FORM_VALUE_SCOPE_NODE_ID_DUPLICATE',
      fields: [{ nodeId: 'same', field: 'value' }],
      scopes: [{ nodeId: 'same', field: 'rows', kind: 'array' }],
    },
    {
      code: 'CONFIG_FORM_VALUE_SCOPE_PARENT_NOT_FOUND',
      fields: [],
      scopes: [{ nodeId: 'child', field: 'child', kind: 'object', parentId: 'missing' }],
    },
    {
      code: 'CONFIG_FORM_VALUE_SCOPE_FIELD_OWNER_NOT_FOUND',
      fields: [{ nodeId: 'field', field: 'value', scopeId: 'missing' }],
      scopes: [],
    },
    {
      code: 'CONFIG_FORM_VALUE_SCOPE_BOUNDS_INVALID',
      fields: [],
      scopes: [{ nodeId: 'rows', field: 'rows', kind: 'array', minItems: 2, maxItems: 1 }],
    },
    {
      code: 'CONFIG_FORM_VALUE_SCOPE_ARRAY_OPTIONS_INVALID',
      fields: [],
      scopes: [{ nodeId: 'object', field: 'object', kind: 'object', minItems: 1 }],
    },
    {
      code: 'CONFIG_FORM_VALUE_SCOPE_KEY_INVALID',
      fields: [{ nodeId: 'field', field: 'constructor' }],
      scopes: [],
    },
  ] as const)('rejects malformed schema with $code', ({ code, fields, scopes }) => {
    expectScopeError(
      () => createConfigFormValueScopeStore({
        fields: fields as any,
        scopes: scopes as any,
      }),
      code,
    )
  })

  it('rejects sibling business-key collisions but not cross-scope names', () => {
    expectScopeError(() => createConfigFormValueScopeStore({
      scopes: [{ nodeId: 'group', field: 'value', kind: 'object' }],
      fields: [{ nodeId: 'field', field: 'value' }],
    }), 'CONFIG_FORM_VALUE_SCOPE_FIELD_DUPLICATE', 'scopes[0].field')
  })

  it('rejects topology cycles with a precise code', () => {
    expectScopeError(() => createConfigFormValueScopeStore({
      scopes: [
        { nodeId: 'one', field: 'one', kind: 'object', parentId: 'two' },
        { nodeId: 'two', field: 'two', kind: 'object', parentId: 'one' },
      ],
      fields: [],
    }), 'CONFIG_FORM_VALUE_SCOPE_CYCLE')
  })

  it('accepts 32 topology levels and rejects level 33', () => {
    const createScopes = (count: number): ConfigFormValueScopeDefinition[] => Array.from(
      { length: count },
      (_, index) => ({
        nodeId: `scope-${index}`,
        field: `level-${index}`,
        kind: 'object',
        ...(index === 0 ? {} : { parentId: `scope-${index - 1}` }),
      }),
    )

    expect(() => createConfigFormValueScopeStore({
      scopes: createScopes(CONFIG_FORM_VALUE_SCOPE_MAX_DEPTH),
      fields: [],
    })).not.toThrow()
    expectScopeError(() => createConfigFormValueScopeStore({
      scopes: createScopes(CONFIG_FORM_VALUE_SCOPE_MAX_DEPTH + 1),
      fields: [],
    }), 'CONFIG_FORM_VALUE_SCOPE_DEPTH_EXCEEDED')
  })
})

describe('config-form value scope JSON and shape validation', () => {
  it.each([
    {
      code: 'CONFIG_FORM_VALUE_SCOPE_ARRAY_SHAPE_INVALID',
      scopes: [{ nodeId: 'rows', field: 'rows', kind: 'array' }],
      values: { rows: {} },
    },
    {
      code: 'CONFIG_FORM_VALUE_SCOPE_OBJECT_SHAPE_INVALID',
      scopes: [{ nodeId: 'group', field: 'group', kind: 'object' }],
      values: { group: [] },
    },
    {
      code: 'CONFIG_FORM_VALUE_SCOPE_ROW_SHAPE_INVALID',
      scopes: [{ nodeId: 'rows', field: 'rows', kind: 'array' }],
      values: { rows: ['not-an-object'] },
    },
    {
      code: 'CONFIG_FORM_VALUE_SCOPE_MAX_ITEMS',
      scopes: [{ nodeId: 'rows', field: 'rows', kind: 'array', maxItems: 1 }],
      values: { rows: [{}, {}] },
    },
    {
      code: 'CONFIG_FORM_VALUE_SCOPE_ITEM_KEY_INVALID',
      scopes: [{ nodeId: 'rows', field: 'rows', kind: 'array', itemKey: 'id' }],
      values: { rows: [{ id: false }] },
    },
  ] as const)('rejects invalid declared value shape with $code', ({ code, scopes, values }) => {
    expectScopeError(() => createConfigFormValueScopeStore({
      scopes: scopes as any,
      fields: [],
      values: values as any,
    }), code)
  })

  it('rejects circular, non-JSON, dangerous-key, and over-depth data', () => {
    expectScopeError(
      () => createConfigFormValueScopeStore({ scopes: [], fields: [], values: null as any }),
      'CONFIG_FORM_VALUE_SCOPE_VALUES_SHAPE_INVALID',
      'values',
    )

    const circular: Record<string, unknown> = {}
    circular.self = circular
    expectScopeError(() => createConfigFormValueScopeStore({
      scopes: [],
      fields: [],
      values: circular as ConfigFormJsonObject,
    }), 'CONFIG_FORM_VALUE_SCOPE_JSON_CIRCULAR', 'values["self"]')

    expectScopeError(() => createConfigFormValueScopeStore({
      scopes: [],
      fields: [],
      values: { invalid: undefined } as unknown as ConfigFormJsonObject,
    }), 'CONFIG_FORM_VALUE_SCOPE_JSON_INVALID', 'values["invalid"]')

    const unsafe = Object.create(null) as ConfigFormJsonObject
    Object.defineProperty(unsafe, '__proto__', { enumerable: true, value: 'unsafe' })
    expectScopeError(
      () => createConfigFormValueScopeStore({ scopes: [], fields: [], values: unsafe }),
      'CONFIG_FORM_VALUE_SCOPE_UNSAFE_KEY',
      'values["__proto__"]',
    )
    const unsafeArray: unknown[] = []
    Object.defineProperty(unsafeArray, '__proto__', { enumerable: true, value: 'unsafe' })
    expectScopeError(
      () => createConfigFormValueScopeStore({
        scopes: [],
        fields: [],
        values: { list: unsafeArray } as unknown as ConfigFormJsonObject,
      }),
      'CONFIG_FORM_VALUE_SCOPE_UNSAFE_KEY',
      'values["list"]["__proto__"]',
    )

    const deep: Record<string, unknown> = {}
    let cursor = deep
    for (let index = 0; index <= CONFIG_FORM_VALUE_SCOPE_MAX_DEPTH; index += 1) {
      cursor.next = {}
      cursor = cursor.next as Record<string, unknown>
    }
    expectScopeError(() => createConfigFormValueScopeStore({
      scopes: [],
      fields: [],
      values: deep as ConfigFormJsonObject,
    }), 'CONFIG_FORM_VALUE_SCOPE_JSON_LIMIT_EXCEEDED')
  })

  it('fills minItems recursively with independent field defaults', () => {
    const store = createConfigFormValueScopeStore({
      scopes: [
        { nodeId: 'rows', field: 'rows', kind: 'array', minItems: 2 },
        { nodeId: 'details', field: 'details', kind: 'object', parentId: 'rows' },
        { nodeId: 'children', field: 'children', kind: 'array', parentId: 'details', minItems: 1 },
      ],
      fields: [{ nodeId: 'value-node', field: 'value', scopeId: 'children', defaultValue: { nested: [] } }],
    })

    expect(store.getValues()).toEqual({
      rows: [
        { details: { children: [{ value: { nested: [] } }] } },
        { details: { children: [{ value: { nested: [] } }] } },
      ],
    })
    const outerRows = store.listRows('rows')
    expect(store.listRows('children', outerRows[0]!.scope)[0]!.rowId).not.toBe(
      store.listRows('children', outerRows[1]!.scope)[0]!.rowId,
    )
  })
})

describe('config-form value scope atomic failures', () => {
  it('keeps values and identities unchanged after invalid mutations', () => {
    let id = 0
    const store = createConfigFormValueScopeStore({
      createRowId: () => `id-${++id}`,
      scopes: [{ nodeId: 'rows', field: 'rows', kind: 'array', minItems: 1, maxItems: 2, itemKey: 'id' }],
      fields: [{ nodeId: 'value-node', field: 'value', scopeId: 'rows' }],
      values: { rows: [{ id: 'one', value: 'A' }, { id: 'two', value: 'B' }] },
    })
    const beforeValues = store.getValues()
    const beforeRows = store.listRows('rows')

    expectScopeError(() => store.appendRow('rows', { id: 'three' }), 'CONFIG_FORM_VALUE_SCOPE_MAX_ITEMS')
    expectScopeError(() => store.insertRow('rows', -1), 'CONFIG_FORM_VALUE_SCOPE_INDEX_INVALID')
    expectScopeError(() => store.moveRow('rows', beforeRows[0]!.rowId, 4), 'CONFIG_FORM_VALUE_SCOPE_INDEX_INVALID')
    expectScopeError(
      () => store.setValue('value-node', undefined as any, beforeRows[0]!.scope),
      'CONFIG_FORM_VALUE_SCOPE_JSON_INVALID',
    )
    expectScopeError(
      () => store.replaceValues({ rows: [{ id: 'duplicate' }, { id: 'duplicate' }] }),
      'CONFIG_FORM_VALUE_SCOPE_ITEM_KEY_AMBIGUOUS',
    )

    expect(store.getValues()).toEqual(beforeValues)
    expect(store.listRows('rows')).toEqual(beforeRows)
  })

  it('bounds duplicate row-ID generation and leaves the store unchanged', () => {
    const store = createConfigFormValueScopeStore({
      createRowId: () => 'fixed-id',
      scopes: [{ nodeId: 'rows', field: 'rows', kind: 'array' }],
      fields: [],
      values: { rows: [{}] },
    })
    const beforeValues = store.getValues()
    const beforeRows = store.listRows('rows')

    expectScopeError(() => store.appendRow('rows'), 'CONFIG_FORM_VALUE_SCOPE_ROW_ID_EXHAUSTED', 'createRowId')
    expect(store.getValues()).toEqual(beforeValues)
    expect(store.listRows('rows')).toEqual(beforeRows)
  })

  it('never reuses a deleted row identity', () => {
    const ids = ['first', 'first', 'second']
    const store = createConfigFormValueScopeStore({
      createRowId: () => ids.shift() ?? 'second',
      scopes: [{ nodeId: 'rows', field: 'rows', kind: 'array' }],
      fields: [],
      values: { rows: [{}] },
    })
    const first = store.listRows('rows')[0]!
    store.removeRow('rows', first.rowId)
    const appended = store.appendRow('rows')

    expect(first.rowId).toBe('first')
    expect(appended.row.rowId).toBe('second')
  })
})
