import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, reactive, ref } from 'vue'
import { useClipboardCopy } from '../composables'
import { useRequestOptionsComponent } from '../request/composables'

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
}

async function waitFor(assertion: () => boolean, timeout = 1000): Promise<void> {
  const start = Date.now()
  while (!assertion()) {
    if (Date.now() - start > timeout)
      throw new Error('waitFor: timed out before condition was met')
    await new Promise(resolve => setTimeout(resolve, 10))
  }
}

describe('public component composables', () => {
  it('exposes reactive request options, loading, refetch, and callbacks', async () => {
    const params = ref({ keyword: 'admin' })
    let resolveInitial!: () => void
    const query = vi.fn(async (input: { keyword: string }) => {
      if (input.keyword === 'admin')
        await new Promise<void>(resolve => resolveInitial = resolve)
      return [{ label: input.keyword, value: input.keyword }]
    })
    const loaded = vi.fn()
    const error = vi.fn()
    const props = reactive({
      cacheKey: 'public-options',
      enabled: true,
      params: params.value,
      query,
    })
    const emit = vi.fn((event: 'loaded' | 'error', value: unknown) => {
      if (event === 'loaded')
        loaded(value)
      else
        error(value)
    })
    let result!: ReturnType<typeof useRequestOptionsComponent>

    const wrapper = mount(defineComponent({
      setup() {
        result = useRequestOptionsComponent(props, emit as never, 'fallback-options')
        return () => h('div')
      },
    }), {
      global: {
        plugins: [[VueQueryPlugin, { queryClient: createQueryClient() }]],
      },
    })

    await waitFor(() => result.loading.value)
    resolveInitial()
    await waitFor(() => result.options.value[0]?.value === 'admin')
    expect(result.loading.value).toBe(false)
    expect(loaded).toHaveBeenCalledWith([{ label: 'admin', value: 'admin' }])

    props.params = { keyword: 'guest' }
    await waitFor(() => result.options.value[0]?.value === 'guest')
    const callsBeforeRefetch = query.mock.calls.length
    await result.refetch()
    expect(query).toHaveBeenCalledTimes(callsBeforeRefetch + 1)

    const failure = new Error('options failed')
    query.mockRejectedValueOnce(failure)
    await result.refetch()
    await waitFor(() => error.mock.calls.length === 1)
    expect(error).toHaveBeenCalledWith(failure)

    wrapper.unmount()
  })

  describe('useClipboardCopy', () => {
    const writeText = vi.fn<(text: string) => Promise<void>>()

    beforeEach(() => {
      vi.useFakeTimers()
      writeText.mockReset()
      writeText.mockResolvedValue()
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText },
      })
      Object.defineProperty(document, 'execCommand', {
        configurable: true,
        value: vi.fn(() => true),
      })
    })

    afterEach(() => {
      vi.useRealTimers()
      vi.restoreAllMocks()
    })

    it('tracks success, reset, failures, and clears its unmount timer', async () => {
      const onCopy = vi.fn()
      const onError = vi.fn()
      const text = ref('copy me')
      let result!: ReturnType<typeof useClipboardCopy>

      const wrapper = mount(defineComponent({
        setup() {
          result = useClipboardCopy({
            onCopy,
            onError,
            resetDelay: 1000,
            text,
          })
          return () => h('div')
        },
      }))

      await result.copy()
      expect(writeText).toHaveBeenCalledWith('copy me')
      expect(result.copied.value).toBe(true)
      expect(onCopy).toHaveBeenCalledWith('copy me')

      result.reset()
      expect(result.copied.value).toBe(false)
      expect(result.error.value).toBeNull()

      const failure = new Error('copy failed')
      writeText.mockRejectedValueOnce(failure)
      const execCommand = document.execCommand as unknown as ReturnType<typeof vi.fn>
      execCommand.mockReturnValue(false)
      await expect(result.copy('other value')).rejects.toBeInstanceOf(Error)
      expect(result.error.value).toBeInstanceOf(Error)
      expect(onError).toHaveBeenCalledTimes(1)

      execCommand.mockReturnValue(true)
      await result.copy('final value')
      wrapper.unmount()
      vi.advanceTimersByTime(1000)
      expect(result.copied.value).toBe(true)
    })

    it('does not schedule state updates after unmounting a pending copy', async () => {
      let resolveWrite!: () => void
      writeText.mockImplementationOnce(() => new Promise<void>(resolve => resolveWrite = resolve))
      const onCopy = vi.fn()
      let result!: ReturnType<typeof useClipboardCopy>

      const wrapper = mount(defineComponent({
        setup() {
          result = useClipboardCopy({ onCopy, resetDelay: 1000, text: 'pending value' })
          return () => h('div')
        },
      }))

      const pending = result.copy()
      expect(result.copying.value).toBe(true)
      wrapper.unmount()
      expect(result.copying.value).toBe(false)

      resolveWrite()
      await pending
      expect(result.copied.value).toBe(false)
      expect(onCopy).not.toHaveBeenCalled()
      expect(vi.getTimerCount()).toBe(0)
    })
  })
})
