import type {
  DesignerOptionProviderContext,
  DesignerOptionSource,
  DesignerResolvedOptionState,
} from '../src/options'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { useDesignerResolvedOptions } from '../src/options'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, reject, resolve }
}

describe('useDesignerResolvedOptions', () => {
  it('normalizes static and dictionary sources and reports missing sources', async () => {
    const source = ref<DesignerOptionSource>({ kind: 'static' })
    const fallback = ref([{ label: 'Fallback', value: 'fallback' }])
    const writeState = vi.fn()
    let state!: ReturnType<typeof useDesignerResolvedOptions>
    const wrapper = mount(defineComponent({
      setup() {
        state = useDesignerResolvedOptions(source, fallback, {
          dictionaries: {
            environments: [{ label: 'Production', value: 'production' }],
          },
          providers: {},
          writeState,
        })
        return () => h('div')
      },
    }))

    expect(state.value).toEqual({
      status: 'ready',
      options: [{ label: 'Fallback', value: 'fallback' }],
    })

    source.value = { kind: 'dictionary', key: 'environments' }
    await nextTick()
    expect(state.value).toEqual({
      status: 'ready',
      options: [{ label: 'Production', value: 'production' }],
    })
    expect(writeState).toHaveBeenLastCalledWith(source.value, state.value)

    source.value = { kind: 'dictionary', key: 'missing' }
    await nextTick()
    expect(state.value).toEqual({
      status: 'error',
      options: [{ label: 'Fallback', value: 'fallback' }],
      error: 'Unknown option dictionary: missing',
    })

    wrapper.unmount()
  })

  it('aborts superseded providers and keeps loading, ready, and error state coherent', async () => {
    const first = deferred<Array<{ label: string, value: string }>>()
    const second = deferred<Array<{ label: string, value: string }>>()
    const calls: DesignerOptionProviderContext[] = []
    const projects = vi.fn((context: DesignerOptionProviderContext) => {
      calls.push(context)
      return calls.length === 1 ? first.promise : second.promise
    })
    const broken = vi.fn(async () => {
      throw new Error('Provider failed')
    })
    const source = ref<DesignerOptionSource>({
      kind: 'provider',
      key: 'projects',
      params: { team: 'frontend' },
    })
    const states: DesignerResolvedOptionState[] = []
    let state!: ReturnType<typeof useDesignerResolvedOptions>
    const wrapper = mount(defineComponent({
      setup() {
        state = useDesignerResolvedOptions(source, [{ label: 'Fallback', value: 'fallback' }], {
          dictionaries: {},
          providers: { broken, projects },
          writeState: (_nextSource, nextState) => states.push(nextState),
        })
        return () => h('div')
      },
    }))

    expect(state.value).toEqual({
      status: 'loading',
      options: [{ label: 'Fallback', value: 'fallback' }],
    })
    expect(calls[0]).toMatchObject({ key: 'projects', params: { team: 'frontend' } })

    source.value = { kind: 'provider', key: 'projects', params: { team: 'platform' } }
    await nextTick()
    expect(calls[0]?.signal.aborted).toBe(true)
    expect(calls[1]?.signal.aborted).toBe(false)

    first.resolve([{ label: 'Stale', value: 'stale' }])
    await flushPromises()
    expect(state.value.status).toBe('loading')

    second.resolve([{ label: 'Platform', value: 'platform' }])
    await flushPromises()
    expect(state.value).toEqual({
      status: 'ready',
      options: [{ label: 'Platform', value: 'platform' }],
    })

    source.value = { kind: 'provider', key: 'broken' }
    await flushPromises()
    expect(state.value).toEqual({
      status: 'error',
      options: [{ label: 'Fallback', value: 'fallback' }],
      error: 'Provider failed',
    })
    expect(states.map(item => item.status)).toEqual([
      'loading',
      'loading',
      'ready',
      'loading',
      'error',
    ])

    wrapper.unmount()
  })
})
