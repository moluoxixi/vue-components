import type { ReadonlyAdapter } from '@/runtime'
import type { ConfigFormExpose } from '@/types'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, onMounted, onUnmounted } from 'vue'
import ConfigForm from '@/components/ConfigForm/index.vue'

describe('readonly field renderer identity', () => {
  it('updates readonly values without remounting the adapter subtree', async () => {
    const mounted = vi.fn()
    const unmounted = vi.fn()
    const ReadonlyValue = defineComponent({
      name: 'ReadonlyValue',
      props: {
        value: {
          required: true,
          type: String,
        },
      },
      setup(props) {
        onMounted(mounted)
        onUnmounted(unmounted)
        return () => h('span', { 'data-testid': 'readonly-value' }, props.value)
      },
    })
    const EditableInput = defineComponent({ name: 'DifferentInputName' })
    const adapter: ReadonlyAdapter = ({ value }) => h(ReadonlyValue, { value: String(value) })
    const wrapper = mount(ConfigForm, {
      props: {
        defaultValues: { name: 'Ada' },
        fields: [{
          component: 'StableReadonlyInput',
          field: 'name',
          readonly: true,
        }],
        runtime: {
          components: { StableReadonlyInput: EditableInput },
          readonlyAdapters: { StableReadonlyInput: adapter },
        },
      },
    })
    const api = wrapper.vm as unknown as ConfigFormExpose<Record<string, unknown>>

    expect(wrapper.get('[data-testid="readonly-value"]').text()).toBe('Ada')
    expect(mounted).toHaveBeenCalledTimes(1)

    api.setValue('name', 'Grace')
    await nextTick()

    expect(wrapper.get('[data-testid="readonly-value"]').text()).toBe('Grace')
    expect(mounted).toHaveBeenCalledTimes(1)
    expect(unmounted).not.toHaveBeenCalled()
  })

  it('hides stale field errors after a dynamic readonly transition', async () => {
    const wrapper = mount(ConfigForm, {
      props: {
        defaultValues: { locked: false, name: '' },
        fields: [
          {
            component: 'input',
            field: 'name',
            label: 'Name',
            readonly: values => values.locked === true,
            required: true,
          },
          {
            component: 'input',
            field: 'locked',
          },
        ],
      },
    })
    const api = wrapper.vm as unknown as ConfigFormExpose<Record<string, unknown>>

    await expect(api.validateField('name')).resolves.toBe(false)
    expect(wrapper.text()).toContain('必填')

    api.setValue('locked', true)
    await nextTick()

    expect(wrapper.text()).not.toContain('必填')
    expect(wrapper.text()).toContain('Name')
  })
})
