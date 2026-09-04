// @vitest-environment happy-dom

import type { VueWrapper } from '@vue/test-utils'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { useWorkbenchControllerLifecycle } from '../use-workbench-controller-lifecycle'

let wrapper: VueWrapper | undefined

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.restoreAllMocks()
})

describe('workbench controller lifecycle', () => {
  it('owns browser listeners, initialization, unload protection, and teardown', async () => {
    const calls: string[] = []
    const handleVisibilityHidden = vi.fn(async () => {})
    const dispose = vi.fn(async () => {
      calls.push('dispose')
    })
    const setInitialized = vi.fn()
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')

    wrapper = mount(defineComponent({
      setup() {
        useWorkbenchControllerLifecycle({
          beforeDispose: () => calls.push('beforeDispose'),
          beforeUnloadRequired: () => true,
          dispose,
          handleVisibilityHidden,
          initialize: async () => {
            calls.push('initialize')
          },
          notify: vi.fn(),
          setInitialized,
        })
        return () => h('div')
      },
    }))
    await flushPromises()

    expect(calls).toEqual(['initialize'])
    expect(setInitialized).toHaveBeenCalledWith(true)
    document.dispatchEvent(new Event('visibilitychange'))
    globalThis.dispatchEvent(new Event('pagehide'))
    expect(handleVisibilityHidden).toHaveBeenCalledTimes(2)

    const beforeUnload = new Event('beforeunload', { cancelable: true })
    globalThis.dispatchEvent(beforeUnload)
    expect(beforeUnload.defaultPrevented).toBe(true)

    wrapper.unmount()
    wrapper = undefined
    await vi.waitFor(() => expect(dispose).toHaveBeenCalledOnce())
    expect(calls).toEqual(['initialize', 'beforeDispose', 'dispose'])

    globalThis.dispatchEvent(new Event('pagehide'))
    expect(handleVisibilityHidden).toHaveBeenCalledTimes(2)
  })
})
