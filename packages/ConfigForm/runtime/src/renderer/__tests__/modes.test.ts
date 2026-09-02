import type { Component } from 'vue'
import type { ConfigFormRuntimeEventContext, ConfigFormRuntimeNodeMetadata } from '../types'
import { defineField } from '@moluoxixi/config-form-headless'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { ConfigFormRenderer } from '../index'

interface SurfaceValues {
  name: string
}

const Input = defineComponent({
  name: 'ConfigFormRendererInput',
  inheritAttrs: false,
  props: {
    modelValue: { type: String, default: '' },
  },
  emits: ['blur', 'update:modelValue'],
  setup(props, { attrs, emit }) {
    return () => h('input', {
      ...attrs,
      'data-testid': 'surface-input',
      'onInput': (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).value),
      'value': props.modelValue,
    })
  },
})

const Host = defineComponent({
  name: 'ConfigFormRendererHost',
  setup: (_props, { slots }) => () => h('section', { 'data-testid': 'surface-host' }, slots.default?.()),
})

describe('configFormRenderer design and preview modes', () => {
  it('exposes stable node id, path, and slot metadata for nested real components', () => {
    const fields = [{
      id: 'section',
      component: Host,
      slots: {
        default: defineField<SurfaceValues>({ component: Input, field: 'name', id: 'name-node' }),
      },
    }]
    const wrapper = mount(ConfigFormRenderer as Component, {
      props: {
        fields,
        modelValue: { name: 'Ada' },
      },
    })

    const sectionCell = wrapper.get('.mx-config-form__cell')
    expect(sectionCell.attributes()).toMatchObject({
      'data-config-node-id': 'section',
      'data-config-node-kind': 'component',
      'data-config-path': 'fields.0',
    })
    const nestedField = wrapper.get('[data-field="name"]')
    expect(nestedField.attributes()).toMatchObject({
      'data-config-node-id': 'name-node',
      'data-config-node-kind': 'field',
      'data-config-path': 'fields.0.slots.default',
      'data-config-slot': 'default',
    })
  })

  it('registers real node cells and cleans registrations when unmounted', () => {
    const cleanups = [vi.fn(), vi.fn()]
    const registerNode = vi.fn<(
      metadata: ConfigFormRuntimeNodeMetadata<SurfaceValues>,
      element: HTMLElement,
    ) => (() => void) | void>()
    registerNode.mockImplementation((metadata) => {
      expect(metadata.nodeId).toBeTruthy()
      return cleanups[registerNode.mock.calls.length - 1]
    })
    const wrapper = mount(ConfigFormRenderer as Component, {
      props: {
        editor: { registerNode },
        fields: [
          defineField<SurfaceValues>({ component: Input, field: 'name', id: 'name-node' }),
        ],
        modelValue: { name: 'Ada' },
      },
    })

    expect(registerNode).toHaveBeenCalledTimes(1)
    expect(registerNode.mock.calls[0]![0]).toMatchObject({
      nodeId: 'name-node',
      path: 'fields.0',
    })
    expect(registerNode.mock.calls[0]![1]).toBeInstanceOf(HTMLElement)

    wrapper.unmount()
    expect(cleanups[0]).toHaveBeenCalledTimes(1)
  })

  it('merges design attributes onto the real node cell without replacing runtime layout classes', () => {
    const wrapper = mount(ConfigFormRenderer as Component, {
      props: {
        editor: {
          getNodeAttrs: () => ({
            'aria-label': 'Select name',
            'class': 'editor-node',
            'data-config-node-id': 'spoofed-id',
          }),
        },
        fields: [defineField<SurfaceValues>({ component: Input, field: 'name', id: 'name-node' })],
        mode: 'design',
        modelValue: { name: 'Ada' },
      },
    })

    const cell = wrapper.get('[data-config-node-id="name-node"]')
    expect(cell.classes()).toEqual(expect.arrayContaining(['mx-config-form__cell', 'editor-node']))
    expect(cell.attributes('aria-label')).toBe('Select name')
    expect(cell.attributes('data-config-node-id')).toBe('name-node')
  })

  it('blocks control side effects in design mode unless the editor explicitly allows them', async () => {
    const intercepted: ConfigFormRuntimeEventContext<SurfaceValues>[] = []
    const editor = {
      interceptEvent: (context: ConfigFormRuntimeEventContext<SurfaceValues>) => {
        intercepted.push(context)
      },
    }
    const wrapper = mount(ConfigFormRenderer as Component, {
      props: {
        editor,
        fields: [defineField<SurfaceValues>({ component: Input, field: 'name', id: 'name-node' })],
        mode: 'design',
        modelValue: { name: 'Ada' },
      },
    })

    await wrapper.get('[data-testid="surface-input"]').setValue('Grace')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(intercepted[0]).toMatchObject({
      event: 'update:modelValue',
      metadata: { nodeId: 'name-node', path: 'fields.0' },
    })

    const allowWrapper = mount(ConfigFormRenderer as Component, {
      props: {
        editor: { interceptEvent: () => false },
        fields: [defineField<SurfaceValues>({ component: Input, field: 'name', id: 'name-node' })],
        mode: 'design',
        modelValue: { name: 'Ada' },
      },
    })
    await allowWrapper.get('[data-testid="surface-input"]').setValue('Grace')
    expect(allowWrapper.emitted('update:modelValue')).toEqual([[{ name: 'Grace' }]])
  })

  it('does not broadcast component events without a canonical Flow subscription', async () => {
    const wrapper = mount(ConfigFormRenderer as Component, {
      props: {
        fields: [defineField<SurfaceValues>({ component: Input, field: 'name', id: 'name-node' })],
        mode: 'preview',
        modelValue: { name: 'Ada' },
      },
    })

    await wrapper.get('[data-testid="surface-input"]').setValue('Grace')
    expect(wrapper.emitted('runtimeEvent')).toBeUndefined()
  })

  it('listens to canonical Flow component events on the real component without duplicating bindings', async () => {
    const wrapper = mount(ConfigFormRenderer as Component, {
      props: {
        fields: [defineField<SurfaceValues>({
          component: Input,
          extensions: { 'mx.low-code': { flowEvents: ['click', 'update:modelValue'] } },
          field: 'name',
          id: 'name-node',
        })],
        mode: 'preview',
        modelValue: { name: 'Ada' },
      },
    })

    const input = wrapper.get('[data-testid="surface-input"]')
    await input.trigger('click')
    await input.setValue('Grace')

    const events = wrapper.emitted('runtimeEvent')?.map(item => item[0]) ?? []
    expect(events).toEqual([
      expect.objectContaining({ event: 'click', metadata: expect.objectContaining({ nodeId: 'name-node' }) }),
      expect.objectContaining({ event: 'update:modelValue', metadata: expect.objectContaining({ nodeId: 'name-node' }) }),
    ])
  })

  it('normalizes existing Vue listener keys to canonical component event names', async () => {
    const onClick = vi.fn()
    const wrapper = mount(ConfigFormRenderer as Component, {
      props: {
        fields: [{
          id: 'submit-node',
          component: 'button',
          extensions: { 'mx.low-code': { flowEvents: ['click'] } },
          props: { onClick },
        }],
        mode: 'preview',
        modelValue: { name: 'Ada' },
      },
    })

    await wrapper.get('button').trigger('click')
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('runtimeEvent')).toEqual([[
      expect.objectContaining({ event: 'click', metadata: expect.objectContaining({ nodeId: 'submit-node' }) }),
    ]])
  })

  it('merges an external flow reaction projection into real field props and states', async () => {
    const wrapper = mount(ConfigFormRenderer as Component, {
      props: {
        fields: [defineField<SurfaceValues>({ component: Input, field: 'name', id: 'name-node' })],
        modelValue: { name: 'Ada' },
        reactionProjection: {
          values: { name: 'Ada' },
          props: { name: { placeholder: 'Generated by flow' } },
          states: { name: { disabled: true, required: true } },
          validate: [],
        },
      },
    })

    const input = wrapper.get('[data-testid="surface-input"]')
    expect(input.attributes()).toMatchObject({
      'aria-required': 'true',
      'disabled': '',
      'placeholder': 'Generated by flow',
    })

    await wrapper.setProps({
      reactionProjection: {
        values: { name: 'Ada' },
        props: { name: { placeholder: 'Updated' } },
        states: { name: { disabled: false, required: false } },
        validate: [],
      },
    })
    expect(input.attributes('placeholder')).toBe('Updated')
    expect(input.attributes('disabled')).toBeUndefined()
    expect(input.attributes('aria-required')).toBeUndefined()
  })
})
