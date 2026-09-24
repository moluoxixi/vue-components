// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, isReactive, reactive } from 'vue'
import { useRuntimeHostProtocol } from '../composables/use-runtime-host-protocol'

describe('runtime host model boundary', () => {
  it('keeps cloned model values plain instead of deep-proxying them', () => {
    let protocol: ReturnType<typeof useRuntimeHostProtocol> | undefined
    const wrapper = mount(defineComponent({
      setup() {
        protocol = useRuntimeHostProtocol()
        return () => h('div')
      },
    }))
    const source = reactive({ profile: { name: 'Ada' } })

    protocol!.updateModel(source)

    expect(protocol!.modelValue.value).toEqual({ profile: { name: 'Ada' } })
    expect(isReactive(protocol!.modelValue.value)).toBe(false)
    expect(isReactive(protocol!.modelValue.value.profile)).toBe(false)
    source.profile.name = 'Grace'
    expect(protocol!.modelValue.value).toEqual({ profile: { name: 'Ada' } })

    wrapper.unmount()
  })
})
