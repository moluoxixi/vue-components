import type { AntdVueOptionSource } from '../src/options'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import {
  ANTD_VUE_OPTION_RESOLVER_KEY,
  createAntdVueOptionResolverContext,
  useAntdVueResolvedOptions,
} from '../src/options'

describe('useAntdVueResolvedOptions', () => {
  it('uses the Ant Design Vue resolver injection and writes provider lifecycle state', async () => {
    const source = ref<AntdVueOptionSource>({ kind: 'provider', key: 'projects' })
    const provider = vi.fn(async () => [{ label: 'Project A', value: 'a' }])
    const context = createAntdVueOptionResolverContext({ providers: { projects: provider } })
    let state!: ReturnType<typeof useAntdVueResolvedOptions>
    const wrapper = mount(defineComponent({
      setup() {
        state = useAntdVueResolvedOptions(source, [{ label: 'Fallback', value: 'fallback' }])
        return () => h('div')
      },
    }), {
      global: { provide: { [ANTD_VUE_OPTION_RESOLVER_KEY as symbol]: context } },
    })

    expect(state.value).toEqual({
      status: 'loading',
      options: [{ label: 'Fallback', value: 'fallback' }],
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
