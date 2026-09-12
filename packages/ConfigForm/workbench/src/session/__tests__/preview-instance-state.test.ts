import type { ConfigFormController } from '@moluoxixi/config-form-headless'
import type { FieldNode, LayoutNode } from '@moluoxixi/config-form-model'
import type { RuntimeHostRuntimeStatePayload } from '../../runtime-host'
import { createConfigFormController } from '@moluoxixi/config-form-headless'
import { describe, expect, it } from 'vitest'
import { createPreviewSession } from '../services/preview'
import { compileScopedFixture, nestedValues, scopedGraph } from './preview-instance-fixture'

function capture(controller: ConfigFormController<Record<string, unknown>>): RuntimeHostRuntimeStatePayload {
  const fields = controller.listFieldInstances().map(instance => ({
    ...instance.address,
    scope: [...instance.address.scope],
    instanceKey: instance.instanceKey,
    valuePath: [...instance.valuePath],
  }))
  return {
    fields,
    values: controller.getValues(),
    touched: fields.filter(field => controller.getInstanceMeta(field).touched).map(field => field.instanceKey),
    validation: controller.getErrors(),
  }
}

function setup() {
  const fixture = compileScopedFixture()
  const session = createPreviewSession()
  const projection = session.accept(fixture.input)!
  let values: Record<string, unknown> = nestedValues()
  let nextRow = 0
  const controller = createConfigFormController<Record<string, unknown>>({
    fields: () => fixture.runtime.artifact.renderer.fields,
    valueSchema: fixture.runtime.artifact.renderer.plan.valueSchema,
    createRowId: () => `controller-row-${++nextRow}`,
    model: { read: () => values, write: next => values = next },
  })
  const host = { hostId: 'live-host', projectId: 'scoped-preview', pageId: 'home', revision: projection.current.revisionKey }
  session.handleRuntimeMounted(host)
  for (const instance of controller.listFieldInstances())
    controller.setInstanceTouched(instance.address, true)
  controller.setErrors(Object.fromEntries(controller.listFieldInstances().map(instance => [instance.instanceKey, [`${instance.address.nodeId} error`]])))
  const state = capture(controller)
  session.handleRuntimeState({ ...host, state })
  return {
    controller,
    fixture,
    host,
    session,
    state,
    dispose() {
      controller.dispose()
      session.dispose()
    },
  }
}

describe('preview instance contracts with real compiler and controller', () => {
  it('preserves separate same-name objects, literal dotted keys and two-level arrays during ordinary recompilation', () => {
    const context = setup()
    const graph = scopedGraph()
    graph.nodesById['billing-name']!.props.placeholder = 'New placeholder'
    const next = compileScopedFixture(graph, 1)
    context.session.accept(next.input)
    expect(context.session.runtimeState.value).toEqual(context.state)
    expect(context.session.runtimeState.value.values).toEqual(nestedValues())
    expect(context.session.runtimeState.value.fields.filter(field => field.nodeId === 'item-name')).toHaveLength(4)
    expect(context.session.runtimeState.value.values).not.toHaveProperty('literal')
    expect(context.session.runtimeState.value.fields.find(field => field.nodeId === 'literal')?.valuePath).toEqual(['literal.name'])
    context.dispose()
  })

  it('keeps errors and touched on stable rows after outer and inner sorting and removes only deleted-row state', () => {
    const context = setup()
    const [outer] = context.controller.listRows('groups')
    const inner = context.controller.listRows('items', outer!.scope)
    const retained = context.controller.listFieldInstances('item-name').find(instance => instance.value === 'A2')!
    const removed = context.controller.listFieldInstances('item-name').find(instance => instance.value === 'B1')!
    const otherOuter = context.controller.listRows('groups')[1]!
    context.controller.moveRow('groups', outer!.rowId, 1)
    context.controller.moveRow('items', inner[1]!.rowId, 0, outer!.scope)
    context.controller.removeRow('items', context.controller.listRows('items', otherOuter.scope)[0]!.rowId, otherOuter.scope)
    const state = capture(context.controller)
    context.session.handleRuntimeState({ ...context.host, state })
    context.session.accept(compileScopedFixture(scopedGraph(), 1).input)
    expect(context.session.runtimeState.value).toEqual(state)
    expect(state.fields.find(field => field.instanceKey === retained.instanceKey)?.valuePath).toEqual(['groups', 1, 'items', 0, 'name'])
    expect(state.touched).toContain(retained.instanceKey)
    expect(state.validation[retained.instanceKey]).toEqual(['item-name error'])
    expect(state.touched).not.toContain(removed.instanceKey)
    expect(state.validation).not.toHaveProperty(removed.instanceKey)
    expect(JSON.stringify(state.values)).not.toContain('controller-row-')
    context.dispose()
  })

  it('adds and removes only the corresponding nested field values and metadata', () => {
    const context = setup()
    const graph = scopedGraph()
    graph.nodesById.currency = { ...(graph.nodesById['billing-name'] as FieldNode), id: 'currency', field: 'currency', defaultValue: 'EUR' }
    ;(graph.nodesById.billing as LayoutNode).slots.default!.push({ nodeId: 'currency', placement: {} })
    delete graph.nodesById['shipping-name']
    ;(graph.nodesById.shipping as LayoutNode).slots.default = []
    context.session.accept(compileScopedFixture(graph, 1).input)
    const state = context.session.runtimeState.value
    expect(state.values).toEqual({ ...nestedValues(), billing: { ...nestedValues().billing, currency: 'EUR' }, shipping: {} })
    expect(state.fields).toEqual(context.state.fields.filter(field => field.nodeId !== 'shipping-name'))
    const removed = context.state.fields.find(field => field.nodeId === 'shipping-name')!
    expect(state.touched).toEqual(context.state.touched.filter(key => key !== removed.instanceKey))
    const errors = { ...context.state.validation }
    delete errors[removed.instanceKey]
    expect(state.validation).toEqual(errors)
    context.dispose()
  })

  it.each(['rename', 'component', 'scope'] as const)('drops only incompatible state on a field %s', (change) => {
    const context = setup()
    const graph = scopedGraph()
    const field = graph.nodesById['billing-name'] as FieldNode
    if (change === 'rename') {
      field.field = 'new.name'
    }
    else if (change === 'component') {
      field.component = 'test.other'
    }
    else {
      ;(graph.nodesById.billing as LayoutNode).slots.default = []
      graph.root.push({ nodeId: 'billing-name', placement: {} })
    }
    context.session.accept(compileScopedFixture(graph, 1).input)
    const state = context.session.runtimeState.value
    const old = context.state.fields.find(field => field.nodeId === 'billing-name')!
    expect(state.touched).not.toContain(old.instanceKey)
    expect(state.validation).not.toHaveProperty(old.instanceKey)
    expect(state.fields).toEqual(context.state.fields.filter(field => field.nodeId !== 'billing-name'))
    expect(state.values.shipping).toEqual(nestedValues().shipping)
    expect(state.values.groups).toEqual(nestedValues().groups)
    expect(state.values.billing).toEqual(change === 'scope'
      ? { extra: { retained: true } }
      : { [change === 'rename' ? 'new.name' : 'name']: 'billing-name default', extra: { retained: true } })
    if (change === 'scope')
      expect(state.values.name).toBe('billing-name default')
    context.dispose()
  })

  it('drops incompatible component fingerprints even when the component key and graph stay identical', () => {
    const context = setup()
    const next = compileScopedFixture(scopedGraph(), 1, '2')
    expect(next.compilation.registryUsage).not.toEqual(context.fixture.compilation.registryUsage)
    context.session.accept(next.input)
    const state = context.session.runtimeState.value
    expect(state.values.billing).toEqual({ name: 'billing-name default', extra: { retained: true } })
    expect(state.values.groups).toEqual([
      { name: 'group-name default', items: [{ name: 'item-name default' }, { name: 'item-name default' }] },
      { name: 'group-name default', items: [{ name: 'item-name default' }, { name: 'item-name default' }] },
    ])
    expect(state.fields).toEqual([])
    expect(state.touched).toEqual([])
    expect(state.validation).toEqual({})
    context.dispose()
  })

  it('does not accept a forged directory path as the contract of a different same-name field', () => {
    const context = setup()
    const billing = context.state.fields.find(field => field.nodeId === 'billing-name')!
    const shipping = context.state.fields.find(field => field.nodeId === 'shipping-name')!
    context.session.handleRuntimeState({ ...context.host, state: {
      ...context.state,
      fields: context.state.fields.filter(field => field !== shipping).map(field => field === billing ? { ...field, valuePath: ['shipping', 'name'] } : field),
      touched: [billing.instanceKey],
      validation: { [billing.instanceKey]: ['forged'] },
    } })
    expect(context.session.runtimeState.value.fields.some(field => field.nodeId === 'billing-name')).toBe(false)
    expect(context.session.runtimeState.value.touched).toEqual([])
    expect(context.session.runtimeState.value.validation).toEqual({})
    context.dispose()
  })
  it('invalidates a changed ancestor scope contract without affecting adjacent objects', () => {
    const context = setup()
    const graph = scopedGraph()
    ;(graph.nodesById.groups as LayoutNode).valueScope!.maxItems = 1
    context.session.accept(compileScopedFixture(graph, 1).input)
    const state = context.session.runtimeState.value
    expect(state.values).toEqual({ ...nestedValues(), groups: [] })
    expect(state.fields).toEqual(context.state.fields.filter(field => field.scope.length === 0))
    const retained = new Set(state.fields.map(field => field.instanceKey))
    expect(state.touched).toEqual(context.state.touched.filter(key => retained.has(key)))
    expect(state.validation).toEqual(Object.fromEntries(Object.entries(context.state.validation).filter(([key]) => retained.has(key))))
    context.dispose()
  })
})
