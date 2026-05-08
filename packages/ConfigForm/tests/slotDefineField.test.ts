import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, markRaw } from 'vue'
import ConfigForm from '../src/index.vue'
import { defineField } from '../src/utils/field'

const SlotHost = markRaw(defineComponent({
  name: 'SlotHost',
  setup(_props, { slots }) {
    return () => h('div', slots.default?.())
  },
}))

const SlotLeaf = markRaw(defineComponent({
  name: 'SlotLeaf',
  props: {
    role: String,
    text: String,
  },
  setup(props, { slots }) {
    return () => h('span', { 'data-role': props.role }, slots.default?.() ?? props.text)
  },
}))

describe('slot field configs', () => {
  it('renders component slot nodes created with defineField without field wrappers', () => {
    const fields = [
      defineField({
        component: SlotHost,
        field: 'choice',
        label: '选择',
        slots: {
          default: [
            defineField({
              component: SlotLeaf,
              props: { role: 'defined-slot-node', text: '插槽节点' },
            }),
          ],
        },
      }),
    ]

    const wrapper = mount(ConfigForm, {
      props: {
        fields,
        modelValue: {},
      },
    })

    expect(wrapper.find('[data-role="defined-slot-node"]').text()).toBe('插槽节点')
    expect(wrapper.findAll('.cf-field')).toHaveLength(1)
  })

  it('renders raw object slot nodes because ConfigForm processes all configs recursively', () => {
    const fields = [
      {
        component: SlotHost,
        field: 'choice',
        label: '选择',
        slots: {
          default: [
            {
              component: SlotLeaf,
              props: { role: 'raw-slot-node', text: '原始插槽节点' },
            },
          ],
        },
      },
    ]

    const wrapper = mount(ConfigForm, {
      props: {
        fields,
        modelValue: {},
      },
    })

    expect(wrapper.find('[data-role="raw-slot-node"]').text()).toBe('原始插槽节点')
    expect(wrapper.findAll('.cf-field')).toHaveLength(1)
  })
})
