import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, markRaw } from 'vue'
import ConfigForm from '../src/index.vue'
import { defineField } from '../src/models/field'
import { createFormRuntime } from '../src/runtime'

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
  },
  setup(props, { slots }) {
    return () => h('span', { 'data-role': props.role }, slots.default?.())
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
              props: { role: 'defined-slot-node' },
              slots: { default: '插槽节点' },
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

  it('throws when object slot nodes bypass defineField', () => {
    const field = defineField({
      component: SlotHost,
      field: 'choice',
      slots: {
        default: [
          {
            component: SlotLeaf,
            props: { role: 'raw-slot-node' },
            slots: { default: '原始插槽节点' },
          } as never,
        ],
      },
    })
    const runtime = createFormRuntime()

    expect(() => runtime.resolveNode(field, runtime.createResolveSnap({ errors: {}, values: {} })))
      .toThrow(/defineField/)
  })
})
