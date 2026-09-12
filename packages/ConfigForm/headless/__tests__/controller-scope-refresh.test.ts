import type {
  ConfigFormControllerOptions,
  ConfigFormNode,
  ConfigFormValueSchema,
  ConfigFormValues,
} from '../index'
import { describe, expect, it, vi } from 'vitest'
import { createConfigFormController } from '../index'

type TestValueSchema = {
  scopedFields: ConfigFormValueSchema['scopedFields'][number][]
  valueScopes: ConfigFormValueSchema['valueScopes'][number][]
}

function nestedSchema(): TestValueSchema {
  return {
    scopedFields: [
      { nodeId: 'title', field: 'title' },
      { nodeId: 'retired', field: 'retired' },
      { nodeId: 'group-name', field: 'name', scopeId: 'groups' },
      { nodeId: 'item-name', field: 'name', scopeId: 'items' },
    ],
    valueScopes: [
      { nodeId: 'groups', field: 'groups', kind: 'array' },
      { nodeId: 'items', field: 'items', kind: 'array', parentId: 'groups' },
    ],
  }
}

function initialValues(): ConfigFormValues {
  return {
    title: 'Original',
    retired: 'Remove me',
    extra: 'Unmanaged',
    groups: [
      { name: 'First', items: [{ name: 'One' }, { name: 'Two' }] },
      { name: 'Second', items: [{ name: 'Three' }] },
    ],
  }
}

function fixture(
  schema: ConfigFormValueSchema = nestedSchema(),
  initial = initialValues(),
  options: Partial<ConfigFormControllerOptions<ConfigFormValues>> = {},
) {
  let values = initial
  let fields: ConfigFormNode<ConfigFormValues, string>[] = []
  const setFields = (next: ConfigFormValueSchema): void => {
    fields = next.scopedFields.map(field => ({ id: field.nodeId, field: field.field, component: 'input' }))
  }
  setFields(schema)
  const controller = createConfigFormController<ConfigFormValues>({
    fields: () => fields,
    model: { read: () => values, write: next => values = next },
    valueSchema: schema,
    ...options,
  })
  return {
    controller,
    read: () => values,
    replace: (next: ConfigFormValues) => { values = next },
    update: (next: ConfigFormValueSchema) => {
      setFields(next)
      controller.updateValueSchema(next)
    },
  }
}

async function beforeNextTask<T>(pending: Promise<T>): Promise<T> {
  let timeout!: ReturnType<typeof setTimeout>
  try {
    return await Promise.race([
      pending,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error('Cancelled work did not settle.')), 0)
      }),
    ])
  }
  finally {
    clearTimeout(timeout)
  }
}

describe('controller value schema refresh', () => {
  it('treats deep-equal schemas as no-ops for two levels of unkeyed rows', () => {
    let nextId = 0
    const createRowId = vi.fn(() => `stable-${++nextId}`)
    const onChange = vi.fn()
    const form = fixture(undefined, undefined, { createRowId, onChange })
    const before = form.controller.listFieldInstances()
    const rows = form.controller.listRows('groups')
    const inner = form.controller.listRows('items', rows[0]!.scope)
    const allocated = createRowId.mock.calls.length
    form.update(JSON.parse(JSON.stringify(nestedSchema())) as ConfigFormValueSchema)
    form.controller.refreshReactions()
    expect(form.controller.listFieldInstances()).toEqual(before)
    expect(form.controller.listRows('groups')).toEqual(rows)
    expect(form.controller.listRows('items', rows[0]!.scope)).toEqual(inner)
    expect(createRowId).toHaveBeenCalledTimes(allocated)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('adds defaults and removes retired fields without recapturing edits or reordered row baselines', async () => {
    const form = fixture()
    const { controller } = form
    const rows = controller.listRows('groups')
    const item = controller.listFieldInstances('item-name')[1]!
    const removed = controller.listFieldInstances('retired')[0]!
    controller.setInstanceValue(item.address, 'Edited')
    controller.setValue('title', 'Edited title')
    controller.setInstanceTouched(item.address)
    controller.setInstanceTouched(removed.address)
    controller.setErrors({ [item.instanceKey]: ['Keep'], [removed.instanceKey]: ['Drop'] })
    controller.moveRow('groups', rows[1]!.rowId, 0)
    const before = controller.listFieldInstances('item-name').map(instance => instance.address)
    const schema = nestedSchema()
    schema.scopedFields = schema.scopedFields.filter(field => field.nodeId !== 'retired')
    schema.scopedFields.push(
      { nodeId: 'status', field: 'status', defaultValue: 'draft' },
      { nodeId: 'quantity', field: 'quantity', scopeId: 'items', defaultValue: 3 },
    )
    form.update(schema)

    expect(controller.listRows('groups').map(row => row.rowId)).toEqual([rows[1]!.rowId, rows[0]!.rowId])
    expect(controller.listFieldInstances('item-name').map(instance => instance.address)).toEqual(before)
    expect(controller.getInstanceValue(item.address)).toBe('Edited')
    expect(controller.getInstanceMeta(item.address)).toEqual({ dirty: true, touched: true })
    expect(controller.getErrors()).toEqual({ [item.instanceKey]: ['Keep'] })
    expect(controller.getIssues()[0]?.valuePath).toEqual(['groups', 1, 'items', 1, 'name'])
    expect(controller.getMeta().fields).not.toHaveProperty(removed.instanceKey)
    expect(form.read()).not.toHaveProperty('retired')
    expect(controller.getValue('status')).toBe('draft')
    for (const instance of controller.listFieldInstances('quantity')) {
      expect(instance.value).toBe(3)
      expect(controller.getInstanceMeta(instance.address)).toEqual({ dirty: false, touched: false })
    }
    controller.setValue('status', 'edited status')
    await expect(controller.resetFields()).resolves.toBe(true)
    expect(form.read()).toEqual({
      title: 'Original', extra: 'Unmanaged', status: 'draft',
      groups: [
        { name: 'First', items: [{ name: 'One', quantity: 3 }, { name: 'Two', quantity: 3 }] },
        { name: 'Second', items: [{ name: 'Three', quantity: 3 }] },
      ],
    })
    expect(controller.getMeta()).toMatchObject({ dirty: false, touched: false })
    expect(controller.getErrors()).toEqual({})
  })

  it('clears renamed instance values and meta even when its node and instance key are unchanged', async () => {
    const form = fixture()
    const { controller } = form
    const item = controller.listFieldInstances('item-name')[0]!
    const title = controller.listFieldInstances('title')[0]!
    controller.setInstanceTouched(item.address)
    controller.setInstanceTouched(title.address)
    controller.setErrors({ [item.instanceKey]: ['Old name'], [title.instanceKey]: ['Keep title'] })
    const schema = nestedSchema()
    schema.scopedFields[3] = { nodeId: 'item-name', field: 'label', scopeId: 'items', defaultValue: 'New label' }
    form.update(schema)
    expect(controller.getInstanceKey(item.address)).toBe(item.instanceKey)
    expect(controller.getInstanceValue(item.address)).toBe('New label')
    expect(controller.getInstanceMeta(item.address)).toEqual({ dirty: false, touched: false })
    expect(controller.getInstanceErrors(item.address)).toEqual([])
    expect(controller.getInstanceMeta(title.address).touched).toBe(true)
    expect(controller.getInstanceErrors(title.address)).toEqual(['Keep title'])
    expect(form.read().groups).toEqual([
      { name: 'First', items: [{ label: 'New label' }, { label: 'New label' }] },
      { name: 'Second', items: [{ label: 'New label' }] },
    ])
    await controller.resetFields()
    expect(controller.getInstanceValue(controller.listFieldInstances('item-name')[0]!.address)).toBe('New label')
  })

  it('does not carry values or meta across object scope moves with equal field names', () => {
    const schema: TestValueSchema = {
      scopedFields: [
        { nodeId: 'root-name', field: 'name' },
        { nodeId: 'moving-name', field: 'name', scopeId: 'left' },
        { nodeId: 'right-label', field: 'label', scopeId: 'right' },
      ],
      valueScopes: [
        { nodeId: 'left', field: 'left', kind: 'object' },
        { nodeId: 'right', field: 'right', kind: 'object' },
      ],
    }
    const form = fixture(schema, { name: 'Root', left: { name: 'Left', extra: 1 }, right: { label: 'Right' } })
    const moving = form.controller.listFieldInstances('moving-name')[0]!
    form.controller.setInstanceTouched(moving.address)
    form.controller.setErrors({ [moving.instanceKey]: ['Wrong owner'] })
    schema.scopedFields[1] = { nodeId: 'moving-name', field: 'name', scopeId: 'right', defaultValue: 'New owner' }
    form.update(schema)
    expect(form.read()).toEqual({ name: 'Root', left: { extra: 1 }, right: { label: 'Right', name: 'New owner' } })
    expect(form.controller.getInstanceMeta(moving.address)).toEqual({ dirty: false, touched: false })
    expect(form.controller.getErrors()).toEqual({})
  })

  it.each(['field', 'kind', 'itemKey', 'nodeId', 'parentId'] as const)('retires descendant identities when an ancestor changes %s', (change) => {
    const schema = nestedSchema()
    const form = fixture(schema)
    const retired = form.controller.listFieldInstances('item-name')[0]!
    const oldRows = form.controller.listRows('groups').map(row => row.rowId)
    const outer = schema.valueScopes[0]!
    outer.minItems = 1
    if (change === 'field') outer.field = 'renamedGroups'
    if (change === 'kind') { outer.kind = 'object'; delete outer.minItems }
    if (change === 'itemKey') outer.itemKey = 'id'
    if (change === 'nodeId') {
      outer.nodeId = 'new-groups'
      schema.valueScopes[1]!.parentId = 'new-groups'
      schema.scopedFields[2]!.scopeId = 'new-groups'
    }
    if (change === 'parentId') {
      outer.parentId = 'container'
      schema.valueScopes.push({ nodeId: 'container', field: 'container', kind: 'object' })
    }
    schema.valueScopes[1]!.minItems = 1
    schema.scopedFields[3]!.defaultValue = 'Fresh'
    form.update(schema)
    expect(() => form.controller.getInstanceValue(retired.address)).toThrow()
    const fresh = form.controller.listFieldInstances('item-name')[0]!
    expect(fresh.value).toBe('Fresh')
    expect(fresh.address.scope.some(entry => oldRows.includes(entry.rowId))).toBe(false)
    expect(form.controller.getMeta().fields).not.toHaveProperty(retired.instanceKey)
  })

  it('never reuses a retired identity returned by a custom factory after a rebuild', () => {
    const schema: ConfigFormValueSchema = {
      scopedFields: [{ nodeId: 'value', field: 'value', scopeId: 'rows', defaultValue: 'Fresh' }],
      valueScopes: [{ nodeId: 'rows', field: 'rows', kind: 'array', minItems: 1 }],
    }
    const createRowId = vi.fn(({ attempt }: { attempt: number }) => attempt === 0 ? 'retired' : 'fresh')
    const form = fixture(schema, {}, { createRowId })
    const old = form.controller.listFieldInstances()[0]!
    schema.valueScopes[0]!.field = 'newRows'
    form.update(schema)
    expect(form.controller.listRows('rows')[0]!.rowId).toBe('fresh')
    expect(() => form.controller.getInstanceValue(old.address)).toThrow()
    expect(createRowId).toHaveBeenCalledWith(expect.objectContaining({ attempt: 1 }))
  })

  it.each(['missing-owner', 'duplicate', 'cycle', 'maxItems', 'bad-default'] as const)('rejects %s atomically', async (invalid) => {
    const form = fixture()
    const { controller } = form
    const item = controller.listFieldInstances('item-name')[0]!
    controller.setInstanceValue(item.address, 'Edit')
    controller.setInstanceTouched(item.address)
    controller.setErrors({ [item.instanceKey]: ['Keep'] })
    const values = controller.getValues()
    const instances = controller.listFieldInstances()
    const meta = controller.getMeta()
    const issues = controller.getIssues()
    const schema = nestedSchema()
    if (invalid === 'missing-owner') schema.scopedFields[3]!.scopeId = 'missing'
    if (invalid === 'duplicate') schema.scopedFields.push({ nodeId: 'other', field: 'title' })
    if (invalid === 'cycle') schema.valueScopes[0]!.parentId = 'items'
    if (invalid === 'maxItems') schema.valueScopes[0]!.maxItems = 1
    if (invalid === 'bad-default') schema.scopedFields.push({ nodeId: 'bad', field: 'bad', defaultValue: Number.NaN })
    expect(() => controller.updateValueSchema(schema)).toThrow()
    expect(controller.getValues()).toEqual(values)
    expect(controller.listFieldInstances()).toEqual(instances)
    expect(controller.getMeta()).toEqual(meta)
    expect(controller.getIssues()).toEqual(issues)
    await controller.resetFields()
    expect(controller.getValues()).toEqual(initialValues())
  })

  it('cancels pending validation and lifecycle only after a successful schema update', async () => {
    let validationSignal!: AbortSignal
    let lifecycleSignal!: AbortSignal
    let rejectValidation!: (cause: Error) => void
    let rejectLifecycle!: (cause: Error) => void
    const diagnostic = vi.fn()
    const form = fixture(undefined, undefined, {
      fields: () => [{
        id: 'title', field: 'title', component: 'input',
        validator: (_value, _values, context) => {
          validationSignal = context.signal
          return new Promise<never>((_resolve, reject) => { rejectValidation = reject })
        },
      }],
      onDiagnostic: diagnostic,
      onLifecycle: (_kind, context) => {
        lifecycleSignal = context.signal
        return new Promise<never>((_resolve, reject) => { rejectLifecycle = reject })
      },
    })
    const pending = form.controller.validateField('title')
    const lifecycle = form.controller.runLifecycle('form.initialize')
    const invalid = nestedSchema()
    invalid.scopedFields[0]!.scopeId = 'missing'
    expect(() => form.controller.updateValueSchema(invalid)).toThrow()
    expect(validationSignal.aborted).toBe(false)
    expect(lifecycleSignal.aborted).toBe(false)
    form.controller.updateValueSchema(JSON.parse(JSON.stringify(nestedSchema())) as ConfigFormValueSchema)
    expect(validationSignal.aborted).toBe(false)
    const next = nestedSchema()
    next.scopedFields.push({ nodeId: 'new', field: 'new', defaultValue: 1 })
    form.controller.updateValueSchema(next)
    expect(validationSignal.aborted).toBe(true)
    expect(lifecycleSignal.aborted).toBe(true)
    await expect(beforeNextTask(pending)).resolves.toBe(false)
    await expect(beforeNextTask(lifecycle)).resolves.toBe(false)
    expect(form.controller.getValidating()).toBe(false)
    rejectValidation(new Error('late validation'))
    rejectLifecycle(new Error('late lifecycle'))
    await new Promise<void>(resolve => setTimeout(resolve, 0))
    expect(form.controller.getErrors()).toEqual({})
    expect(diagnostic).not.toHaveBeenCalled()
  })

  it('derives undefined updates and switches flat/scoped meta and submission dynamically', async () => {
    let values: ConfigFormValues = { title: 'Original', unmanaged: 1 }
    let fields: ConfigFormNode<ConfigFormValues, string>[] = [{ id: 'title', field: 'title', component: 'input' }]
    const onSubmit = vi.fn()
    const controller = createConfigFormController({
      fields: () => fields,
      model: { read: () => values, write: next => values = next },
      onSubmit,
    })
    const address = { nodeId: 'title', scope: [] }
    controller.setValue('title', 'Edited')
    controller.setInstanceTouched(address)
    controller.setErrors({ title: ['Keep'] })
    fields = [...fields, {
      id: 'details', component: 'section', valueScope: { field: 'details', kind: 'object' },
      slots: { default: [{ id: 'detail', field: 'detail', component: 'input', defaultValue: 'Default' }] },
    }]
    controller.updateValueSchema()
    expect(controller.getInstanceMeta(address)).toEqual({ dirty: true, touched: true })
    expect(controller.getInstanceErrors(address)).toEqual(['Keep'])
    expect(controller.getMeta().fields).not.toHaveProperty('unmanaged')
    expect(values).toEqual({ title: 'Edited', unmanaged: 1, details: { detail: 'Default' } })
    await expect(controller.submit()).resolves.toBe(true)
    expect(onSubmit).toHaveBeenLastCalledWith(values)
    fields = [fields[0]!]
    controller.updateValueSchema(undefined)
    expect(controller.getInstanceKey(address)).toBe('title')
    expect(controller.getInstanceMeta(address)).toEqual({ dirty: true, touched: true })
    expect(controller.getMeta().fields).toHaveProperty('unmanaged')
    expect(values).toEqual({ title: 'Edited', unmanaged: 1 })
    await expect(controller.submit()).resolves.toBe(true)
    expect(onSubmit).toHaveBeenLastCalledWith({ title: 'Edited' })
    await controller.resetFields()
    expect(values).toEqual({ title: 'Original', unmanaged: 1 })
  })

  it('re-derives from current fields instead of reusing the constructor schema', () => {
    let fields: ConfigFormNode<ConfigFormValues, string>[] = [{ id: 'old', field: 'old', component: 'input' }]
    const form = fixture({ scopedFields: [{ nodeId: 'old', field: 'old' }], valueScopes: [] }, { old: 'Old' }, { fields: () => fields })
    fields = [{ id: 'new', field: 'new', component: 'input', defaultValue: 'New' }]
    form.controller.updateValueSchema()
    expect(form.read()).toEqual({ new: 'New' })
    expect(form.controller.listFieldInstances().map(instance => instance.address.nodeId)).toEqual(['new'])
  })

  it('keeps undeclared flat field state when adding or removing declared fields', () => {
    let values: ConfigFormValues = { extra: 'Original', retired: 'Old' }
    let fields: ConfigFormNode<ConfigFormValues, string>[] = [{ id: 'retired', field: 'retired', component: 'input' }]
    const controller = createConfigFormController({
      fields: () => fields,
      model: { read: () => values, write: next => values = next },
    })
    controller.setValue('extra', 'Edited')
    controller.setTouched(['extra', 'retired'])
    controller.setErrors({ extra: ['Keep'], retired: ['Drop'] })
    fields = [{ id: 'new', field: 'new', component: 'input', defaultValue: 'Default' }]
    controller.updateValueSchema()
    expect(values).toEqual({ extra: 'Edited', new: 'Default' })
    expect(controller.getFieldMeta('extra')).toEqual({ dirty: true, touched: true })
    expect(controller.getMeta().fields).not.toHaveProperty('retired')
    expect(controller.getErrors()).toEqual({ extra: ['Keep'] })
  })

  it('applies a newly declared default to an absent compatible field and its baseline', async () => {
    const schema: TestValueSchema = { scopedFields: [{ nodeId: 'title', field: 'title' }], valueScopes: [] }
    const form = fixture(schema, {})
    schema.scopedFields[0]!.defaultValue = 'Default'
    form.update(schema)
    expect(form.read()).toEqual({ title: 'Default' })
    expect(form.controller.getFieldMeta('title')).toEqual({ dirty: false, touched: false })
    expect(form.controller.getMeta().dirty).toBe(false)
    form.controller.setValue('title', 'Edited')
    await form.controller.resetFields()
    expect(form.read()).toEqual({ title: 'Default' })
  })

  it.each([false, true])('does not reuse stale row queues during an external %s-keyed replacement', (keyed) => {
    const schema: TestValueSchema = {
      scopedFields: [{ nodeId: 'value', field: 'value', scopeId: 'rows' }],
      valueScopes: [{ nodeId: 'rows', field: 'rows', kind: 'array', ...(keyed ? { itemKey: 'id' } : {}) }],
    }
    const form = fixture(schema, { rows: [{ id: 'a', value: 'A' }, { id: 'b', value: 'B' }] })
    const old = form.controller.listFieldInstances()
    form.controller.setInstanceTouched(old[0]!.address)
    form.replace({ rows: [{ id: 'b', value: 'B2' }, { id: 'a', value: 'A2' }] })
    schema.scopedFields.push({ nodeId: 'added', field: 'added', scopeId: 'rows', defaultValue: 1 })
    form.update(schema)
    const next = form.controller.listFieldInstances('value')
    expect(next.map(instance => instance.value)).toEqual(['B2', 'A2'])
    if (keyed) {
      expect(next.map(instance => instance.instanceKey)).toEqual([old[1]!.instanceKey, old[0]!.instanceKey])
      expect(form.controller.getInstanceMeta(old[0]!.address).touched).toBe(true)
    }
    else {
      expect(next.some(instance => old.some(previous => previous.instanceKey === instance.instanceKey))).toBe(false)
      expect(form.controller.getMeta().touched).toBe(false)
      expect(() => form.controller.getInstanceValue(old[0]!.address)).toThrow()
    }
  })
})
