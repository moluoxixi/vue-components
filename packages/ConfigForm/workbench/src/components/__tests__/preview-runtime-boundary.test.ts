// @vitest-environment happy-dom

import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import PreviewRuntimeBoundary from '../PreviewRuntimeBoundary.vue'

describe('preview runtime boundary', () => {
  it('shows runtime diagnostics and retries the renderer on the next revision', async () => {
    const shouldThrow = ref(true)
    const RuntimePreview = defineComponent(() => () => {
      if (shouldThrow.value)
        throw new Error('Registered preview failed')
      return h('span', 'Recovered preview')
    })
    const wrapper = mount(PreviewRuntimeBoundary, {
      props: { revision: 'page-1-r1' },
      slots: {
        default: () => h(RuntimePreview),
        fallback: () => h('span', 'Last valid preview'),
      },
    })

    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('Registered preview failed')
    expect(wrapper.text()).toContain('Last valid preview')

    shouldThrow.value = false
    await wrapper.setProps({ revision: 'page-1-r2' })
    await flushPromises()
    expect(wrapper.text()).toContain('Recovered preview')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.emitted('ready')?.at(-1)).toEqual(['page-1-r2'])
  })
})
