import type { ElementPlusOptionSource } from '../index'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import {
  createElementPlusOptionResolverContext,
  ELEMENT_PLUS_OPTION_RESOLVER_KEY,
  useElementPlusResolvedOptions,
} from '../src/options'

describe('useElementPlusResolvedOptions', () => {
  it('uses the Element Plus resolver injection and writes provider lifecycle state', async () => {
    const source = ref<ElementPlusOptionSource>({ kind: 'provider', key: 'projects' })
    const provider = vi.fn(async () => [{ label: 'Project A', value: 'a' }])
    const context = createElementPlusOptionResolverContext({ providers: { projects: provider } })
    let state!: ReturnType<typeof useElementPlusResolvedOptions>
    const wrapper = mount(defineComponent({
      setup() {
        state = useElementPlusResolvedOptions(source, [{ label: 'Static', value: 'static' }])
        return () => h('div')
      },
    }), {
      global: { provide: { [ELEMENT_PLUS_OPTION_RESOLVER_KEY as symbol]: context } },
    })

    expect(state.value).toEqual({
      status: 'loading',
      options: [{ label: 'Static', value: 'static' }],
    })
    await flushPromises()
    expect(state.value).toEqual({
      status: 'ready',
      options: [{ label: 'Project A', value: 'a' }],
    })
    expect(context.readState(source.value)).toEqual(state.value)
    expect(provider).toHaveBeenCalledWith(expect.objectContaining({ key: 'projects' }))

    wrapper.unmount()
  })
})
