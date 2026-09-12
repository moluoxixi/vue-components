import type {
  ConfigFormFieldAddress,
  ConfigFormLifecycleContext,
  ConfigFormNode,
  ConfigFormScopePath,
  ConfigFormValueSchema,
} from '../index'
import { describe, expect, it, vi } from 'vitest'
import { createConfigFormController } from '../index'

interface NestedValues {
  name: string
  profile: { name: string }
  groups: Array<{
    id: string
    name: string
    items: Array<{ id: string, name: string }>
  }>
}

function createModel<T extends object>(initial: T) {
  let value = initial
  return {
    adapter: {
      read: () => value,
      write: (next: T) => value = next,
    },
    read: () => value,
  }
}

function createRowIdFactory() {
  let next = 0
  return () => `test-row-${++next}`
}

function nestedFields(
  itemOptions: Partial<ConfigFormNode<NestedValues, string>> = {},
): ConfigFormNode<NestedValues, string>[] {
  return [
    { component: 'input', field: 'name', id: 'root-name' },
    {
      component: 'section',
      id: 'profile-scope',
      slots: {
        default: [{ component: 'input', field: 'name', id: 'profile-name' }],
      },
      valueScope: { field: 'profile', kind: 'object' },
    },
    {
      component: 'section',
      id: 'groups-scope',
      slots: {
        default: [
          { component: 'input', field: 'name', id: 'group-name' },
          {
            component: 'section',
            id: 'items-scope',
            slots: {
              default: [{
                component: 'input',
                field: 'name',
                id: 'item-name',
                required: true,
                ...itemOptions,
              } as ConfigFormNode<NestedValues, string>],
            },
            valueScope: { field: 'items', itemKey: 'id', kind: 'array', maxItems: 3 },
          },
        ],
      },
      valueScope: {
        field: 'groups',
        itemKey: 'id',
        kind: 'array',
        maxItems: 4,
        minItems: 1,
      },
    },
  ]
}

function nestedInitial(): NestedValues {
  return {
    groups: [
      {
        id: 'g-1',
        items: [
          { id: 'i-1', name: 'Item one' },
          { id: 'i-2', name: '' },
        ],
        name: 'Group one',
      },
      {
        id: 'g-2',
        items: [{ id: 'i-3', name: 'Item three' }],
        name: 'Group two',
      },
    ],
    name: 'Root',
    profile: { name: 'Profile' },
  }
}

function findInstance(
  controller: ReturnType<typeof createConfigFormController<NestedValues>>,
  nodeId: string,
  predicate: (path: readonly (number | string)[]) => boolean = () => true,
) {
  const instance = controller.listFieldInstances(nodeId).find(item => predicate(item.valuePath))
  if (!instance)
    throw new Error(`Missing instance ${nodeId}`)
  return instance
}

describe('configForm scoped controller', () => {
  it('derives object and two-level array ownership without merging equal field names', () => {
    const model = createModel(nestedInitial())
    const controller = createConfigFormController<NestedValues>({
      createRowId: createRowIdFactory(),
      fields: () => nestedFields(),
      model: model.adapter,
    })

    const root = findInstance(controller, 'root-name')
    const profile = findInstance(controller, 'profile-name')
    const groups = controller.listFieldInstances('group-name')
    const items = controller.listFieldInstances('item-name')

    expect(root).toMatchObject({ address: { nodeId: 'root-name', scope: [] }, value: 'Root', valuePath: ['name'] })
    expect(profile).toMatchObject({ address: { nodeId: 'profile-name', scope: [] }, value: 'Profile', valuePath: ['profile', 'name'] })
    expect(root.instanceKey).not.toBe(profile.instanceKey)
    expect(groups).toHaveLength(2)
    expect(items).toHaveLength(3)
    expect(new Set(items.map(item => item.instanceKey)).size).toBe(3)

    controller.setValue('name', 'Root changed')
    controller.setInstanceValue(profile.address, 'Profile changed')
    controller.setInstanceValue(items[1]!.address, 'Item two')
    expect(model.read().name).toBe('Root changed')
    expect(model.read().profile).toEqual({ name: 'Profile changed' })
    expect(model.read().groups[0]!.items[0]!.name).toBe('Item one')
    expect(model.read().groups[0]!.items[1]!.name).toBe('Item two')
    expect(controller.getFieldMeta('name')).toEqual({ dirty: true, touched: false })
    expect(controller.getInstanceMeta(profile.address).dirty).toBe(true)
    expect(controller.getInstanceMeta(groups[0]!.address).dirty).toBe(false)
    expect(controller.getInstanceMeta(items[0]!.address).dirty).toBe(false)
    expect(controller.getInstanceMeta(items[1]!.address).dirty).toBe(true)
    expect(Object.keys(controller.getMeta().fields).sort()).toEqual([
      root,
      profile,
      ...groups,
      ...items,
    ].map(instance => instance.instanceKey).sort())
    const outerRows = controller.listRows('groups-scope')
    const firstNestedRows = controller.listRows('items-scope', outerRows[0]!.scope)
    const copied = controller.duplicateRow('groups-scope', outerRows[0]!.rowId)
    expect(copied.row.rowId).not.toBe(outerRows[0]!.rowId)
    const copiedNestedRows = controller.listRows('items-scope', copied.row.scope)
    expect(copiedNestedRows.map(row => row.rowId)).not.toEqual(firstNestedRows.map(row => row.rowId))

    const appended = controller.appendRow('groups-scope', {
      id: 'g-3',
      items: [],
      name: 'Group three',
    })
    expect(controller.listRows('groups-scope')).toHaveLength(4)
    expect(() => controller.appendRow('groups-scope')).toThrowError(/cannot accept another row/i)

    controller.moveRow('groups-scope', appended.row.rowId, 0)
    expect(model.read().groups[0]?.id).toBe('g-3')
    controller.removeRow('groups-scope', copied.row.rowId)
    expect(model.read().groups.map(group => group.id)).toEqual(['g-3', 'g-1', 'g-2'])

    const g2 = controller.listRows('groups-scope').find(row => row.value.id === 'g-2')!
    controller.appendRow('items-scope', { id: 'i-4', name: 'Item four' }, g2.scope)
    expect(model.read().groups[2]?.items).toEqual([
      { id: 'i-3', name: 'Item three' },
      { id: 'i-4', name: 'Item four' },
    ])

    const remaining = controller.listRows('groups-scope')
    controller.removeRow('groups-scope', remaining[2]!.rowId)
    controller.removeRow('groups-scope', remaining[1]!.rowId)
    expect(() => controller.removeRow('groups-scope', remaining[0]!.rowId)).toThrowError(/at least 1 rows/i)
  })

  it('reconciles keyed rows and invalidates unkeyed row state on replacement', () => {
    interface ReplaceValues {
      keyed: Array<{ id: string, value: string }>
      unkeyed: Array<{ value: string }>
      title: string
    }
    const fields: ConfigFormNode<ReplaceValues, string>[] = [
      { component: 'input', field: 'title', id: 'replace-title' },
      {
        component: 'section',
        id: 'keyed-scope',
        slots: { default: [{ component: 'input', field: 'value', id: 'keyed-value' }] },
        valueScope: { field: 'keyed', itemKey: 'id', kind: 'array' },
      },
      {
        component: 'section',
        id: 'unkeyed-scope',
        slots: { default: [{ component: 'input', field: 'value', id: 'unkeyed-value' }] },
        valueScope: { field: 'unkeyed', kind: 'array' },
      },
    ]
    const model = createModel<ReplaceValues>({
      keyed: [{ id: 'a', value: 'A' }, { id: 'b', value: 'B' }],
      unkeyed: [{ value: 'one' }, { value: 'two' }],
      title: 'initial',
    })
    const controller = createConfigFormController<ReplaceValues>({
      createRowId: createRowIdFactory(),
      fields: () => fields,
      model: model.adapter,
    })
    const keyedBefore = controller.listRows('keyed-scope')
    const unkeyedBefore = controller.listRows('unkeyed-scope')
    controller.setValues({ title: 'partial' })
    expect(controller.listRows('keyed-scope').map(row => row.rowId)).toEqual(keyedBefore.map(row => row.rowId))
    expect(controller.listRows('unkeyed-scope').map(row => row.rowId)).toEqual(unkeyedBefore.map(row => row.rowId))
    const keyedA = controller.listFieldInstances('keyed-value')[0]!
    const unkeyedFirst = controller.listFieldInstances('unkeyed-value')[0]!
    controller.setInstanceTouched(keyedA.address)
    controller.setInstanceTouched(unkeyedFirst.address)
    controller.setErrors({
      [keyedA.instanceKey]: ['keyed error'],
      [unkeyedFirst.instanceKey]: ['unkeyed error'],
    })

    controller.setValues({
      keyed: [{ id: 'b', value: 'B2' }, { id: 'a', value: 'A2' }],
      unkeyed: [{ value: 'next one' }, { value: 'next two' }],
      title: 'replaced',
    }, true)

    const keyedAfter = controller.listRows('keyed-scope')
    const unkeyedAfter = controller.listRows('unkeyed-scope')
    expect(keyedAfter.map(row => row.rowId)).toEqual([
      keyedBefore[1]!.rowId,
      keyedBefore[0]!.rowId,
    ])
    expect(unkeyedAfter.map(row => row.rowId)).not.toEqual(unkeyedBefore.map(row => row.rowId))
    expect(controller.getInstanceMeta(keyedA.address).touched).toBe(true)
    expect(controller.getMeta().fields).not.toHaveProperty(unkeyedFirst.instanceKey)
    expect(controller.getErrors()).toEqual({ [keyedA.instanceKey]: ['keyed error'] })
    expect(controller.getIssues()[0]?.valuePath).toEqual(['keyed', 1, 'value'])
  })

  it('keeps untouched nested identities, errors, and touched state through partial updates and resets', async () => {
    interface PartialValues { title?: string, rows: Array<{ value: string }> }
    const model = createModel<PartialValues>({ rows: [{ value: 'row' }] })
    const fields: ConfigFormNode<PartialValues, string>[] = [
      { component: 'input', field: 'title', id: 'title' },
      {
        component: 'section',
        id: 'rows',
        slots: { default: [{ component: 'input', field: 'value', id: 'row-value' }] },
        valueScope: { field: 'rows', kind: 'array' },
      },
    ]
    const controller = createConfigFormController<PartialValues>({
      fields: () => fields,
      model: model.adapter,
    })
    const row = controller.listRows('rows')[0]!
    const instance = controller.listFieldInstances('row-value')[0]!
    controller.setInstanceTouched(instance.address)
    controller.setErrors({ [instance.instanceKey]: ['kept error'] })
    controller.setValues({ title: 'changed' })
    expect(model.read().title).toBe('changed')
    await expect(controller.resetFields('title')).resolves.toBe(true)
    expect(model.read()).not.toHaveProperty('title')
    expect(controller.listRows('rows')[0]!.rowId).toBe(row.rowId)
    expect(controller.getInstanceMeta(instance.address).touched).toBe(true)
    expect(controller.getInstanceErrors(instance.address)).toEqual(['kept error'])

    expect(() => controller.setValues({ title: 'not committed', rows: 'invalid' } as unknown as PartialValues)).toThrow()
    expect(model.read()).toEqual({ rows: [{ value: 'row' }] })
    expect(controller.listRows('rows')[0]!.rowId).toBe(row.rowId)
    expect(controller.getInstanceValue(instance.address)).toBe('row')
  })

  it('preserves two-level unkeyed rows through root setValues and partial reset', async () => {
    interface PartialValues { title?: string, rows: Array<{ items: Array<{ value: string }> }> }
    const model = createModel<PartialValues>({ rows: [{ items: [{ value: 'initial' }] }] })
    const controller = createConfigFormController<PartialValues>({
      fields: () => [{
        component: 'section',
        id: 'rows',
        slots: { default: [{
          component: 'section',
          id: 'items',
          slots: { default: [{ component: 'input', field: 'value', id: 'item-value' }] },
          valueScope: { field: 'items', kind: 'array' },
        }] },
        valueScope: { field: 'rows', kind: 'array' },
      }],
      model: model.adapter,
    })
    const rows = controller.listRows('rows')
    const items = controller.listRows('items', rows[0]!.scope)
    const instance = controller.listFieldInstances('item-value')[0]!
    controller.setInstanceValue(instance.address, 'changed')
    controller.setInstanceTouched(instance.address)
    controller.setErrors({ [instance.instanceKey]: ['kept error'] })

    controller.setValues({ title: 'partial' })
    await expect(controller.resetFields('title')).resolves.toBe(true)

    expect(model.read()).toEqual({ rows: [{ items: [{ value: 'changed' }] }] })
    expect(controller.listRows('rows').map(row => row.rowId)).toEqual(rows.map(row => row.rowId))
    expect(controller.listRows('items', rows[0]!.scope).map(row => row.rowId)).toEqual(items.map(row => row.rowId))
    expect(controller.getInstanceMeta(instance.address)).toEqual({ dirty: true, touched: true })
    expect(controller.getInstanceErrors(instance.address)).toEqual(['kept error'])
  })

  it('validates every row by stable address, preserves sorted state, and cancels removed work', async () => {
    let releaseAsync!: (message: string) => void
    let asyncSignal!: AbortSignal
    const validator = vi.fn((value: unknown, _values: NestedValues, context: { signal: AbortSignal }) => {
      if (value !== 'pending')
        return undefined
      asyncSignal = context.signal
      return new Promise<string>(resolve => releaseAsync = resolve)
    })
    const model = createModel(nestedInitial())
    const controller = createConfigFormController<NestedValues>({
      createRowId: createRowIdFactory(),
      fields: () => nestedFields({ validator } as never),
      model: model.adapter,
    })

    await expect(controller.validate()).resolves.toBe(false)
    const requiredIssue = controller.getIssues().find(issue => issue.code === 'required')!
    expect(requiredIssue).toMatchObject({
      nodeId: 'item-name',
      scope: expect.any(Array),
      valuePath: ['groups', 0, 'items', 1, 'name'],
    })
    expect(controller.getErrors()[requiredIssue.instanceKey]).toEqual(['必填'])

    controller.setInstanceTouched(requiredIssue.address)
    const innerRowId = requiredIssue.scope.at(-1)!.rowId
    const parentScope = requiredIssue.scope.slice(0, -1)
    controller.moveRow('items-scope', innerRowId, 0, parentScope)
    expect(controller.getInstanceMeta(requiredIssue.address).touched).toBe(true)
    expect(controller.getErrors()[requiredIssue.instanceKey]).toEqual(['必填'])
    expect(controller.getIssues().find(issue => issue.instanceKey === requiredIssue.instanceKey)?.valuePath)
      .toEqual(['groups', 0, 'items', 0, 'name'])

    controller.setInstanceValue(requiredIssue.address, 'pending')
    const pending = controller.validateInstance(requiredIssue.address)
    expect(asyncSignal.aborted).toBe(false)
    controller.setInstanceTouched(requiredIssue.address)
    const removed = controller.removeRow('items-scope', innerRowId, parentScope)
    expect(removed.invalidatedScopes).toContainEqual(requiredIssue.scope)
    expect(asyncSignal.aborted).toBe(true)
    releaseAsync('late error')
    await expect(pending).resolves.toBe(false)
    expect(controller.getErrors()).not.toHaveProperty(requiredIssue.instanceKey)
    expect(controller.getMeta().fields).not.toHaveProperty(requiredIssue.instanceKey)
  })

  it('aborts validation owned by an unkeyed scope invalidated by replaceValues', async () => {
    interface ReplaceAsyncValues { rows: Array<{ value: string }> }
    let release!: (message: string) => void
    let signal!: AbortSignal
    const fields: ConfigFormNode<ReplaceAsyncValues, string>[] = [{
      component: 'section',
      id: 'replace-rows',
      slots: {
        default: [{
          component: 'input',
          field: 'value',
          id: 'replace-value',
          validator: (_value, _values, context) => {
            signal = context.signal
            return new Promise<string>(resolve => release = resolve)
          },
        }],
      },
      valueScope: { field: 'rows', kind: 'array' },
    }]
    const model = createModel<ReplaceAsyncValues>({ rows: [{ value: 'before' }] })
    const controller = createConfigFormController<ReplaceAsyncValues>({
      createRowId: createRowIdFactory(),
      fields: () => fields,
      model: model.adapter,
    })
    const instance = controller.listFieldInstances('replace-value')[0]!
    controller.setInstanceTouched(instance.address)
    const pending = controller.validateInstance(instance.address)

    controller.setValues({ rows: [{ value: 'after' }] }, true)
    expect(signal.aborted).toBe(true)
    expect(controller.listFieldInstances('replace-value')[0]!.instanceKey).not.toBe(instance.instanceKey)
    expect(controller.getMeta().fields).not.toHaveProperty(instance.instanceKey)
    release('late replacement error')
    await expect(pending).resolves.toBe(false)
    expect(controller.getErrors()).not.toHaveProperty(instance.instanceKey)
  })

  it.each(['instance', 'node'] as const)('keeps form readonly above scoped %s overrides', async (key) => {
    const model = createModel(nestedInitial())
    const onSubmit = vi.fn()
    const validator = vi.fn()
    let readonly = true
    let states: Record<string, { readonly: boolean }> = {}
    const controller = createConfigFormController<NestedValues>({
      fields: () => nestedFields({ readonly: true, validator } as never),
      model: model.adapter,
      onSubmit,
      reactionStates: () => states,
      readonly: () => () => readonly,
    })
    const items = controller.listFieldInstances('item-name')
    states = Object.fromEntries(items.map(instance => [
      key === 'instance' ? instance.instanceKey : instance.address.nodeId,
      { readonly: false },
    ]))

    await expect(controller.validateInstance(items[1]!.address)).resolves.toBe(true)
    await expect(controller.submit()).resolves.toBe(true)
    expect(validator).not.toHaveBeenCalled()
    expect(controller.getErrors()).toEqual({})
    expect(onSubmit).toHaveBeenCalledWith(nestedInitial())
    expect(items.every(instance => !controller.getInstanceMeta(instance.address).touched)).toBe(true)

    readonly = false
    await expect(controller.validateInstance(items[1]!.address)).resolves.toBe(false)
    expect(controller.getIssues()).toEqual([expect.objectContaining({
      code: 'required',
      instanceKey: items[1]!.instanceKey,
    })])
    await expect(controller.validateInstance(items[0]!.address)).resolves.toBe(true)
    expect(validator).toHaveBeenCalledOnce()
  })

  it('preserves hidden and disabled submission policies under form readonly', async () => {
    interface PolicyValues { rows: Array<Record<string, string>> }
    const model = createModel<PolicyValues>({ rows: [{ disabled: '', hidden: '', kept: '', visible: '' }] })
    const onSubmit = vi.fn()
    const controller = createConfigFormController<PolicyValues>({
      fields: () => [{
        component: 'section',
        id: 'rows',
        slots: { default: [
          { component: 'input', field: 'hidden', hidden: true, id: 'hidden', required: true },
          { component: 'input', disabled: true, field: 'disabled', id: 'disabled', required: true },
          { component: 'input', disabled: true, field: 'kept', hidden: true, id: 'kept', required: true, submitWhenDisabled: true, submitWhenHidden: true },
          { component: 'input', field: 'visible', id: 'visible', required: true },
        ] },
        valueScope: { field: 'rows', kind: 'array' },
      }],
      model: model.adapter,
      onSubmit,
      reactionStates: () => Object.fromEntries(['disabled', 'hidden', 'kept', 'visible'].map(id => [id, { readonly: false }])),
      readonly: () => true,
    })

    await expect(controller.submit()).resolves.toBe(true)
    expect(onSubmit).toHaveBeenCalledWith({ rows: [{ kept: '', visible: '' }] })
    expect(controller.getMeta().touched).toBe(false)
  })

  it('submits natural JSON with instance policies and deeply rebuilds reset baseline', async () => {
    const initial = nestedInitial()
    const model = createModel(initial)
    const onSubmit = vi.fn()
    const fields = nestedFields({ readonly: true })
    const root = fields[0] as Extract<ConfigFormNode<NestedValues, string>, { field: unknown }>
    root.readonly = true
    root.required = true
    const profileContainer = fields[1] as Exclude<ConfigFormNode<NestedValues, string>, { field: unknown }>
    const profileField = (profileContainer.slots!.default as ConfigFormNode<NestedValues, string>[])[0] as Extract<ConfigFormNode<NestedValues, string>, { field: unknown }>
    profileField.hidden = true
    const groupContainer = fields[2] as Exclude<ConfigFormNode<NestedValues, string>, { field: unknown }>
    const groupField = (groupContainer.slots!.default as ConfigFormNode<NestedValues, string>[])[0] as Extract<ConfigFormNode<NestedValues, string>, { field: unknown }>
    groupField.disabled = true

    const controller = createConfigFormController<NestedValues>({
      createRowId: createRowIdFactory(),
      fields: () => fields,
      model: model.adapter,
      onSubmit,
    })

    await expect(controller.submit()).resolves.toBe(true)
    expect(onSubmit).toHaveBeenCalledWith({
      groups: [
        {
          id: 'g-1',
          items: [{ id: 'i-1', name: 'Item one' }, { id: 'i-2', name: '' }],
        },
        { id: 'g-2', items: [{ id: 'i-3', name: 'Item three' }] },
      ],
      name: 'Root',
      profile: {},
    })

    const item = controller.listFieldInstances('item-name')[0]!
    controller.setInstanceValue(item.address, 'Changed')
    controller.appendRow('groups-scope', { id: 'g-3', items: [], name: 'Added' })
    controller.setInstanceTouched(item.address)
    controller.setErrors({ [item.instanceKey]: ['error'] })
    initial.groups[0]!.items[0]!.name = 'mutated source'

    await expect(controller.resetFields()).resolves.toBe(true)
    expect(model.read()).toEqual(nestedInitial())
    expect(controller.getErrors()).toEqual({})
    expect(controller.getMeta()).toMatchObject({ dirty: false, touched: false })
    expect(Object.values(controller.getMeta().fields).every(meta => !meta.dirty && !meta.touched)).toBe(true)
  })

  it('accepts compiler valueSchema and includes address/scope in instance lifecycle input', async () => {
    interface CompiledValues { lines: Array<{ label: string }> }
    const fields: ConfigFormNode<CompiledValues, string>[] = [{
      component: 'section',
      id: 'plain-layout',
      slots: {
        default: [{ component: 'input', field: 'label', id: 'compiled-label' }],
      },
    }]
    const valueSchema: ConfigFormValueSchema = {
      scopedFields: [{ field: 'label', nodeId: 'compiled-label', scopeId: 'compiled-lines' }],
      valueScopes: [{ field: 'lines', kind: 'array', nodeId: 'compiled-lines' }],
    }
    const model = createModel<CompiledValues>({ lines: [{ label: 'before' }] })
    const lifecycles: ConfigFormLifecycleContext<CompiledValues>[] = []
    const onFieldChange = vi.fn()
    const controller = createConfigFormController<CompiledValues>({
      createRowId: createRowIdFactory(),
      fields: () => fields,
      model: model.adapter,
      onFieldChange,
      onLifecycle: (kind, context) => {
        if (kind === 'form.valuesChange')
          lifecycles.push(context)
      },
      valueSchema,
    })
    const instance = controller.listFieldInstances('compiled-label')[0]!

    controller.applyFieldInstanceChange({ address: instance.address, value: 'after' })
    await Promise.resolve()

    expect(model.read()).toEqual({ lines: [{ label: 'after' }] })
    expect(onFieldChange).toHaveBeenCalledWith(expect.objectContaining({
      address: instance.address,
      field: 'label',
      scope: instance.address.scope,
      value: 'after',
    }))
    expect(lifecycles).toHaveLength(1)
    expect(lifecycles[0]).toMatchObject({
      address: instance.address,
      scope: instance.address.scope,
    })
    const address: ConfigFormFieldAddress = lifecycles[0]!.address!
    const scope: ConfigFormScopePath = lifecycles[0]!.scope!
    expect(address.scope).toEqual(scope)
  })
})
