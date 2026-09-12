import type { ConfigFormFlow } from '@moluoxixi/config-form-core'
import type { Component } from 'vue'
import type { ConfigFormPageRuntimePlan } from '../../runtime'
import { analyzeConfigFormFlow } from '@moluoxixi/config-form-core'
import { createConfigFormModel } from '@moluoxixi/config-form-headless'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, shallowRef } from 'vue'
import { ConfigFormRenderer } from '../index'

const Control = defineComponent({
  props: ['modelValue'],
  emits: ['commit'],
  setup: (props, { emit }) => () => h('input', {
    value: props.modelValue,
    onInput: (event: Event) => emit('commit', (event.target as HTMLInputElement).value, { source: 'input' }),
  }),
})
const actionDescriptor = {
  ref: 'work',
  title: 'Work',
  category: 'test',
  parameters: [],
  outputs: [],
  capabilities: [],
} as const

function flow(trigger: ConfigFormFlow['trigger'] = { kind: 'component.event', nodeId: 'name', event: 'commit' }): ConfigFormFlow {
  return {
    version: 1,
    id: 'on-change',
    name: 'Change',
    trigger,
    nodes: [
      { id: 'start', type: 'trigger' },
      { id: 'action', type: 'action', ref: 'work', config: { input: { $event: 'args.0' } } },
      { id: 'done', type: 'success' },
    ],
    edges: [{ id: 'a', source: 'start', target: 'action' }, { id: 'b', source: 'action', target: 'done' }],
  }
}

function runtimePlan(source: ConfigFormFlow): ConfigFormPageRuntimePlan {
  const result = analyzeConfigFormFlow(source)
  if (!result.success)
    throw new Error(result.diagnostics.map(item => item.message).join('; '))
  return {
    flows: [result.plan],
    optionBindings: [],
    runtime: { dataSources: [], variables: [] },
    valueSchema: {
      scopedFields: [{ field: 'name', nodeId: 'name' }],
      valueScopes: [],
    },
  }
}

describe('public form event execution', () => {
  it('updates binding first, captures all args, and runs once when blur uses the same event', async () => {
    const values = shallowRef({ name: 'Ada', result: '' })
    const listener = vi.fn(() => expect(values.value.name).toBe('Grace'))
    const execute = vi.fn((input, context) => {
      expect(input).toBe('Grace')
      expect(context.event.args).toEqual(['Grace', { source: 'input' }])
      expect(context.event.field).toBe('name')
      context.form.setValue('result', input)
    })
    const wrapper = mount(ConfigFormRenderer as Component, { props: {
      model: createConfigFormModel(values),
      plan: runtimePlan(flow()),
      flowActions: { get: () => ({ descriptor: actionDescriptor, execute }) },
      fields: [{ id: 'name', field: 'name', component: Control, trigger: 'commit', blurTrigger: 'commit', props: { onCommit: listener } }],
    } })
    await wrapper.get('input').setValue('Grace')
    await flushPromises()
    expect(values.value).toEqual({ name: 'Grace', result: 'Grace' })
    expect(listener).toHaveBeenCalledOnce()
    expect(execute).toHaveBeenCalledOnce()
    expect(wrapper.emitted('runtimeEvent')).toHaveLength(1)
    wrapper.unmount()
  })

  it('keeps design mode side-effect free and cancels without publishing after unmount', async () => {
    const execute = vi.fn(() => new Promise(() => {}))
    const result = vi.fn()
    const props = {
      model: createConfigFormModel(shallowRef({ name: 'Ada' })),
      plan: runtimePlan(flow()),
      flowActions: { get: () => ({ descriptor: actionDescriptor, execute }) },
      fields: [{ id: 'name', field: 'name', component: Control, trigger: 'commit' }],
      onFlowResult: result,
    }
    const design = mount(ConfigFormRenderer as Component, { props: { ...props, mode: 'design' } })
    await design.get('input').setValue('Ignored')
    await flushPromises()
    expect(execute).not.toHaveBeenCalled()
    design.unmount()
    const preview = mount(ConfigFormRenderer as Component, { props })
    await flushPromises()
    result.mockClear()
    await preview.get('input').setValue('Grace')
    await vi.waitFor(() => expect(execute).toHaveBeenCalledOnce())
    preview.unmount()
    await flushPromises()
    expect(result).not.toHaveBeenCalled()
  })

  it('reports rejected configured callbacks and still runs subscribed events', async () => {
    const execute = vi.fn()
    const wrapper = mount(ConfigFormRenderer as Component, { props: {
      model: createConfigFormModel(shallowRef({ name: '' })),
      plan: runtimePlan(flow()),
      flowActions: { get: () => ({ descriptor: actionDescriptor, execute }) },
      fields: [{ id: 'name', field: 'name', component: Control, trigger: 'commit', props: {
        onCommit: async () => { throw new Error('listener failed') },
      } }],
    } })
    await wrapper.get('input').setValue('Grace')
    await flushPromises()
    expect(wrapper.emitted('flowError')).toEqual([[expect.objectContaining({ code: 'FLOW_COMPONENT_LISTENER_ERROR', message: 'listener failed' })]])
    expect(execute).toHaveBeenCalledOnce()
    wrapper.unmount()
  })
})
