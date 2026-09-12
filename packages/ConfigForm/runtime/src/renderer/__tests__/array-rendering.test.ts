import type { ConfigFormValueSchema } from '@moluoxixi/config-form-headless'
import type { Component } from 'vue'
import type { ConfigFormRendererExpose, ConfigFormRendererNode } from '../types'
import { createConfigFormValueScopeStore } from '@moluoxixi/config-form-core'
import { createConfigFormModel } from '@moluoxixi/config-form-headless'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { h, shallowRef } from 'vue'
import { ConfigFormRenderer } from '../index'
import { projectRendererDesignValueSchema } from '../services/design-value-schema'
import { arraySlotColumns } from '../services/renderer-slots'

const schema: ConfigFormValueSchema = {
  valueScopes: [
    { nodeId: 'orders', field: 'orders', kind: 'array', minItems: 0, maxItems: 0 },
    { nodeId: 'address', field: 'address', kind: 'object', parentId: 'orders' },
    { nodeId: 'lines', field: 'lines', kind: 'array', parentId: 'address', minItems: 0, maxItems: 0 },
  ],
  scopedFields: [{ nodeId: 'name', field: 'name.with.dot', scopeId: 'lines', defaultValue: { text: 'Default' } }],
}

describe('array rendering presentation', () => {
  it('projects immutable design topology and obtains exactly one nested row from Core defaults', () => {
    const original = structuredClone(schema)
    const projected = projectRendererDesignValueSchema({ valueSchema: schema })
    expect(projected.valueScopes.filter(scope => scope.kind === 'array').every(scope => scope.minItems === 1 && scope.maxItems === 1)).toBe(true)
    const store = createConfigFormValueScopeStore({ scopes: projected.valueScopes, fields: projected.scopedFields })
    expect(store.getValues()).toEqual({ orders: [{ address: { lines: [{ 'name.with.dot': { text: 'Default' } }] } }] })
    expect(schema).toEqual(original)
    expect(projected.scopedFields[0]!.defaultValue).not.toBe(schema.scopedFields[0]!.defaultValue)
  })

  it('uses direct template nodes as columns and preserves a nested layout as one column', () => {
    expect(arraySlotColumns({ id: 'table', component: 'section', slots: { default: [
      { id: 'name', component: 'input', field: 'name', label: 'Name' },
      { id: 'address', component: 'section', props: { title: 'Address' }, slots: { default: [{ id: 'city', component: 'input', field: 'city' }] } },
    ] } })).toEqual([{ key: 'name', title: 'Name' }, { key: 'address', title: 'Address' }])
    expect(arraySlotColumns({ id: 'table', component: 'section', slots: { default: () => h('span', 'Content') } })).toEqual([{ key: 'content', title: 'Content' }])
  })

  it('keeps zero-row tables semantic and forwards row operation failures to the Vue error boundary', async () => {
    const fields: ConfigFormRendererNode[] = [{
      id: 'orders',
      component: 'section',
      valueScope: { kind: 'array', field: 'orders', minItems: 0 },
      props: { title: 'Orders', arrayDisplay: 'table' },
      slots: { default: [{ id: 'sku', component: 'input', field: 'sku', label: 'SKU' }] },
    }]
    const errorHandler = vi.fn()
    const wrapper = mount(ConfigFormRenderer as Component, {
      global: { config: { errorHandler } },
      props: { fields, model: createConfigFormModel(shallowRef({ orders: [] })) },
    })
    const api = wrapper.vm as unknown as ConfigFormRendererExpose
    try {
      expect(wrapper.get('thead th').text()).toBe('SKU')
      expect(wrapper.get('tbody td').text()).toBe('No rows')
      const append = wrapper.get('[data-config-form-row-action="append"]')
      expect(append.attributes()).toMatchObject({ 'aria-label': 'Add row', 'title': 'Add row', 'type': 'button' })
      expect(append.find('svg').exists()).toBe(true)
      await append.trigger('click')
      expect(api.listRows('orders')).toHaveLength(1)
      const staleRemove = wrapper.get('[data-config-form-row-action="remove"]').element as HTMLButtonElement
      api.removeRow('orders', api.listRows('orders')[0]!.rowId)
      staleRemove.click()
      expect(errorHandler).toHaveBeenCalled()
    }
    finally { wrapper.unmount() }
  })
})
