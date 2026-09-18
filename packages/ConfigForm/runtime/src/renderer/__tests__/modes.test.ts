import type { Component } from 'vue'
import type { ConfigFormRuntimeNodeMetadata } from '../types'
import { createConfigFormModel, defineField } from '@moluoxixi/config-form-headless'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, shallowRef } from 'vue'
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
        model: createConfigFormModel(shallowRef({ name: 'Ada' })),
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
        model: createConfigFormModel(shallowRef({ name: 'Ada' })),
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

  it('cleans old registrations before registering nodes with a replacement editor bridge', async () => {
    const firstCleanup = vi.fn()
    const secondCleanup = vi.fn()
    const firstRegister = vi.fn(() => firstCleanup)
    const secondRegister = vi.fn(() => secondCleanup)
    const wrapper = mount(ConfigFormRenderer as Component, {
      props: {
        editor: { registerNode: firstRegister },
        fields: [defineField<SurfaceValues>({ component: Input, field: 'name', id: 'name-node' })],
        mode: 'design',
        model: createConfigFormModel(shallowRef({ name: 'Ada' })),
      },
    })

    expect(firstRegister).toHaveBeenCalledOnce()
    await wrapper.setProps({ editor: { registerNode: secondRegister } })
    expect(firstCleanup).toHaveBeenCalledOnce()
    expect(secondRegister).toHaveBeenCalledOnce()

    wrapper.unmount()
    expect(secondCleanup).toHaveBeenCalledOnce()
  })

  it('restores configured tabindex after mounted design mode transitions', async () => {
    const wrapper = mount(ConfigFormRenderer as Component, {
      props: {
        fields: [defineField<SurfaceValues>({
          component: Input,
          field: 'name',
          id: 'name-node',
          props: { tabindex: 3 },
        })],
        mode: 'preview',
        model: createConfigFormModel(shallowRef({ name: 'Ada' })),
      },
    })
    const input = wrapper.get('[data-testid="surface-input"]')
    expect(input.attributes('tabindex')).toBe('3')

    await wrapper.setProps({ mode: 'design' })
    expect(input.attributes('tabindex')).toBe('-1')

    await wrapper.setProps({ mode: 'preview' })
    expect(input.attributes('tabindex')).toBe('3')
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
        model: createConfigFormModel(shallowRef({ name: 'Ada' })),
      },
    })

    const cell = wrapper.get('[data-config-node-id="name-node"]')
    expect(cell.classes()).toEqual(expect.arrayContaining(['mx-config-form__cell', 'editor-node']))
    expect(cell.attributes('aria-label')).toBe('Select name')
    expect(cell.attributes('data-config-node-id')).toBe('name-node')
  })

  it('blocks control side effects directly in design mode', async () => {
    const wrapper = mount(ConfigFormRenderer as Component, {
      props: {
        fields: [defineField<SurfaceValues>({ component: Input, field: 'name', id: 'name-node' })],
        mode: 'design',
        model: createConfigFormModel(shallowRef({ name: 'Ada' })),
      },
    })

    await wrapper.get('[data-testid="surface-input"]').setValue('Grace')
    expect(wrapper.emitted('change')).toBeUndefined()
  })

  it('merges an external reaction projection into real field props and states', async () => {
    const wrapper = mount(ConfigFormRenderer as Component, {
      props: {
        fields: [defineField<SurfaceValues>({ component: Input, field: 'name', id: 'name-node' })],
        model: createConfigFormModel(shallowRef({ name: 'Ada' })),
        reactionProjection: {
          values: { name: 'Ada' },
          props: { name: { placeholder: 'Generated by reaction' } },
          states: { name: { disabled: true, required: true } },
          validate: [],
        },
      },
    })

    const input = wrapper.get('[data-testid="surface-input"]')
    expect(input.attributes()).toMatchObject({
      'aria-required': 'true',
      'disabled': '',
      'placeholder': 'Generated by reaction',
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
