import type { ConfigFormValues } from '@moluoxixi/config-form-headless'
import type { LayoutNode, PageGraph } from '@moluoxixi/config-form-model'
import type { Component } from 'vue'
import type { ConfigFormRendererExpose, ConfigFormRuntimeNodeMetadata } from '../types'
import type { NestedMaterialProvider } from './nested-material-fixture'
import { createConfigFormValueScopeStore } from '@moluoxixi/config-form-core'
import { createNodePathCommand, DEFAULT_DESIGNER_PROPERTY_CONTROLS, useDesignerController } from '@moluoxixi/config-form-designer'
import { createConfigFormModel } from '@moluoxixi/config-form-headless'
import { createProjectDomainEngine } from '@moluoxixi/config-form-model'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, shallowRef } from 'vue'
import { ConfigFormRenderer } from '../index'
import { projectRendererDesignValueSchema } from '../services/design-value-schema'
import { createNestedMaterialFixture, nestedMaterialValues } from './nested-material-fixture'

export function testNestedMaterials(provider: NestedMaterialProvider): void {
  describe(`${provider.prefix} nested material integration`, () => {
    it('creates, duplicates and pastes scopes with owner-local business keys through validated commands', () => {
      const fixture = createNestedMaterialFixture(provider, false)
      const engine = createProjectDomainEngine({ document: fixture.document, registry: fixture.contracts })
      const graph = shallowRef(fixture.graph)
      const scope = effectScope()
      const controller = scope.run(() => useDesignerController({
        graph: () => graph.value,
        pageId: () => 'home',
        registry: () => fixture.registry,
        readonly: () => false,
        onDiagnostics: vi.fn(),
        onSelectionChange: vi.fn(),
        execute: (command) => {
          const result = engine.execute(JSON.parse(JSON.stringify(command)))
          expect(result.diagnostics).toEqual([])
          graph.value = JSON.parse(JSON.stringify(engine.snapshot.document.pagesById.home!.graph)) as PageGraph
          return result
        },
      }))!
      try {
        const add = (name: string, parentId: string | null) => {
          expect(controller.addMaterial(`${provider.prefix}.${name}`, parentId ? { parentId, slot: 'default' } : { parentId: null })).toBe(true)
          return controller.selectedId.value!
        }
        const first = add('object-group', null)
        const second = add('object-group', null)
        expect((graph.value.nodesById[first] as LayoutNode).valueScope?.field).toBe('object')
        expect((graph.value.nodesById[second] as LayoutNode).valueScope?.field).toBe('object_2')
        const firstInput = add('input', first)
        const secondInput = add('input', second)
        expect(graph.value.nodesById[firstInput]).toMatchObject({ field: 'input' })
        expect(graph.value.nodesById[secondInput]).toMatchObject({ field: 'input' })
        const array = add('array-subform', first)
        add('input', array)
        add('detail-table', array)
        controller.select(first)
        expect(controller.performNodeAction('copy', first)).toBe(true)
        const copy = controller.selectedId.value!
        expect((graph.value.nodesById[copy] as LayoutNode).valueScope?.field).toBe('object_copy')
        const copyChildren = (graph.value.nodesById[copy] as LayoutNode).slots.default!.map(item => graph.value.nodesById[item.nodeId]!)
        expect(copyChildren.find(node => node.kind === 'field')).toMatchObject({ field: 'input' })
        expect(copyChildren.find(node => node.kind === 'layout')).toMatchObject({ valueScope: { field: 'items' } })
        controller.select(first)
        expect(controller.performNodeAction('copyToClipboard', first)).toBe(true)
        expect(controller.performNodeAction('paste', second)).toBe(true)
        expect((controller.selectedNode.value as LayoutNode).valueScope?.field).toBe('object_copy_2')
        expect(engine.undo().changed).toBe(true)
        expect(engine.redo().changed).toBe(true)
      }
      finally {
        scope.stop()
      }
    })

    it('round-trips scope setters without treating dotted business keys as paths or bypassing Model validation', () => {
      const fixture = createNestedMaterialFixture(provider)
      const engine = createProjectDomainEngine({ document: fixture.document, registry: fixture.contracts })
      const currentGraph = () => JSON.parse(JSON.stringify(engine.snapshot.document.pagesById.home!.graph)) as PageGraph
      const setters = fixture.registry.getMaterial(`${provider.prefix}.detail-table`)!.setters
      const values: Record<string, unknown> = { scopeField: 'order.details', itemKey: 'order.id', minItems: 0, maxItems: 4, arrayDisplay: 'list', title: 'Invoice lines', readonly: true, disabled: true }
      for (const setter of setters) {
        expect(['text', 'number', 'select', 'boolean']).toContain(setter.control)
        expect(DEFAULT_DESIGNER_PROPERTY_CONTROLS[setter.control as 'text']).toBeDefined()
        const command = createNodePathCommand(currentGraph(), 'home', ['orders'], setter.path, values[setter.key])
        expect(engine.execute(JSON.parse(JSON.stringify(command))).diagnostics).toEqual([])
        engine.sealHistoryGroup()
      }
      expect(currentGraph().nodesById.orders).toMatchObject({
        valueScope: { kind: 'array', field: 'order.details', itemKey: 'order.id', minItems: 0, maxItems: 4 },
        props: { arrayDisplay: 'list', title: 'Invoice lines', readonly: true, disabled: true },
      })
      const before = engine.snapshot.contentHash
      expect(engine.execute(createNodePathCommand(currentGraph(), 'home', ['orders'], ['valueScope', 'maxItems'], -1)).changed).toBe(false)
      expect(engine.snapshot.contentHash).toBe(before)
      expect(engine.execute(createNodePathCommand(currentGraph(), 'home', ['sku'], ['valueScope'], { kind: 'object', field: 'invalid' })).changed).toBe(false)
      expect(engine.execute(createNodePathCommand(currentGraph(), 'home', ['orders'], ['valueScope', 'itemKey'], undefined)).changed).toBe(true)
      expect((currentGraph().nodesById.orders as LayoutNode).valueScope).not.toHaveProperty('itemKey')
      expect(engine.undo().changed).toBe(true)
      expect((currentGraph().nodesById.orders as LayoutNode).valueScope?.itemKey).toBe('order.id')
      expect(engine.redo().changed).toBe(true)
      expect(() => createNodePathCommand(currentGraph(), 'home', ['orders'], ['valueScope', '__proto__'], 'bad')).toThrow('DESIGN_PROPERTY_PATH_INVALID')
    })

    it('compiles and mounts real controls for object siblings, table columns and two-level array row operations', async () => {
      const fixture = createNestedMaterialFixture(provider)
      const renderer = fixture.compile()
      expect(renderer.plan.valueSchema.valueScopes.find(scope => scope.nodeId === 'lines')?.parentId).toBe('orders')
      const initial = nestedMaterialValues()
      const values = shallowRef<ConfigFormValues>(structuredClone(initial))
      const wrapper = mount(ConfigFormRenderer as Component, { props: { ...renderer, model: createConfigFormModel(values) } })
      const api = wrapper.vm as unknown as ConfigFormRendererExpose
      try {
        expect(wrapper.findAll(provider.inputSelector)).toHaveLength(8)
        expect(wrapper.findAll('table > thead > tr > th').map(header => header.text())).toEqual(['SKU', 'Delivery', 'Lines', 'Actions'])
        expect(wrapper.findAll('table > tbody > tr > td')).toHaveLength(8)
        const buyer = api.listFieldInstances('buyer-name')[0]!
        const seller = api.listFieldInstances('seller-name')[0]!
        expect(buyer.valuePath).toEqual(['buyer', 'name'])
        expect(seller.valuePath).toEqual(['seller', 'name'])
        api.setInstanceValue(buyer.address, 'Edited buyer')
        expect(api.getInstanceValue(seller.address)).toBe('Seller')
        const firstRow = api.listRows('orders')[0]!
        const secondRow = api.listRows('orders')[1]!
        const firstInput = wrapper.findAll('[data-field="sku"] input')[0]!
        const firstElement = firstInput.element
        await firstInput.setValue('Edited SKU')
        const nestedRows = api.listRows('lines', firstRow.scope)
        const secondNestedId = api.listRows('lines', secondRow.scope)[0]!.rowId
        await wrapper.findAll('[data-config-form-array="lines"]')[0]!.get('[data-config-form-row-action="append"]').trigger('click')
        expect(api.listRows('lines', firstRow.scope)).toHaveLength(2)
        expect(api.listRows('lines', secondRow.scope)[0]!.rowId).toBe(secondNestedId)
        expect(wrapper.findAll('[data-config-form-array="lines"]')[0]!.get('[data-config-form-row-action="append"]').attributes('disabled')).toBeDefined()
        expect(api.listRows('lines', firstRow.scope)[0]!.rowId).toBe(nestedRows[0]!.rowId)
        const nestedArray = () => wrapper.findAll('[data-config-form-array="lines"]')[0]!
        const nestedItems = () => nestedArray().findAll('[data-config-form-row]')
        const nestedAction = (index: number, action: string) => nestedItems()[index]!.get(`[data-config-form-row-action="${action}"]`)
        const originalLineInput = nestedItems()[0]!.get('input').element
        await nestedAction(1, 'remove').trigger('click')
        expect(api.listRows('lines', firstRow.scope)).toHaveLength(1)
        expect(nestedAction(0, 'remove').attributes('disabled')).toBeDefined()
        await nestedAction(0, 'duplicate').trigger('click')
        const copiedLine = api.listRows('lines', firstRow.scope)[1]!
        expect(copiedLine.value).toEqual(nestedRows[0]!.value)
        expect(copiedLine.rowId).not.toBe(nestedRows[0]!.rowId)
        await nestedAction(0, 'move-down').trigger('click')
        expect(api.listRows('lines', firstRow.scope)[1]!.rowId).toBe(nestedRows[0]!.rowId)
        expect(nestedItems()[1]!.get('input').element).toBe(originalLineInput)
        await nestedAction(1, 'move-up').trigger('click')
        expect(api.listRows('lines', firstRow.scope)[0]!.rowId).toBe(nestedRows[0]!.rowId)
        expect(api.listRows('lines', secondRow.scope)[0]!.rowId).toBe(secondNestedId)
        const tableRows = () => wrapper.findAll('table > tbody > tr')
        await tableRows()[0]!.get('td:last-child > [data-config-form-row-actions] [data-config-form-row-action="duplicate"]').trigger('click')
        expect(api.listRows('orders')).toHaveLength(3)
        const copied = api.listRows('orders')[1]!
        expect(copied.value).toEqual(api.listRows('orders')[0]!.value)
        expect(copied.rowId).not.toBe(firstRow.rowId)
        expect(api.listRows('lines', copied.scope)[0]!.rowId).not.toBe(nestedRows[0]!.rowId)
        const outerAppend = wrapper.get('[data-config-form-array="orders"] > section > [data-config-form-array-actions] button')
        expect(outerAppend.attributes('disabled')).toBeDefined()
        await tableRows()[0]!.get('td:last-child > [data-config-form-row-actions] [data-config-form-row-action="move-down"]').trigger('click')
        expect(api.listRows('orders')[1]!.rowId).toBe(firstRow.rowId)
        expect(tableRows()[1]!.get('[data-field="sku"] input').element).toBe(firstElement)
        await tableRows()[1]!.get('td:last-child > [data-config-form-row-actions] [data-config-form-row-action="move-up"]').trigger('click')
        expect(api.listRows('orders')[0]!.rowId).toBe(firstRow.rowId)
        await tableRows()[1]!.get('td:last-child > [data-config-form-row-actions] [data-config-form-row-action="remove"]').trigger('click')
        await tableRows()[1]!.get('td:last-child > [data-config-form-row-actions] [data-config-form-row-action="remove"]').trigger('click')
        expect(api.listRows('orders')).toHaveLength(1)
        expect(tableRows()[0]!.get('td:last-child [data-config-form-row-action="remove"]').attributes('disabled')).toBeDefined()
        await outerAppend.trigger('click')
        expect(api.listRows('orders')).toHaveLength(2)
        expect(api.listRows('orders')[1]!.value.sku).toBe('New SKU')
        await api.resetFields()
        await nextTick()
        expect(values.value).toEqual(initial)
      }
      finally {
        wrapper.unmount()
      }
    })

    it('changes array presentation without replacing values, row identities or instance state', async () => {
      const fixture = createNestedMaterialFixture(provider)
      const initial = nestedMaterialValues()
      const values = shallowRef(initial)
      const wrapper = mount(ConfigFormRenderer as Component, { props: { ...fixture.compile(), model: createConfigFormModel(values) } })
      const api = wrapper.vm as unknown as ConfigFormRendererExpose
      try {
        const rows = api.listRows('orders')
        const nestedRows = api.listRows('lines', rows[0]!.scope)
        const address = api.listFieldInstances('sku')[0]!.address
        api.setInstanceValue(address, '')
        api.setInstanceTouched(address)
        await api.validateInstance(address)
        const beforeValues = api.getValues()
        const beforeMeta = api.getInstanceMeta(address)
        const beforeErrors = api.getInstanceErrors(address)
        expect(beforeErrors.length).toBeGreaterThan(0)
        fixture.graph.nodesById.orders!.props.arrayDisplay = 'list'
        await wrapper.setProps(fixture.compile())
        expect(wrapper.find('table').exists()).toBe(false)
        expect(api.getValues()).toEqual(beforeValues)
        expect(api.listRows('orders').map(row => row.rowId)).toEqual(rows.map(row => row.rowId))
        expect(api.listRows('lines', rows[0]!.scope).map(row => row.rowId)).toEqual(nestedRows.map(row => row.rowId))
        expect(api.getInstanceMeta(address)).toEqual(beforeMeta)
        expect(api.getInstanceErrors(address)).toEqual(beforeErrors)
        fixture.graph.nodesById.orders!.props.arrayDisplay = 'table'
        await wrapper.setProps(fixture.compile())
        expect(wrapper.find('table').exists()).toBe(true)
        expect(api.getValues()).toEqual(beforeValues)
        expect(api.listRows('orders').map(row => row.rowId)).toEqual(rows.map(row => row.rowId))
      }
      finally { wrapper.unmount() }
    })

    it('preserves required labels, scoped errors, readonly submission and reset through real Provider controls', async () => {
      const fixture = createNestedMaterialFixture(provider)
      const values = shallowRef(nestedMaterialValues())
      const onSubmit = vi.fn()
      const wrapper = mount(ConfigFormRenderer as Component, { props: { ...fixture.compile(), model: createConfigFormModel(values), onSubmit } })
      const api = wrapper.vm as unknown as ConfigFormRendererExpose
      try {
        await wrapper.findAll('[data-field="sku"] input')[0]!.setValue('')
        await api.submit()
        await nextTick()
        expect(onSubmit).not.toHaveBeenCalled()
        const instance = api.listFieldInstances('sku')[0]!
        expect(api.getInstanceErrors(instance.address).length).toBeGreaterThan(0)
        expect(api.getInstanceErrors(api.listFieldInstances('sku')[1]!.address)).toEqual([])
        const input = wrapper.findAll('[data-field="sku"] input')[0]!
        expect(input.attributes('aria-required')).toBe('true')
        expect(input.attributes('aria-invalid')).toBe('true')
        const label = wrapper.findAll('[data-field="sku"] label')[0]!
        expect(label.attributes('for')).toBe(input.attributes('id'))
        expect(input.attributes('aria-describedby')).toBeTruthy()
        await input.setValue('Valid')
        await api.submit()
        expect(onSubmit).toHaveBeenCalledOnce()
        expect(onSubmit.mock.calls[0]![0]).toEqual(api.getValues())
        await wrapper.setProps({ readonly: true })
        expect(wrapper.findAll('[data-config-form-row-action]').every(button => button.attributes('disabled') !== undefined)).toBe(true)
        expect(wrapper.findAll(provider.inputSelector)).toHaveLength(0)
        const before = api.getValues()
        await wrapper.get('[data-config-form-row-action="duplicate"]').trigger('click')
        expect(api.getValues()).toEqual(before)
        await api.submit()
        expect(onSubmit).toHaveBeenCalledTimes(2)
        await wrapper.setProps({ readonly: false })
        await api.resetFields()
        await nextTick()
        expect(values.value).toEqual(nestedMaterialValues())
        expect(api.getErrors()).toEqual({})
      }
      finally {
        wrapper.unmount()
      }
    })

    it('projects a single real design template from zero-row defaults without business writes or requests', async () => {
      const fixture = createNestedMaterialFixture(provider)
      for (const node of Object.values(fixture.graph.nodesById)) {
        if (node.kind === 'layout' && node.valueScope?.kind === 'array') {
          node.valueScope.minItems = 0
          node.valueScope.maxItems = 0
        }
      }
      const renderer = fixture.compile()
      const original = JSON.stringify(renderer.plan)
      const valueSchema = projectRendererDesignValueSchema(renderer.plan)
      const defaults = createConfigFormValueScopeStore({ scopes: valueSchema.valueScopes, fields: valueSchema.scopedFields }).getValues()
      const values = shallowRef(defaults)
      const request = vi.fn()
      const onFlow = vi.fn()
      const registerNode = vi.fn((_metadata: ConfigFormRuntimeNodeMetadata, _element: HTMLElement) => undefined)
      const wrapper = mount(ConfigFormRenderer as Component, { props: {
        ...renderer,
        mode: 'design',
        model: createConfigFormModel(values),
        plan: { ...renderer.plan, valueSchema },
        dataSourceHost: { request },
        editor: { registerNode },
        onFlow,
      } })
      try {
        expect(wrapper.findAll('table > tbody > tr')).toHaveLength(1)
        expect(wrapper.findAll('[data-config-form-array="lines"] [data-config-form-row]')).toHaveLength(1)
        expect(wrapper.findAll('[data-config-form-row-action]')).toHaveLength(0)
        expect(wrapper.findAll(provider.inputSelector)).toHaveLength(5)
        const ids = registerNode.mock.calls.map(([metadata]) => metadata.nodeId)
        expect(ids.filter(id => id === 'orders')).toHaveLength(1)
        expect(ids.filter(id => id === 'lines')).toHaveLength(1)
        expect(ids.filter(id => id === 'sku')).toHaveLength(1)
        await wrapper.findAll('[data-field="sku"] input')[0]!.setValue('Blocked')
        expect(values.value).toEqual(defaults)
        expect(JSON.stringify(renderer.plan)).toBe(original)
        expect(request).not.toHaveBeenCalled()
        expect(onFlow).not.toHaveBeenCalled()
      }
      finally { wrapper.unmount() }
    })

    it('limits populated design arrays to one geometry instance without deleting rows', () => {
      const fixture = createNestedMaterialFixture(provider)
      const initial = nestedMaterialValues()
      const values = shallowRef(initial)
      const wrapper = mount(ConfigFormRenderer as Component, { props: {
        ...fixture.compile(),
        mode: 'design',
        model: createConfigFormModel(values),
      } })
      try {
        expect(wrapper.findAll('table > tbody > tr')).toHaveLength(1)
        expect(wrapper.findAll(provider.inputSelector)).toHaveLength(5)
        expect(wrapper.findAll('[data-config-form-row-action]')).toHaveLength(0)
        expect(values.value).toEqual(initial)
      }
      finally { wrapper.unmount() }
    })

    it('duplicates natural row values without copying a configured business item key', async () => {
      const fixture = createNestedMaterialFixture(provider)
      ;(fixture.graph.nodesById.orders as LayoutNode).valueScope!.itemKey = 'id'
      const initial = nestedMaterialValues()
      const orders = initial.orders as Record<string, unknown>[]
      orders[0]!.id = 'first-id'
      orders[1]!.id = 'second-id'
      const wrapper = mount(ConfigFormRenderer as Component, { props: { ...fixture.compile(), model: createConfigFormModel(shallowRef(initial)) } })
      const api = wrapper.vm as unknown as ConfigFormRendererExpose
      try {
        await wrapper.findAll('table > tbody > tr')[0]!.get('td:last-child > [data-config-form-row-actions] [data-config-form-row-action="duplicate"]').trigger('click')
        const rows = api.listRows('orders')
        expect(rows).toHaveLength(3)
        expect(rows[1]!.value).toEqual({ sku: 'First', delivery: { city: 'London' }, lines: [{ name: 'First line' }] })
        expect(rows[0]!.value.id).toBe('first-id')
      }
      finally { wrapper.unmount() }
    })

    it('locks array actions under disabled containers', () => {
      const fixture = createNestedMaterialFixture(provider)
      fixture.graph.nodesById.orders!.props.disabled = true
      const wrapper = mount(ConfigFormRenderer as Component, { props: { ...fixture.compile(), model: createConfigFormModel(shallowRef(nestedMaterialValues())) } })
      try {
        expect(wrapper.get('[data-config-form-array="orders"]').findAll('[data-config-form-row-action]').every(button => button.attributes('disabled') !== undefined)).toBe(true)
        expect(wrapper.get('[data-config-form-array="orders"]').findAll(provider.inputSelector).every(input => input.attributes('disabled') !== undefined)).toBe(true)
      }
      finally { wrapper.unmount() }
    })

    it('honors container readonly for descendant controls and scoped validation', async () => {
      const fixture = createNestedMaterialFixture(provider)
      fixture.graph.nodesById.orders!.props.readonly = true
      const values = shallowRef(nestedMaterialValues())
      const wrapper = mount(ConfigFormRenderer as Component, { props: { ...fixture.compile(), model: createConfigFormModel(values) } })
      try {
        const array = wrapper.get('[data-config-form-array="orders"]')
        expect(array.findAll('[data-config-form-row-action]').every(button => button.attributes('disabled') !== undefined)).toBe(true)
        expect(array.findAll(provider.inputSelector)).toHaveLength(0)
      }
      finally {
        wrapper.unmount()
      }
    })
  })
}
