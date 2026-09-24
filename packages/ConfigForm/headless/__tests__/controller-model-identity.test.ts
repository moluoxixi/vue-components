import type { ConfigFormController, ConfigFormControllerOptions, ConfigFormValueSchema } from '../index'
import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref, watch } from 'vue'
import { createConfigFormController } from '../index'

interface Values {
  title: string
  group: { rows: Array<{ id: string, amount: number, items: Array<{ id: string, detail: number }> }> }
  other: Array<{ amount: number }>
}

function initial(): Values {
  return {
    title: 'initial',
    group: { rows: [
      { id: 'a', amount: 1, items: [{ id: 'a1', detail: 10 }] },
      { id: 'b', amount: 2, items: [{ id: 'b1', detail: 20 }] },
    ] },
    other: [{ amount: 3 }],
  }
}

function fixture(options: Partial<ConfigFormControllerOptions<Values>> = {}, keyed = false) {
  let values = initial()
  const schema: ConfigFormValueSchema = {
    valueScopes: [
      { nodeId: 'group', field: 'group', kind: 'object' },
      { nodeId: 'rows', field: 'rows', kind: 'array', parentId: 'group', ...(keyed ? { itemKey: 'id' } : {}) },
      { nodeId: 'items', field: 'items', kind: 'array', parentId: 'rows', ...(keyed ? { itemKey: 'id' } : {}) },
      { nodeId: 'other', field: 'other', kind: 'array' },
    ],
    scopedFields: [
      { nodeId: 'title', field: 'title' },
      { nodeId: 'amount', field: 'amount', scopeId: 'rows' },
      { nodeId: 'detail', field: 'detail', scopeId: 'items' },
      { nodeId: 'other-amount', field: 'amount', scopeId: 'other' },
    ],
  }
  const write = vi.fn((next: Values) => values = next)
  const onChange = vi.fn()
  const onSubmit = vi.fn()
  const controller = createConfigFormController<Values>({
    model: { read: () => values, write },
    fields: () => schema.scopedFields.map(field => ({ id: field.nodeId, field: field.field, component: 'input' })),
    valueSchema: schema,
    onChange,
    onSubmit,
    ...options,
  })
  return { controller, write, onChange, onSubmit, read: () => values, replace: (next: Values) => values = next }
}

function identities(controller: ConfigFormController<Values>) {
  return controller.listFieldInstances().map(instance => instance.instanceKey).sort()
}

describe('Headless external model identity', () => {
  it('invalidates equal external unkeyed replacement once, including pending work and state', async () => {
    let signal!: AbortSignal
    let first = true
    const { controller, replace, write, onChange, onSubmit } = fixture({
      onLifecycle: (kind, context) => {
        if (kind !== 'form.beforeSubmit' || !first) return
        first = false
        signal = context.signal
        return new Promise<void>(() => {})
      },
    })
    const before = identities(controller)
    const detail = controller.listFieldInstances('detail')[0]!
    controller.setInstanceTouched(detail.address)
    controller.setErrors({ [detail.instanceKey]: ['old error'] })
    const pending = controller.submit()
    replace(initial())
    const after = identities(controller)
    expect(after).not.toEqual(before)
    expect(signal.aborted).toBe(true)
    await expect(pending).resolves.toBe(false)
    expect(controller.getErrors()).toEqual({})
    expect(controller.getMeta().fields).not.toHaveProperty(detail.instanceKey)
    expect(() => controller.getInstanceValue(detail.address)).toThrow()
    expect(identities(controller)).toEqual(after)
    expect(write).not.toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalled()
    expect(onSubmit).not.toHaveBeenCalled()
    await expect(controller.submit()).resolves.toBe(true)
  })

  it('keeps rows and unrelated row lifecycle work on shallow and in-place root edits', async () => {
    let signal!: AbortSignal
    const { controller, replace, read } = fixture({
      onLifecycle: (_kind, context) => {
        signal = context.signal
        return new Promise<void>(() => {})
      },
    })
    const before = identities(controller)
    const pending = controller.runLifecycle('form.initialize')
    replace({ ...read(), title: 'shallow' })
    expect(controller.getValue('title')).toBe('shallow')
    read().title = 'in-place'
    read().group.rows[0]!.amount = 99
    expect(controller.getValue('title')).toBe('in-place')
    expect(identities(controller)).toEqual(before)
    expect(signal.aborted).toBe(false)
    controller.dispose()
    await expect(pending).resolves.toBe(false)
  })

  it('replaces only the equal nested array while retaining both sibling branches', () => {
    const { controller, read } = fixture()
    const outer = controller.listRows('rows')
    const first = controller.listRows('items', outer[0]!.scope)[0]!
    const second = controller.listRows('items', outer[1]!.scope)[0]!
    const other = controller.listRows('other')[0]!
    read().group.rows[0]!.items = [{ ...read().group.rows[0]!.items[0]! }]
    expect(controller.listRows('rows').map(row => row.rowId)).toEqual(outer.map(row => row.rowId))
    expect(controller.listRows('items', outer[0]!.scope)[0]!.rowId).not.toBe(first.rowId)
    expect(controller.listRows('items', outer[1]!.scope)[0]!.rowId).toBe(second.rowId)
    expect(controller.listRows('other')[0]!.rowId).toBe(other.rowId)
  })

  it('keeps keyed rows on replacement and their unmodified nested references on reorder', () => {
    const { controller, replace, read } = fixture({}, true)
    const before = identities(controller)
    replace(initial())
    expect(identities(controller)).toEqual(before)
    const rows = controller.listRows('rows')
    replace({ ...read(), group: { rows: [...read().group.rows].reverse() } })
    expect(controller.listRows('rows').map(row => row.rowId)).toEqual(rows.map(row => row.rowId).reverse())
    expect(identities(controller)).toEqual(before)
  })

  it('retains unkeyed row references across in-place reorder, insert and delete', () => {
    const { controller, read } = fixture()
    const rows = controller.listRows('rows')
    const nested = controller.listRows('items', rows[0]!.scope)[0]!
    read().group.rows.reverse()
    expect(controller.listRows('rows').map(row => row.rowId)).toEqual(rows.map(row => row.rowId).reverse())
    expect(controller.listRows('items', rows[0]!.scope)[0]!.rowId).toBe(nested.rowId)
    read().group.rows.push({ id: 'c', amount: 3, items: [] })
    expect(controller.listRows('rows').slice(0, 2).map(row => row.rowId)).toEqual(rows.map(row => row.rowId).reverse())
    read().group.rows.splice(0, 1)
    expect(controller.listRows('rows')[0]!.rowId).toBe(rows[0]!.rowId)
  })

  it.each(['ref', 'in-place'] as const)('does not rebuild rows on a synchronous %s write or Vue watch echo', async (mode) => {
    const host = ref(initial())
    const reads: Values[] = []
    let controller!: ConfigFormController<Values>
    const write = vi.fn((values: Values) => {
      if (mode === 'ref') host.value = values
      else Object.assign(host.value, values)
      reads.push(controller.getValues())
      controller.listFieldInstances()
    })
    const configured = fixture({ model: { read: () => host.value, write } })
    controller = configured.controller
    const stop = watch(host, () => controller.getValues(), { deep: true, flush: 'sync' })
    const stopEcho = watch(host, () => controller.refreshReactions(), { deep: true })
    const before = identities(controller)
    const address = controller.listFieldInstances('detail')[0]!.address
    controller.applyValuePatch({ set: { title: 'atomic' }, instances: [{ address, value: 90 }] })
    await nextTick()
    expect(write).toHaveBeenCalledOnce()
    expect(reads).toEqual([host.value])
    expect(identities(controller)).toEqual(before)
    expect(controller.getInstanceValue(address)).toBe(90)
    expect(configured.onChange).toHaveBeenCalledOnce()
    stop()
    stopEcho()
  })
})
