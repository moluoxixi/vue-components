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
    disabled: { type: Boolean, default: false },
  },
  emits: ['update:modelValue'],
  setup(props, { attrs }) {
    return () => h('input', {
      ...attrs,
      value: props.modelValue,
      placeholder: props.placeholder,
      readonly: props.readonly,
      disabled: props.disabled,
    })
  },
})

const ContainerStub = defineComponent({
  setup(_, { slots }) {
    return () => h('section', { class: 'container-stub' }, slots.default?.())
  },
})

const DesignerContainerStub = defineComponent({
  props: {
    designerNode: { type: Object, required: true },
  },
  setup(_, { slots }) {
    return () => h('section', { class: 'designer-container-stub' }, slots.default?.())
  },
})

const materials: DesignerMaterialDefinition[] = [
  {
    key: 'test.input',
    version: 1,
    kind: 'field',
    title: 'Input',
    category: 'Fields',
    runtime: {
      component: InputStub,
      readonlyRender: ({ value }) => `readonly:${String(value ?? '')}`,
    },
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
  {
    key: 'test.vnode',
    version: 1,
    kind: 'field',
    title: 'VNode field',
    category: 'Fields',
    runtime: {
      component: InputStub,
      readonlyRender: ({ value }) => h('strong', { 'data-testid': 'readonly-vnode' }, String(value ?? '')),
    },
    setters: [],
    createNode: ({ id, field = 'vnode' }) => ({
      id,
      kind: 'field',
      material: 'test.vnode',
      field,
    }),
  },
  {
    key: 'test.designer-container',
    version: 1,
    kind: 'container',
    title: 'Designer container',
    category: 'Layout',
    runtime: {
      component: ContainerStub,
      designerComponent: DesignerContainerStub,
    },
    setters: [],
    slots: [{ name: 'default', title: 'Content' }],
    createNode: ({ id }) => ({
      id,
      kind: 'container',
      material: 'test.designer-container',
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
        model: { name: 'Stale mock value' },
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
    const label = wrapper.get('.mx-config-form-designer__node-preview-label')
    const input = wrapper.get('input')
    expect(wrapper.classes()).toContain('mx-config-form__field')
    expect(label.element.tagName).toBe('LABEL')
    expect(label.text()).toBe('Name')
    expect(label.classes()).toContain('mx-config-form__label')
    expect(label.attributes('aria-hidden')).toBeUndefined()
    expect(label.attributes('for')).toBe(input.attributes('id'))
    expect(input.attributes('value')).toBe('Stale mock value')
    expect(wrapper.find('input').attributes('placeholder')).toBe('Your name')
    const control = wrapper.get('.mx-config-form-designer__node-preview-control')
    expect(control.classes()).toContain('mx-config-form__control')
    expect(control.attributes('inert')).toBe('')
    expect(control.attributes('aria-hidden')).toBe('true')
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

  it('maps form readonly state to a readonly value renderer', () => {
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
    expect(wrapper.get('.mx-config-form-designer__node-preview-readonly').classes()).toContain('mx-config-form__readonly')
    expect(wrapper.get('.mx-config-form-designer__node-preview-readonly').text()).toBe('readonly:')
    expect(wrapper.find('input').exists()).toBe(false)
  })

  it('renders custom readonly VNode content instead of stringifying it', () => {
    const wrapper = mount(DesignerNodePreview, {
      props: {
        readonly: true,
        registry,
        node: {
          id: 'status',
          kind: 'field',
          material: 'test.vnode',
          field: 'status',
          defaultValue: 'Ready',
        },
      },
    })

    expect(wrapper.get('[data-testid="readonly-vnode"]').text()).toBe('Ready')
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

  it('uses a designer container override without changing the runtime component contract', () => {
    const node = {
      id: 'tabs',
      kind: 'container' as const,
      material: 'test.designer-container',
      slots: { default: [] },
    }
    const wrapper = mount(DesignerNodePreview, {
      props: { registry, node },
      slots: {
        default: () => h('span', { 'data-testid': 'designer-nested-content' }, 'Nested content'),
      },
    })

    const designerContainer = wrapper.getComponent(DesignerContainerStub)
    expect(designerContainer.props('designerNode')).toEqual(node)
    expect(wrapper.findComponent(ContainerStub).exists()).toBe(false)
    expect(wrapper.get('[data-testid="designer-nested-content"]').text()).toBe('Nested content')
  })

  it('updates an isolated model and derives required, disabled, and readonly states', async () => {
    const wrapper = mount(DesignerNodePreview, {
      props: {
        model: { enabled: true, name: 'Ada' },
        registry,
        node: {
          id: 'name',
          kind: 'field',
          material: 'test.input',
          field: 'name',
          label: 'Name',
          conditions: {
            required: { kind: 'literal', value: true },
            disabled: {
              kind: 'compare',
              operator: 'eq',
              left: { kind: 'field', field: 'enabled' },
              right: { kind: 'literal', value: true },
            },
            readonly: { kind: 'literal', value: true },
          },
        },
      },
    })

    expect(wrapper.get('.mx-config-form-designer__node-preview-readonly').text()).toBe('readonly:Ada')
    expect(wrapper.attributes('data-required')).toBe('true')
    expect(wrapper.get('.mx-config-form-designer__node-preview-control').attributes('inert')).toBe('')
    expect(wrapper.find('input').exists()).toBe(false)
    expect(wrapper.emitted('updateField')).toBeUndefined()
  })
})
