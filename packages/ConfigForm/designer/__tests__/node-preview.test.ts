import type { DesignerMaterialDefinition } from '../index'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { createDesignerRegistry } from '../index'
import DesignerNodePreview from '../src/components/DesignerNodePreview.vue'

const InputStub = defineComponent({
  props: {
    modelValue: { type: String, default: '' },
    placeholder: { type: String, default: '' },
    readonly: { type: Boolean, default: false },
  },
  emits: ['update:modelValue'],
  setup(props) {
    return () => h('input', {
      value: props.modelValue,
      placeholder: props.placeholder,
      readonly: props.readonly,
    })
  },
})

const ContainerStub = defineComponent({
  setup(_, { slots }) {
    return () => h('section', { class: 'container-stub' }, slots.default?.())
  },
})

const materials: DesignerMaterialDefinition[] = [
  {
    key: 'test.input',
    version: 1,
    kind: 'field',
    title: 'Input',
    category: 'Fields',
    runtime: { component: InputStub },
    setters: [],
    createNode: ({ id, field = 'input' }) => ({
      id,
      kind: 'field',
      material: 'test.input',
      field,
    }),
  },
  {
    key: 'test.container',
    version: 1,
    kind: 'container',
    title: 'Container',
    category: 'Layout',
    runtime: { component: ContainerStub },
    setters: [],
    slots: [{ name: 'default', title: 'Content' }],
    createNode: ({ id }) => ({
      id,
      kind: 'container',
      material: 'test.container',
      slots: { default: [] },
    }),
  },
]

const registry = createDesignerRegistry([{ name: 'test', materials }])

describe('designer node preview', () => {
  it('renders visible left-positioned labels and inert controls with a preview value', () => {
    const wrapper = mount(DesignerNodePreview, {
      props: {
        labelPosition: 'left',
        registry,
        node: {
          id: 'name',
          kind: 'field',
          material: 'test.input',
          field: 'name',
          label: 'Name',
          defaultValue: 'Ada',
          props: { placeholder: 'Your name' },
        },
      },
    })

    expect(wrapper.classes()).toEqual(expect.arrayContaining(['is-label-left', 'has-label']))
    expect(wrapper.find('.mx-config-form-designer__node-preview-label').text()).toBe('Name')
    expect(wrapper.find('.mx-config-form-designer__node-preview-label').attributes('aria-hidden')).toBeUndefined()
    expect(wrapper.find('input').attributes('value')).toBe('Ada')
    expect(wrapper.find('input').attributes('placeholder')).toBe('Your name')
    expect(wrapper.find('.mx-config-form-designer__node-preview-control').attributes('inert')).toBe('')
    expect(wrapper.find('.mx-config-form-designer__node-preview-control').attributes('aria-hidden')).toBe('true')
  })

  it('renders the same real field component with a top-positioned label', () => {
    const wrapper = mount(DesignerNodePreview, {
      props: {
        labelPosition: 'top',
        registry,
        node: {
          id: 'name',
          kind: 'field',
          material: 'test.input',
          field: 'name',
          label: 'Name',
        },
      },
    })

    expect(wrapper.classes()).toContain('is-label-top')
    expect(wrapper.find('input').exists()).toBe(true)
  })

  it('maps form readonly state to the real preview component', () => {
    const wrapper = mount(DesignerNodePreview, {
      props: {
        readonly: true,
        registry,
        node: {
          id: 'name',
          kind: 'field',
          material: 'test.input',
          field: 'name',
        },
      },
    })

    expect(wrapper.classes()).toContain('is-readonly')
    expect(wrapper.get('input').attributes('readonly')).toBeDefined()
  })

  it('passes nested content through a real container material', () => {
    const wrapper = mount(DesignerNodePreview, {
      props: {
        registry,
        node: {
          id: 'section',
          kind: 'container',
          material: 'test.container',
          slots: { default: [] },
        },
      },
      slots: {
        default: () => h('span', { 'data-testid': 'nested-content' }, 'Nested content'),
      },
    })

    expect(wrapper.find('.container-stub').exists()).toBe(true)
    expect(wrapper.find('[data-testid="nested-content"]').text()).toBe('Nested content')
    expect(wrapper.find('.mx-config-form-designer__node-preview-control').exists()).toBe(false)
  })
})
