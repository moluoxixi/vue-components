import type { ConfigFormDataSourceHost } from '@moluoxixi/config-form-core'
import type { ConfigFormPageRuntimeDataSourceStateChange } from '../../runtime'
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { binding, Control, deferred, fieldRef, fixture, plan, response, source } from './data-runtime-fixture'

const address = { nodeId: 'choice', scope: [] }
const loadKey = `load:${JSON.stringify(['choices', []])}`

function observeDataSourceStates() {
  const onState = vi.fn<(change: ConfigFormPageRuntimeDataSourceStateChange) => void>()
  const states = (key: string) => onState.mock.calls
    .filter(([change]) => change.consumerKey === key)
    .map(([change]) => change.state)
  return { onState, states }
}

describe('renderer data lifecycle', () => {
  it('retries failed option consumers through the same source and updates cached options', async () => {
    const request = vi.fn(async () => response([], false))
    const { api } = await fixture({ props: { dataSourceHost: { request } }, plan: plan({
      runtime: { variables: [], dataSources: [source()] },
      optionBindings: [binding()],
    }) })

    expect(api.getOptionState(address)?.status).toBe('error')
    request.mockResolvedValue(response(['retry']))
    await api.loadDataSource('choices', { force: true })
    expect(api.getOptionState(address)).toMatchObject({ status: 'success', options: ['retry'] })
    await api.loadDataSource('choices')
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('keeps different parameter bindings in the same scope independent', async () => {
    const requests = [deferred(), deferred(), deferred()]
    let index = 0
    const request = vi.fn<NonNullable<ConfigFormDataSourceHost['request']>>(() => requests[index++]!.promise)
    const { api } = await fixture({ props: { dataSourceHost: { request } }, plan: plan({
      runtime: { variables: [], dataSources: [source()] },
      optionBindings: [binding('choice', { q: fieldRef('country') }), binding('second', { q: fieldRef('second') })],
    }) })

    expect(request.mock.calls.map(([input]) => input.query)).toEqual([{ q: 'a' }, { q: 'b' }])
    api.setValue('country', 'c')
    expect(request.mock.calls[0]![1].aborted).toBe(true)
    expect(request.mock.calls[1]![1].aborted).toBe(false)
    requests[1]!.resolve(response(['B']))
    requests[2]!.resolve(response(['C']))
    requests[0]!.resolve(response(['late A']))
    await flushPromises()
    expect(api.getOptionState(address)?.options).toEqual(['C'])
    expect(api.getOptionState({ nodeId: 'second', scope: [] })?.options).toEqual(['B'])
  })

  it('settles explicit cancellation when a host never settles and suppresses late publication', async () => {
    const wait = deferred()
    const request = vi.fn(() => wait.promise)
    const { api, wrapper } = await fixture({ props: { dataSourceHost: { request } }, plan: plan({
      runtime: { variables: [], dataSources: [source()] },
    }) })
    const cancellation = new AbortController()
    const loading = api.loadDataSource('choices', { signal: cancellation.signal })
    cancellation.abort('cancelled')

    await expect(loading).resolves.toMatchObject({ status: 'error', error: { code: 'CONFIG_FORM_DATA_SOURCE_ABORTED' } })
    const events = wrapper.emitted('dataSourceStateChange')!.length
    wait.resolve(response(['late']))
    await flushPromises()
    expect(wrapper.emitted('dataSourceStateChange')!.length).toBe(events)
    expect(api.getDataSourceState('choices').status).toBe('error')
  })

  it('keeps a cancelled explicit consumer isolated while a shared option request completes', async () => {
    const wait = deferred()
    const request = vi.fn<NonNullable<ConfigFormDataSourceHost['request']>>(() => wait.promise)
    const { onState, states } = observeDataSourceStates()
    const params = { q: 'shared' }
    const { api } = await fixture({ props: { dataSourceHost: { request }, onDataSourceStateChange: onState }, plan: plan({
      runtime: { variables: [], dataSources: [source()] },
      optionBindings: [binding('choice', params)],
    }) })
    const optionKey = `option:${api.getInstanceKey(address)}`
    const cancellation = new AbortController()
    const loading = api.loadDataSource('choices', { params, signal: cancellation.signal })
    cancellation.abort('cancelled')

    await expect(loading).resolves.toMatchObject({ status: 'error', error: { code: 'CONFIG_FORM_DATA_SOURCE_ABORTED' } })
    expect(request.mock.calls[0]![1].aborted).toBe(false)
    wait.resolve(response(['shared']))
    await flushPromises()
    expect(states(loadKey).map(state => state.status)).toEqual(['loading', 'error'])
    expect(states(optionKey).map(state => state.status)).toEqual(['loading', 'success'])
    expect(api.getOptionState(address)).toMatchObject({ status: 'success', options: ['shared'] })
  })

  it('does not publish an older shared result into a newer explicit generation', async () => {
    const waits = [deferred(), deferred()]
    const request = vi.fn<NonNullable<ConfigFormDataSourceHost['request']>>()
      .mockImplementationOnce(() => waits[0]!.promise)
      .mockImplementationOnce(() => waits[1]!.promise)
    const { api } = await fixture({ props: { dataSourceHost: { request } }, plan: plan({
      runtime: { variables: [], dataSources: [source()] },
      optionBindings: [binding('choice', { q: 'old' })],
    }) })
    const cancellation = new AbortController()
    const first = api.loadDataSource('choices', { params: { q: 'old' }, signal: cancellation.signal })
    const latest = api.loadDataSource('choices', { params: { q: 'new' } })
    cancellation.abort('old generation')

    await expect(first).resolves.toMatchObject({ status: 'error', error: { code: 'CONFIG_FORM_DATA_SOURCE_ABORTED' } })
    waits[0]!.resolve(response(['old']))
    await flushPromises()
    expect(api.getDataSourceState('choices').status).toBe('loading')
    waits[1]!.resolve(response(['new']))
    await expect(latest).resolves.toMatchObject({ status: 'success', data: ['new'] })
    expect(api.getDataSourceState('choices')).toMatchObject({ status: 'success', data: ['new'] })
  })

  it('enforces timeout and reports the bounded consumer error through data state', async () => {
    const never = deferred()
    const request = vi.fn(() => never.promise)
    const { api } = await fixture({ props: { dataSourceHost: { request } }, plan: plan({
      runtime: { variables: [], dataSources: [source({ timeoutMs: 10 })] },
    }) })
    await expect(api.loadDataSource('choices')).resolves.toMatchObject({
      status: 'error',
      error: { code: 'CONFIG_FORM_DATA_SOURCE_TIMEOUT' },
    })

    const ids = Array.from({ length: 101 }, (_, index) => `field${index}`)
    const bounded = await fixture({
      values: Object.fromEntries(ids.map(id => [id, null])),
      props: { fields: ids.map(id => ({ id, field: id, component: Control })), dataSourceHost: { request: async () => response([]) } },
      plan: plan({
        runtime: { variables: [], dataSources: [source()] },
        valueSchema: { valueScopes: [], scopedFields: ids.map(id => ({ nodeId: id, field: id })) },
        optionBindings: ids.map(id => binding(id)),
      }),
    })
    expect(bounded.wrapper.emitted('dataSourceStateChange')?.some(([change]) =>
      (change as ConfigFormPageRuntimeDataSourceStateChange).state.error?.code === 'CONFIG_FORM_DATA_CONSUMER_LIMIT')).toBe(true)
    never.resolve(response([]))
  })

  it('resets an unfinished option load and starts a fresh consumer with restored variables', async () => {
    const wait = deferred()
    const request = vi.fn<NonNullable<ConfigFormDataSourceHost['request']>>()
      .mockImplementationOnce(() => wait.promise)
      .mockResolvedValue(response(['reset']))
    const { api } = await fixture({ props: { dataSourceHost: { request } }, plan: plan({
      runtime: { variables: [{ id: 'v', name: 'V', initialValue: fieldRef('result') }], dataSources: [source()] },
      optionBindings: [binding()],
    }) })

    api.setValue('result', 9)
    await expect(api.resetFields()).resolves.toBe(true)
    await flushPromises()
    expect(request.mock.calls[0]![1].aborted).toBe(true)
    expect(api.getVariables().v).toBe(0)
    expect(api.getOptionState(address)?.options).toEqual(['reset'])
    wait.resolve(response(['late initialize']))
    await flushPromises()
    expect(api.getOptionState(address)?.options).toEqual(['reset'])
  })
})
