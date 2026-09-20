import type { Component } from 'vue'
import type { ConfigFormSurfaceRuntimePlan } from '../../runtime'
import type { ConfigFormRendererExpose } from '../types'
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

const SemanticControl = defineComponent({
  emits: ['row-click'],
  setup: (_, { emit }) => () => h('button', {
    type: 'button',
    onClick: () => emit('row-click', { id: 'row-1', title: 'Ada' }),
  }, 'activate row'),
})

const plan: ConfigFormSurfaceRuntimePlan = {
  optionBindings: [],
  runtime: { dataSources: [], variables: [] },
  valueSchema: {
    scopedFields: [{ field: 'name', nodeId: 'name' }],
    valueScopes: [],
  },
}

describe('code-config component listeners', () => {
  it('updates binding and blur bookkeeping before invoking props listeners exactly once', async () => {
    const values = shallowRef({ name: 'Ada' })
    const listener = vi.fn((value: unknown, detail: unknown) => {
      expect(values.value.name).toBe('Grace')
      expect(value).toBe('Grace')
      expect(detail).toEqual({ source: 'input' })
    })
    const wrapper = mount(ConfigFormRenderer as Component, { props: {
      model: createConfigFormModel(values),
      plan,
      fields: [{
        id: 'name',
        field: 'name',
        component: Control,
        trigger: 'commit',
        blurTrigger: 'commit',
        props: { onCommit: listener },
      }],
    } })

    await wrapper.get('input').setValue('Grace')

    expect(values.value.name).toBe('Grace')
    expect(listener).toHaveBeenCalledOnce()
    expect((wrapper.vm as unknown as ConfigFormRendererExpose).getFieldMeta('name').touched).toBe(true)
    wrapper.unmount()
  })

  it('blocks binding and host listeners directly in design mode', async () => {
    const values = shallowRef({ name: 'Ada' })
    const listener = vi.fn()
    const wrapper = mount(ConfigFormRenderer as Component, { props: {
      mode: 'design',
      model: createConfigFormModel(values),
      plan,
      fields: [{ id: 'name', field: 'name', component: Control, trigger: 'commit', props: { onCommit: listener } }],
    } })

    await wrapper.get('input').setValue('Ignored')

    expect(values.value.name).toBe('Ada')
    expect(listener).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('passes plain component props listeners through without a central event channel', async () => {
    const onClick = vi.fn()
    const wrapper = mount(ConfigFormRenderer as Component, { props: {
      model: createConfigFormModel(shallowRef({})),
      fields: [{ id: 'save', component: 'button', props: { type: 'button', onClick } }],
    } })

    await wrapper.get('button').trigger('click')

    expect(onClick).toHaveBeenCalledOnce()
    wrapper.unmount()
  })

  it('converts only declared provider events into closed semantic activations', async () => {
    const onSemanticActivate = vi.fn()
    const wrapper = mount(ConfigFormRenderer as Component, { props: {
      model: createConfigFormModel(shallowRef({})),
      fields: [{
        id: 'dataset-table',
        component: SemanticControl,
        props: {},
        semanticEvents: { rowActivate: 'row-click' },
      }],
      onSemanticActivate,
    } })

    await wrapper.get('button').trigger('click')

    expect(onSemanticActivate).toHaveBeenCalledWith({
      nodeId: 'dataset-table',
      trigger: 'rowActivate',
      args: [{ id: 'row-1', title: 'Ada' }],
    })
    wrapper.unmount()
  })

  it('suppresses declared semantic activations in design mode', async () => {
    const onSemanticActivate = vi.fn()
    const wrapper = mount(ConfigFormRenderer as Component, { props: {
      mode: 'design',
      model: createConfigFormModel(shallowRef({})),
      fields: [{
        id: 'dataset-table',
        component: SemanticControl,
        props: {},
        semanticEvents: { rowActivate: 'row-click' },
      }],
      onSemanticActivate,
    } })

    await wrapper.get('button').trigger('click')

    expect(onSemanticActivate).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('lets Vue handle configured listener failures', async () => {
    const failure = new Error('listener failed')
    const onError = vi.fn()
    const wrapper = mount(ConfigFormRenderer as Component, {
      global: { config: { errorHandler: onError } },
      props: {
        model: createConfigFormModel(shallowRef({ name: '' })),
        plan,
        fields: [{
          id: 'name',
          field: 'name',
          component: Control,
          trigger: 'commit',
          props: { onCommit: () => { throw failure } },
        }],
      },
    })

    await wrapper.get('input').setValue('Grace')
    await flushPromises()

    expect(onError).toHaveBeenCalledWith(failure, expect.anything(), expect.anything())
    wrapper.unmount()
  })
})
