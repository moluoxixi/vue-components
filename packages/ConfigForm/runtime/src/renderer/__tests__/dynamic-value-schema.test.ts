import type { ConfigFormFieldValidator, ConfigFormValues, ConfigFormValueSchema } from '@moluoxixi/config-form-headless'
import type { Component } from 'vue'
import type { ConfigFormPageRuntimePlan } from '../../runtime'
import type { ConfigFormRendererExpose, ConfigFormRendererNode } from '../types'
import { createConfigFormModel } from '@moluoxixi/config-form-headless'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, shallowRef } from 'vue'
import { ConfigFormRenderer } from '../index'

const Input = defineComponent({
  props: ['modelValue'],
  emits: ['update:modelValue', 'blur'],
  setup: (props, { attrs, emit }) => () => h('input', {
    ...attrs,
    value: props.modelValue,
    onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).value),
    onBlur: () => emit('blur'),
  }),
})

interface TestSchema {
  scopedFields: ConfigFormValueSchema['scopedFields'][number][]
  valueScopes: ConfigFormValueSchema['valueScopes'][number][]
}

function schema(): TestSchema {
  return {
    scopedFields: [
      { nodeId: 'title', field: 'title' },
      { nodeId: 'retired', field: 'retired' },
      { nodeId: 'item-name', field: 'name', scopeId: 'items' },
    ],
    valueScopes: [
      { nodeId: 'groups', field: 'groups', kind: 'array' },
      { nodeId: 'items', field: 'items', kind: 'array', parentId: 'groups' },
    ],
  }
}

function nodes(
  valueSchema: ConfigFormValueSchema,
  placeholder = 'Original placeholder',
  validator?: ConfigFormFieldValidator<ConfigFormValues>,
): ConfigFormRendererNode[] {
  const children = (parentId?: string): ConfigFormRendererNode[] => [
    ...valueSchema.scopedFields.filter(field => field.scopeId === parentId).map(field => ({
      id: field.nodeId,
      field: field.field,
      component: Input,
      defaultValue: field.defaultValue,
      props: { placeholder },
      ...(validator ? { validator } : {}),
    })),
    ...valueSchema.valueScopes.filter(scope => scope.parentId === parentId).map(scope => ({
      id: scope.nodeId,
      component: 'section',
      valueScope: { ...scope },
      slots: { default: children(scope.nodeId) },
    })),
  ]
  return children()
}

function plan(valueSchema: ConfigFormValueSchema): ConfigFormPageRuntimePlan {
  return { optionBindings: [], runtime: { dataSources: [], variables: [] }, valueSchema }
}

function initialValues(): ConfigFormValues {
  return { title: 'Original', retired: 'Retired', groups: [
    { items: [{ name: 'One' }, { name: 'Two' }] },
    { items: [{ name: 'Three' }] },
  ] }
}

describe('renderer dynamic value schema', () => {
  it('synchronously renders added defaults and deleted fields while preserving edited nested values and the reset baseline', async () => {
    const values = shallowRef(initialValues())
    const initial = schema()
    const wrapper = mount(ConfigFormRenderer as Component, { props: {
      fields: nodes(initial),
      model: createConfigFormModel(values),
      plan: plan(initial),
    } })
    const api = wrapper.vm as unknown as ConfigFormRendererExpose
    await wrapper.findAll('[data-field="name"] input')[0]!.setValue('Edited')
    const item = api.listFieldInstances('item-name')[0]!
    api.setInstanceTouched(item.address)
    api.setErrors({ [item.instanceKey]: ['Keep row error'] })
    await nextTick()
    const rowIds = wrapper.findAll('[data-row-id]').map(row => row.attributes('data-row-id'))
    const next = schema()
    next.scopedFields = next.scopedFields.filter(field => field.nodeId !== 'retired')
    next.scopedFields.push(
      { nodeId: 'status', field: 'status', defaultValue: 'draft' },
      { nodeId: 'quantity', field: 'quantity', scopeId: 'items', defaultValue: 3 },
    )
    await wrapper.setProps({ fields: nodes(next), plan: plan(next) })
    expect(wrapper.find('[data-field="retired"]').exists()).toBe(false)
    expect(wrapper.get<HTMLInputElement>('[data-field="status"] input').element.value).toBe('draft')
    expect(wrapper.findAll<HTMLInputElement>('[data-field="quantity"] input').map(input => input.element.value)).toEqual(['3', '3', '3'])
    expect(wrapper.findAll('[data-row-id]').map(row => row.attributes('data-row-id'))).toEqual(rowIds)
    expect(wrapper.findAll<HTMLInputElement>('[data-field="name"] input')[0]!.element.value).toBe('Edited')
    expect(wrapper.findAll('[data-field="name"]')[0]!.attributes()).toMatchObject({ 'data-dirty': 'true', 'data-touched': 'true' })
    expect(wrapper.text()).toContain('Keep row error')
    expect(api.getInstanceErrors(item.address)).toEqual(['Keep row error'])
    api.setValue('status', 'Edited status')
    await api.resetFields()
    await nextTick()
    expect(values.value).toEqual({ title: 'Original', status: 'draft', groups: [
      { items: [{ name: 'One', quantity: 3 }, { name: 'Two', quantity: 3 }] },
      { items: [{ name: 'Three', quantity: 3 }] },
    ] })
    expect(wrapper.text()).not.toContain('Keep row error')
    expect(wrapper.attributes('data-dirty')).toBe('false')
    wrapper.unmount()
  })

  it('preserves both levels of unkeyed row IDs and control elements through props-only and deep-equal plan changes', async () => {
    const initial = schema()
    const wrapper = mount(ConfigFormRenderer as Component, { props: {
      fields: nodes(initial),
      model: createConfigFormModel(shallowRef(initialValues())),
      plan: plan(initial),
    } })
    const rows = wrapper.findAll('[data-row-id]').map(row => row.element)
    const controls = wrapper.findAll('[data-field="name"] input').map(input => input.element)
    const api = wrapper.vm as unknown as ConfigFormRendererExpose
    const item = api.listFieldInstances('item-name')[1]!
    api.setInstanceTouched(item.address)
    api.setErrors({ [item.instanceKey]: ['Keep'] })
    await wrapper.setProps({ fields: nodes(initial, 'Changed placeholder') })
    expect(wrapper.findAll('[data-row-id]').map(row => row.element)).toEqual(rows)
    expect(wrapper.findAll('[data-field="name"] input').map(input => input.element)).toEqual(controls)
    expect(wrapper.findAll('[data-field="name"] input')[0]!.attributes('placeholder')).toBe('Changed placeholder')
    await wrapper.setProps({ plan: plan(JSON.parse(JSON.stringify(initial)) as ConfigFormValueSchema) })
    expect(wrapper.findAll('[data-row-id]').map(row => row.element)).toEqual(rows)
    expect(api.getInstanceMeta(item.address).touched).toBe(true)
    expect(api.getInstanceErrors(item.address)).toEqual(['Keep'])
    wrapper.unmount()
  })

  it('derives added and removed flat fields without a plan and keeps the original reset value', async () => {
    const values = shallowRef<ConfigFormValues>({ title: 'Original', removed: 'Remove' })
    const initial: TestSchema = { scopedFields: [{ nodeId: 'title', field: 'title' }, { nodeId: 'removed', field: 'removed' }], valueScopes: [] }
    const wrapper = mount(ConfigFormRenderer as Component, { props: {
      fields: nodes(initial),
      model: createConfigFormModel(values),
    } })
    const api = wrapper.vm as unknown as ConfigFormRendererExpose
    await wrapper.get('[data-field="title"] input').setValue('Edited')
    const next: TestSchema = { scopedFields: [{ nodeId: 'title', field: 'title' }, { nodeId: 'new', field: 'new', defaultValue: 'New' }], valueScopes: [] }
    await wrapper.setProps({ fields: nodes(next) })
    expect(values.value).toEqual({ title: 'Edited', new: 'New' })
    expect(wrapper.find('[data-field="removed"]').exists()).toBe(false)
    expect(wrapper.get<HTMLInputElement>('[data-field="new"] input').element.value).toBe('New')
    await api.resetFields()
    expect(values.value).toEqual({ title: 'Original', new: 'New' })
    wrapper.unmount()
  })

  it('does not leak renamed or moved field values and errors into the new instance', async () => {
    const values = shallowRef(initialValues())
    const initial = schema()
    const wrapper = mount(ConfigFormRenderer as Component, { props: {
      fields: nodes(initial),
      model: createConfigFormModel(values),
      plan: plan(initial),
    } })
    const api = wrapper.vm as unknown as ConfigFormRendererExpose
    const old = api.listFieldInstances('item-name')[0]!
    api.setInstanceTouched(old.address)
    api.setErrors({ [old.instanceKey]: ['Old error'] })
    const renamed = schema()
    renamed.scopedFields[2] = { nodeId: 'item-name', field: 'label', scopeId: 'items', defaultValue: 'Renamed' }
    await wrapper.setProps({ fields: nodes(renamed), plan: plan(renamed) })
    expect(wrapper.findAll<HTMLInputElement>('[data-field="label"] input').map(input => input.element.value)).toEqual(['Renamed', 'Renamed', 'Renamed'])
    expect(wrapper.text()).not.toContain('Old error')
    expect(api.getInstanceMeta(old.address)).toEqual({ dirty: false, touched: false })
    const moved = schema()
    moved.scopedFields[2] = { nodeId: 'item-name', field: 'label', scopeId: 'groups', defaultValue: 'Moved' }
    await wrapper.setProps({ fields: nodes(moved), plan: plan(moved) })
    expect(wrapper.findAll<HTMLInputElement>('[data-field="label"] input').map(input => input.element.value)).toEqual(['Moved', 'Moved'])
    expect(values.value.groups).toEqual([{ label: 'Moved', items: [{}, {}] }, { label: 'Moved', items: [{}] }])
    expect(() => api.getInstanceValue(old.address)).toThrow()
    wrapper.unmount()
  })

  it('leaves the live values, rows and meta intact when a plan schema is invalid', async () => {
    const initial = schema()
    const errorHandler = vi.fn()
    const wrapper = mount(ConfigFormRenderer as Component, {
      global: { config: { errorHandler } },
      props: { fields: nodes(initial), model: createConfigFormModel(shallowRef(initialValues())), plan: plan(initial) },
    })
    const api = wrapper.vm as unknown as ConfigFormRendererExpose
    const item = api.listFieldInstances('item-name')[0]!
    api.setInstanceTouched(item.address)
    api.setErrors({ [item.instanceKey]: ['Keep'] })
    const before = { values: api.getValues(), instances: api.listFieldInstances(), meta: api.getMeta(), errors: api.getErrors() }
    const invalid = schema()
    invalid.scopedFields[2]!.scopeId = 'missing'
    await wrapper.setProps({ plan: plan(invalid) })
    expect(errorHandler).toHaveBeenCalled()
    expect({ values: api.getValues(), instances: api.listFieldInstances(), meta: api.getMeta(), errors: api.getErrors() }).toEqual(before)
    await wrapper.setProps({ plan: plan(initial) })
    expect(api.listFieldInstances()).toEqual(before.instances)
    wrapper.unmount()
  })

  it('updates validating DOM from false to true to false without any value, touched or error change', async () => {
    let finish!: (result: undefined) => void
    const validator = vi.fn<ConfigFormFieldValidator<ConfigFormValues>>(() => new Promise((resolve) => {
      finish = resolve
    }))
    const valueSchema: TestSchema = { scopedFields: [{ nodeId: 'title', field: 'title' }], valueScopes: [] }
    const onErrorsChange = vi.fn()
    const wrapper = mount(ConfigFormRenderer as Component, { props: {
      fields: nodes(valueSchema, 'Title', validator),
      model: createConfigFormModel(shallowRef({ title: 'Original' })),
      plan: plan(valueSchema),
      onErrorsChange,
    } })
    const api = wrapper.vm as unknown as ConfigFormRendererExpose
    const field = wrapper.get('[data-field="title"]')
    expect(field.attributes('data-validating')).toBe('false')
    const pending = api.validateInstance({ nodeId: 'title', scope: [] })
    await nextTick()
    expect(field.attributes('data-validating')).toBe('true')
    expect(field.attributes('data-touched')).toBe('false')
    finish(undefined)
    await expect(pending).resolves.toBe(true)
    await nextTick()
    expect(field.attributes('data-validating')).toBe('false')
    expect(onErrorsChange).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('cancels async instance validation on topology change without publishing the late error', async () => {
    let signal!: AbortSignal
    let finish!: (result: string) => void
    const validator: ConfigFormFieldValidator<ConfigFormValues> = (_value, _values, context) => {
      signal = context.signal
      return new Promise((resolve) => {
        finish = resolve
      })
    }
    const initial: TestSchema = { scopedFields: [{ nodeId: 'title', field: 'title' }], valueScopes: [] }
    const wrapper = mount(ConfigFormRenderer as Component, { props: {
      fields: nodes(initial, 'Title', validator),
      model: createConfigFormModel(shallowRef({ title: 'Original' })),
      plan: plan(initial),
    } })
    const api = wrapper.vm as unknown as ConfigFormRendererExpose
    const pending = api.validateInstance({ nodeId: 'title', scope: [] })
    await nextTick()
    expect(wrapper.get('[data-field="title"]').attributes('data-validating')).toBe('true')
    const next: TestSchema = {
      scopedFields: [{ nodeId: 'new', field: 'new', defaultValue: 'New' }],
      valueScopes: [],
    }
    await wrapper.setProps({ fields: nodes(next), plan: plan(next) })
    expect(signal.aborted).toBe(true)
    await expect(pending).resolves.toBe(false)
    expect(api.getValidating()).toBe(false)
    finish('Late error')
    await flushPromises()
    expect(wrapper.text()).not.toContain('Late error')
    expect(api.getErrors()).toEqual({})
    wrapper.unmount()
  })
})
