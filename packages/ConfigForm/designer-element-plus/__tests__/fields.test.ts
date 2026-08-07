import { mount } from '@vue/test-utils'
import { ElOption, ElSelect } from 'element-plus'
import { describe, expect, it } from 'vitest'
import ElementSelectField from '../src/components/ElementSelectField.vue'

describe('element plus designer fields', () => {
  it('renders JSON options and forwards the Element Plus value event', async () => {
    const wrapper = mount(ElementSelectField, {
      props: {
        modelValue: 'a',
        options: [
          { label: 'Option A', value: 'a' },
          { label: 'Option B', value: 'b', disabled: true },
        ],
      },
    })

    expect(wrapper.findAllComponents(ElOption)).toHaveLength(2)
    wrapper.getComponent(ElSelect).vm.$emit('update:modelValue', 'b')
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('update:modelValue')).toEqual([['b']])
  })
})
