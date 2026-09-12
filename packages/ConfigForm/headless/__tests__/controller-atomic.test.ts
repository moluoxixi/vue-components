import type {
  ConfigFormController,
  ConfigFormControllerOptions,
  ConfigFormJsonObject,
  ConfigFormNode,
  ConfigFormValuePatch,
  ConfigFormValueSchema,
} from '../index'
import { describe, expect, it, vi } from 'vitest'
import { createConfigFormController } from '../index'

const schema: ConfigFormValueSchema = {
  valueScopes: [
    { nodeId: 'rows', field: 'rows', kind: 'array' },
    { nodeId: 'items', field: 'items', kind: 'array', parentId: 'rows' },
  ],
  scopedFields: [
    { nodeId: 'title', field: 'title', defaultValue: 'initial' },
    { nodeId: 'amount', field: 'amount', scopeId: 'rows' },
    { nodeId: 'detail', field: 'detail', scopeId: 'items' },
  ],
}

function fixture(options: Partial<ConfigFormControllerOptions<ConfigFormJsonObject>> = {}) {
  let values: ConfigFormJsonObject = {
    title: 'initial', extra: true,
    rows: [
      { amount: 1, items: [{ detail: 10 }, { detail: 11 }] },
      { amount: 2, items: [{ detail: 20 }] },
    ],
  }
  const observed: ConfigFormJsonObject[] = []
  const onChange = vi.fn()
  const onLifecycle = vi.fn()
  const onMetaChange = vi.fn()
  const onErrorsChange = vi.fn()
  const fields: ConfigFormNode<ConfigFormJsonObject, string>[] = schema.scopedFields.map(field => ({
    component: 'input', id: field.nodeId, field: field.field,
  }))
  const controller: ConfigFormController<ConfigFormJsonObject> = createConfigFormController({
    fields: () => fields,
    valueSchema: schema,
    model: {
      read: () => values,
      write: (next) => {
        values = next
        observed.push(controller.getValues())
      },
    },
    onChange, onLifecycle, onMetaChange, onErrorsChange,
    ...options,
  })
  return { controller, fields, observed, onChange, onLifecycle, onMetaChange, onErrorsChange, read: () => values }
}

function identities(controller: ConfigFormController<ConfigFormJsonObject>) {
  return controller.listFieldInstances().map(instance => instance.instanceKey).sort()
}

describe('Headless atomic value patches', () => {
  it('publishes all root/nested changes once with no observable intermediate values', () => {
    const { controller, observed, onChange, onLifecycle, read } = fixture()
    const instances = controller.listFieldInstances('detail')
    const ids = identities(controller)
    controller.applyValuePatch({
      set: { title: 'changed' }, remove: ['extra'],
      instances: [
        { address: instances[0]!.address, value: 30 },
        { address: instances[2]!.address, value: 40 },
      ],
    })
    expect(observed).toEqual([read()])
    expect(onChange).toHaveBeenCalledExactlyOnceWith(read())
    expect(onLifecycle).toHaveBeenCalledExactlyOnceWith('form.valuesChange', expect.objectContaining({ values: read() }))
    expect(read()).toEqual({ title: 'changed', rows: [
      { amount: 1, items: [{ detail: 30 }, { detail: 11 }] },
      { amount: 2, items: [{ detail: 40 }] },
    ] })
    expect(identities(controller)).toEqual(ids)
    expect(controller.getInstanceMeta(instances[0]!.address)).toEqual({ dirty: true, touched: false })
    expect(controller.getInstanceMeta(instances[1]!.address)).toEqual({ dirty: false, touched: false })
    expect(JSON.stringify(read())).not.toContain('rowId')
  })

  it.each(['invalid JSON', 'unknown field', 'invalid scope', 'duplicate address', 'root overlap', 'root removal overlap', 'invalid root topology'])(
    'rejects %s without value, touched, dirty, error or notification side effects', (failure) => {
      const { controller, observed, onChange, onLifecycle, onMetaChange, onErrorsChange, read } = fixture()
      const first = controller.listFieldInstances('detail')[0]!
      const second = controller.listFieldInstances('detail')[1]!
      controller.setInstanceTouched(first.address)
      controller.setErrors({ [first.instanceKey]: ['keep first error'], [second.instanceKey]: ['keep second error'] })
      const before = controller.getValues()
      const meta = controller.getMeta()
      const errors = controller.getErrors()
      const issues = controller.getIssues()
      const ids = identities(controller)
      onMetaChange.mockClear()
      onErrorsChange.mockClear()
      const entries = [{ address: first.address, value: 99 }, { address: second.address, value: 100 }]
      const patch: ConfigFormValuePatch = { set: { title: 'must not commit' }, instances: entries }
      if (failure === 'invalid JSON') entries[1]!.value = undefined as never
      if (failure === 'unknown field') entries[1]!.address = { nodeId: 'missing', scope: [] }
      if (failure === 'invalid scope') entries[1]!.address = { ...second.address, scope: first.address.scope.slice(0, 1) }
      if (failure === 'duplicate address') entries[1]!.address = first.address
      if (failure === 'root overlap') patch.set!.rows = []
      if (failure === 'root removal overlap') patch.remove = ['rows']
      if (failure === 'invalid root topology') patch.set!.rows = 'invalid'
      expect(() => controller.applyValuePatch(patch)).toThrow()
      expect(read()).toEqual(before)
      expect(controller.getValues()).toEqual(before)
      expect(controller.getMeta()).toEqual(meta)
      expect(controller.getErrors()).toEqual(errors)
      expect(controller.getIssues()).toEqual(issues)
      expect(identities(controller)).toEqual(ids)
      expect(observed).toEqual([])
      expect(onChange).not.toHaveBeenCalled()
      expect(onLifecycle).not.toHaveBeenCalled()
      expect(onMetaChange).not.toHaveBeenCalled()
      expect(onErrorsChange).not.toHaveBeenCalled()
    },
  )

  it('preserves stable addresses after both row levels move and rejects a later deleted row', () => {
    const { controller, observed, read } = fixture()
    const row = controller.listRows('rows')[0]!
    const item = controller.listRows('items', row.scope)[0]!
    const address = { nodeId: 'detail', scope: item.scope }
    controller.moveRow('rows', row.rowId, 1)
    controller.moveRow('items', item.rowId, 1, row.scope)
    const ids = identities(controller)
    observed.length = 0
    controller.applyValuePatch({ set: { title: 'rebase' }, instances: [{ address, value: 50 }] })
    expect(observed).toEqual([read()])
    expect(controller.listFieldInstances('detail').find(instance => instance.value === 50)?.valuePath)
      .toEqual(['rows', 1, 'items', 1, 'detail'])
    expect(identities(controller)).toEqual(ids)
    controller.removeRow('rows', row.rowId)
    const before = read()
    expect(() => controller.applyValuePatch({ set: { title: 'late' }, instances: [{ address, value: 60 }] })).toThrow()
    expect(read()).toEqual(before)
  })

  it('rolls back the candidate and identities when a reaction produces invalid topology', () => {
    const { controller, fields, read, observed } = fixture()
    const before = read()
    const ids = identities(controller)
    fields[0]!.reactions = [{
      id: 'invalid-topology', when: { kind: 'literal', value: true },
      then: [{ kind: 'setValue', target: 'rows', value: { kind: 'literal', value: false } }],
    }]
    expect(() => controller.applyValuePatch({ set: { title: 'candidate' } })).toThrow()
    expect(read()).toEqual(before)
    expect(observed).toEqual([])
    expect(identities(controller)).toEqual(ids)
  })

  it('keeps unrelated non-JSON flat host values while sharing patch validation', () => {
    let values = { a: 1, b: 2, date: new Date('2025-01-01') }
    const onChange = vi.fn()
    const controller = createConfigFormController({
      model: { read: () => values, write: next => values = next },
      fields: () => [{ id: 'a', field: 'a', component: 'input' }, { id: 'b', field: 'b', component: 'input' }],
      onChange,
    })
    controller.applyValuePatch({ set: { a: 3 }, instances: [{ address: { nodeId: 'b', scope: [] }, value: 4 }] })
    expect(values).toEqual({ a: 3, b: 4, date: new Date('2025-01-01') })
    expect(onChange).toHaveBeenCalledOnce()
    expect(() => controller.applyValuePatch({ set: { a: 5 }, instances: [
      { address: { nodeId: 'b', scope: [] }, value: undefined as never },
    ] })).toThrow()
    expect(values.a).toBe(3)
    expect(onChange).toHaveBeenCalledOnce()
    expect(() => controller.applyValuePatch({ set: { a: 5 }, instances: [
      { address: { nodeId: 'a', scope: [] }, value: 6 },
    ] })).toThrow()
  })
  it('publishes root and stable-address removals once and preserves omissions on later patches', () => {
    const { controller, observed, onChange, onLifecycle } = fixture()
    const [first, second] = controller.listFieldInstances('detail')
    const ids = identities(controller)
    controller.applyValuePatch({ remove: ['title'], instances: [
      { address: first!.address, remove: true },
      { address: second!.address, value: 90 },
    ] })
    expect(controller.getValues()).not.toHaveProperty('title')
    expect(controller.getInstanceValue(first!.address)).toBeUndefined()
    expect(controller.getInstanceValue(second!.address)).toBe(90)
    expect(observed).toHaveLength(1)
    expect(onChange).toHaveBeenCalledOnce()
    expect(onLifecycle).toHaveBeenCalledOnce()
    expect(identities(controller)).toEqual(ids)
    controller.applyValuePatch({ set: { extra: false } })
    expect(controller.getValues()).not.toHaveProperty('title')
    expect(controller.getInstanceValue(first!.address)).toBeUndefined()
    const before = controller.getValues()
    expect(() => controller.applyValuePatch({ set: { extra: true }, instances: [
      { address: first!.address, remove: true },
      { address: first!.address, value: 1 },
    ] })).toThrow()
    expect(controller.getValues()).toEqual(before)
    expect(observed).toHaveLength(2)
  })

  it('removes a flat stable field while retaining unrelated non-JSON values', () => {
    let values: { name?: string, date: Date } = { name: 'initial', date: new Date('2025-01-01') }
    const onChange = vi.fn()
    const controller = createConfigFormController({
      fields: () => [{ id: 'name', field: 'name', component: 'input' }],
      model: { read: () => values, write: next => values = next },
      onChange,
    })
    controller.applyValuePatch({ instances: [{ address: { nodeId: 'name', scope: [] }, remove: true }] })
    expect(values).toEqual({ date: new Date('2025-01-01') })
    expect(onChange).toHaveBeenCalledOnce()
  })
})
