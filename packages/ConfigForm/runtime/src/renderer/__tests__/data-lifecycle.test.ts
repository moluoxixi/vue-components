import type { ConfigFormDataSourceHost, ConfigFormFlowHttpRequestOutput } from '@moluoxixi/config-form-core'
import type { ConfigFormPageRuntimeDataSourceStateChange } from '../../runtime'
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { binding, Control, deferred, fieldRef, fixture, flow, plan, response, source, variableRef } from './data-runtime-fixture'

const address = { nodeId: 'choice', scope: [] }
const loadKey = `load:${JSON.stringify(['choices', []])}`

function observeDataSourceStates() {
  const onState = vi.fn<(change: ConfigFormPageRuntimeDataSourceStateChange) => void>()
  const states = (key: string) => onState.mock.calls.filter(([change]) => change.consumerKey === key).map(([change]) => change.state)
  return { onState, states }
}

describe('renderer data lifecycle', () => {
  it('retries failed option consumers through the same named source and updates cached options', async () => {
    const request = vi.fn(async () => response([], false))
    const { api } = await fixture({ props: { dataSourceHost: { request } }, plan: plan({
      runtime: { variables: [], dataSources: [source()] },
      optionBindings: [binding()],
    }) })
    expect(api.getOptionState(address)?.status).toBe('error')
    request.mockResolvedValue(response(['retry']))
    await api.loadDataSource('choices', { force: true })
    expect(api.getOptionState(address)?.options).toEqual(['retry'])
    expect(api.getOptionState(address)?.status).toBe('success')
    await api.loadDataSource('choices')
    expect(request).toHaveBeenCalledTimes(2)
    expect(api.getOptionState(address)?.options).toEqual(['retry'])
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

  it('re-evaluates declared variable dependencies only after a successful Flow commit', async () => {
    const request = vi.fn(async () => response([]))
    const { api, run } = await fixture({ props: { dataSourceHost: { request } }, plan: plan({
      runtime: {
        variables: [{ id: 'v', name: 'V', initialValue: 0 }],
        dataSources: [source({ dependencies: [variableRef('v')] })],
      },
      optionBindings: [binding()],
      flows: [flow([{ ref: 'builtin.variable.set', input: { variableId: 'v', value: 1 } }])],
    }) })
    await run()
    expect(api.getVariables().v).toBe(1)
    expect(request).toHaveBeenCalledTimes(2)
    await run()
    expect(request).toHaveBeenCalledTimes(2)
    await api.resetFields()
    expect(api.getVariables().v).toBe(0)
    expect(request).toHaveBeenCalledTimes(3)
  })

  it('allows explicit source loads during initialize after variables are ready', async () => {
    const request = vi.fn<NonNullable<ConfigFormDataSourceHost['request']>>(async input => response([input.query]))
    const { api, wrapper } = await fixture({ props: { dataSourceHost: { request } }, plan: plan({
      runtime: { variables: [{ id: 'v', name: 'V', initialValue: fieldRef('country') }], dataSources: [source({ request: { url: '/choices', query: { q: variableRef('v') } } })] },
      flows: [flow([{ ref: 'builtin.dataSource.load', input: { dataSourceId: 'choices' } }], { kind: 'form.initialize' })],
      optionBindings: [binding()],
    }) })
    expect(request).toHaveBeenCalledTimes(1)
    expect(api.getOptionState(address)?.options).toEqual([{ q: 'a' }])
    expect(wrapper.emitted('flowError')).toBeUndefined()
  })

  it('settles consumer cancellation even when a host does not settle and suppresses late publication', async () => {
    const wait = deferred()
    const request = vi.fn(() => wait.promise)
    const { api, wrapper } = await fixture({ props: { dataSourceHost: { request } }, plan: plan({ runtime: { variables: [], dataSources: [source()] } }) })
    const cancellation = new AbortController()
    const loading = api.loadDataSource('choices', { signal: cancellation.signal })
    cancellation.abort('cancelled')
    await expect(loading).resolves.toMatchObject({ status: 'error', error: { code: 'CONFIG_FORM_DATA_SOURCE_ABORTED' } })
    expect(request.mock.calls[0]).toBeDefined()
    const events = wrapper.emitted('dataSourceStateChange')!.length
    wait.resolve(response(['late']))
    await flushPromises()
    expect(wrapper.emitted('dataSourceStateChange')!.length).toBe(events)
    expect(api.getDataSourceState('choices').status).toBe('error')
  })

  it.each(['pending', 'pre-aborted'] as const)('keeps a %s explicit consumer cancelled while shared options finish and permits a cached retry', async (timing) => {
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
    if (timing === 'pre-aborted')
      cancellation.abort('already cancelled')
    const loading = api.loadDataSource('choices', { params, signal: cancellation.signal })
    if (timing === 'pending')
      cancellation.abort('cancelled')
    const cancelled = await loading
    expect(cancelled).toMatchObject({ status: 'error', error: { code: 'CONFIG_FORM_DATA_SOURCE_ABORTED' } })
    expect(api.getDataSourceState('choices')).toEqual(cancelled)
    const cancelledStatuses = timing === 'pending' ? ['loading', 'error'] : ['error']
    expect(states(loadKey).map(state => state.status)).toEqual(cancelledStatuses)
    expect(states(optionKey).map(state => state.status)).toEqual(['loading'])
    expect(onState).toHaveBeenCalledTimes(cancelledStatuses.length + 1)
    expect(request).toHaveBeenCalledTimes(1)
    expect(request.mock.calls[0]![1].aborted).toBe(false)

    wait.resolve(response(['shared']))
    await flushPromises()
    expect(states(loadKey).map(state => state.status)).toEqual(cancelledStatuses)
    expect(api.getDataSourceState('choices')).toEqual(cancelled)
    expect(api.getOptionState(address)).toMatchObject({ status: 'success', options: ['shared'] })
    expect(states(optionKey).map(state => state.status)).toEqual(['loading', 'success'])
    expect(onState).toHaveBeenCalledTimes(cancelledStatuses.length + 2)

    await expect(api.loadDataSource('choices', { params })).resolves.toMatchObject({ status: 'success', data: ['shared'] })
    expect(api.getDataSourceState('choices')).toMatchObject({ status: 'success', data: ['shared'] })
    expect(states(loadKey).map(state => state.status)).toEqual([...cancelledStatuses, 'success'])
    expect(onState).toHaveBeenCalledTimes(cancelledStatuses.length + 3)
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('does not start a request or publish loading for a pre-aborted first load and allows a fresh retry', async () => {
    const request = vi.fn(async () => response(['retry']))
    const { onState, states } = observeDataSourceStates()
    const { api } = await fixture({ props: { dataSourceHost: { request }, onDataSourceStateChange: onState }, plan: plan({
      runtime: { variables: [], dataSources: [source()] },
    }) })
    const cancellation = new AbortController()
    cancellation.abort('already cancelled')
    await expect(api.loadDataSource('choices', { signal: cancellation.signal })).resolves.toMatchObject({ status: 'error', error: { code: 'CONFIG_FORM_DATA_SOURCE_ABORTED' } })
    expect(request).not.toHaveBeenCalled()
    expect(states(loadKey).map(state => state.status)).toEqual(['error'])
    expect(onState).toHaveBeenCalledTimes(1)

    await expect(api.loadDataSource('choices')).resolves.toMatchObject({ status: 'success', data: ['retry'] })
    expect(states(loadKey).map(state => state.status)).toEqual(['error', 'loading', 'success'])
    expect(onState).toHaveBeenCalledTimes(3)
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('keeps an immediate retry attached to the pending shared request after the cancelled generation settles', async () => {
    const wait = deferred()
    const request = vi.fn<NonNullable<ConfigFormDataSourceHost['request']>>(() => wait.promise)
    const { onState, states } = observeDataSourceStates()
    const { api } = await fixture({ props: { dataSourceHost: { request }, onDataSourceStateChange: onState }, plan: plan({
      runtime: { variables: [], dataSources: [source()] },
      optionBindings: [binding()],
    }) })
    const cancellation = new AbortController()
    const first = api.loadDataSource('choices', { signal: cancellation.signal })
    cancellation.abort('cancelled')
    const retry = api.loadDataSource('choices')
    await expect(first).resolves.toMatchObject({ status: 'error', error: { code: 'CONFIG_FORM_DATA_SOURCE_ABORTED' } })
    expect(states(loadKey).map(state => state.status)).toEqual(['loading', 'error', 'loading'])
    expect(onState).toHaveBeenCalledTimes(4)
    expect(request).toHaveBeenCalledTimes(1)
    expect(request.mock.calls[0]![1].aborted).toBe(false)
    wait.resolve(response(['retry']))
    await expect(retry).resolves.toMatchObject({ status: 'success', data: ['retry'] })
    await flushPromises()
    expect(states(loadKey).map(state => state.status)).toEqual(['loading', 'error', 'loading', 'success'])
    expect(onState).toHaveBeenCalledTimes(6)
    expect(api.getOptionState(address)).toMatchObject({ status: 'success', options: ['retry'] })
  })

  it('does not publish an older shared result into a newer explicit generation with different parameters', async () => {
    const waits = [deferred(), deferred()]
    const request = vi.fn<NonNullable<ConfigFormDataSourceHost['request']>>()
      .mockImplementationOnce(() => waits[0]!.promise)
      .mockImplementationOnce(() => waits[1]!.promise)
    const { onState, states } = observeDataSourceStates()
    const { api } = await fixture({ props: { dataSourceHost: { request }, onDataSourceStateChange: onState }, plan: plan({
      runtime: { variables: [], dataSources: [source()] },
      optionBindings: [binding('choice', { q: 'old' })],
    }) })
    const cancellation = new AbortController()
    const first = api.loadDataSource('choices', { params: { q: 'old' }, signal: cancellation.signal })
    const latest = api.loadDataSource('choices', { params: { q: 'new' } })
    cancellation.abort('old generation')
    await expect(first).resolves.toMatchObject({ status: 'error', error: { code: 'CONFIG_FORM_DATA_SOURCE_ABORTED' } })
    expect(request).toHaveBeenCalledTimes(2)
    expect(request.mock.calls.map(([, signal]) => signal.aborted)).toEqual([false, false])
    waits[0]!.resolve(response(['old']))
    await flushPromises()
    expect(states(loadKey).map(state => state.status)).toEqual(['loading', 'loading'])
    expect(api.getDataSourceState('choices').status).toBe('loading')
    expect(api.getOptionState(address)?.options).toEqual(['old'])
    expect(onState).toHaveBeenCalledTimes(4)
    waits[1]!.resolve(response(['new']))
    await expect(latest).resolves.toMatchObject({ status: 'success', data: ['new'] })
    await flushPromises()
    expect(states(loadKey).map(state => state.status)).toEqual(['loading', 'loading', 'success'])
    expect(onState).toHaveBeenCalledTimes(5)
    expect(api.getDataSourceState('choices')).toMatchObject({ status: 'success', data: ['new'] })
  })

  it.each(['reset', 'plan replacement', 'unmount'] as const)('isolates shared explicit consumers from late results after %s', async (operation) => {
    const waits = [deferred(), deferred()]
    const request = vi.fn<NonNullable<ConfigFormDataSourceHost['request']>>()
      .mockImplementationOnce(() => waits[0]!.promise)
      .mockImplementationOnce(() => waits[1]!.promise)
    const { onState, states } = observeDataSourceStates()
    const runtimePlan = plan({ runtime: { variables: [], dataSources: [source()] }, optionBindings: [binding()] })
    const { api, wrapper } = await fixture({ props: { dataSourceHost: { request }, onDataSourceStateChange: onState }, plan: runtimePlan })
    const cancellation = new AbortController()
    const first = api.loadDataSource('choices', { signal: cancellation.signal })
    if (operation === 'reset')
      await expect(api.resetFields()).resolves.toBe(true)
    else if (operation === 'plan replacement')
      await wrapper.setProps({ plan: structuredClone(runtimePlan) })
    else
      wrapper.unmount()
    await flushPromises()
    const retry = operation === 'unmount' ? undefined : api.loadDataSource('choices')
    cancellation.abort('old generation')
    await expect(first).resolves.toMatchObject({ status: 'error', error: { code: 'CONFIG_FORM_DATA_SOURCE_ABORTED' } })
    expect(request.mock.calls[0]![1].aborted).toBe(true)
    const count = operation === 'unmount' ? 2 : 4
    expect(onState).toHaveBeenCalledTimes(count)
    waits[0]!.resolve(response(['late']))
    await flushPromises()
    expect(onState).toHaveBeenCalledTimes(count)
    if (operation === 'unmount') {
      expect(request).toHaveBeenCalledTimes(1)
      expect(api.getOptionState(address)).toBeUndefined()
      expect(api.getDataSourceState('choices').status).toBe('idle')
      return
    }
    expect(request).toHaveBeenCalledTimes(2)
    expect(request.mock.calls[1]![1].aborted).toBe(false)
    expect(api.getOptionState(address)?.status).toBe('loading')
    waits[1]!.resolve(response(['current']))
    await expect(retry).resolves.toMatchObject({ status: 'success', data: ['current'] })
    await flushPromises()
    expect(api.getOptionState(address)).toMatchObject({ status: 'success', options: ['current'] })
    expect(api.getDataSourceState('choices')).toMatchObject({ status: 'success', data: ['current'] })
    expect(states(loadKey).map(state => state.status)).toEqual(['loading', 'loading', 'success'])
    expect(onState).toHaveBeenCalledTimes(6)
  })

  it('enforces the Core timeout and bounds option consumers with an explicit diagnostic', async () => {
    const never = deferred()
    const request = vi.fn(() => never.promise)
    const runtimePlan = plan({ runtime: { variables: [], dataSources: [source({ timeoutMs: 10 })] } })
    const { api } = await fixture({ props: { dataSourceHost: { request } }, plan: runtimePlan })
    await expect(api.loadDataSource('choices')).resolves.toMatchObject({ status: 'error', error: { code: 'CONFIG_FORM_DATA_SOURCE_TIMEOUT' } })
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
    expect(bounded.wrapper.emitted('flowError')?.some(([error]) => (error as { code: string }).code === 'CONFIG_FORM_DATA_CONSUMER_LIMIT')).toBe(true)
    never.resolve(response([]))
  })

  it.each(['validate', 'submit', 'reset'] as const)('executes mounted form.%s without reentry', async (kind) => {
    const resetRead = vi.fn()
    const { api, run, values, wrapper } = await fixture({
      actions: { resetRead },
      plan: plan({
        runtime: { variables: [{ id: 'v', name: 'V', initialValue: 2 }], dataSources: [] },
        flows: [flow([{ ref: `builtin.form.${kind}` }]), flow([{ ref: 'resetRead', input: variableRef('v') }], { kind: 'form.reset' })],
      }),
    })
    api.setValue('result', 9)
    await run()
    if (kind === 'submit')
      expect(wrapper.emitted('submit')).toHaveLength(1)
    if (kind === 'reset') {
      expect(values.value.result).toBe(0)
      expect(resetRead.mock.calls[0]?.[0]).toBe(2)
    }
    if (kind === 'validate')
      expect(wrapper.emitted('flowResult')?.at(-1)?.[0]).toMatchObject({ status: 'committed' })
    expect(wrapper.emitted('flowError')).toBeUndefined()
  })

  it('rejects form.validate reentry from validationSuccess instead of deadlocking', async () => {
    const { run, wrapper } = await fixture({ plan: plan({ flows: [
      flow([{ ref: 'builtin.form.validate' }]),
      flow([{ ref: 'builtin.form.validate' }], { kind: 'form.validationSuccess' }),
    ] }) })
    await run()
    expect(JSON.stringify(wrapper.emitted('flowResult'))).toContain('FLOW_ACTION_REENTRY')
  })

  it('cancels a pending builtin submit on reset without notifying the business host', async () => {
    const wait = deferred<ConfigFormFlowHttpRequestOutput>()
    const { api, run, wrapper } = await fixture({
      actions: { wait: () => wait.promise },
      plan: plan({ flows: [flow([{ ref: 'builtin.form.submit' }]), flow([{ ref: 'wait' }], { kind: 'form.beforeSubmit' })] }),
    })
    await run()
    await api.resetFields()
    wait.resolve(response([]))
    await flushPromises()
    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('resets during an unfinished initialize load and starts option consumers with recovered variables', async () => {
    const wait = deferred()
    const request = vi.fn<NonNullable<ConfigFormDataSourceHost['request']>>()
      .mockImplementationOnce(() => wait.promise)
      .mockResolvedValue(response(['reset']))
    const { api } = await fixture({ props: { dataSourceHost: { request } }, plan: plan({
      runtime: { variables: [{ id: 'v', name: 'V', initialValue: fieldRef('result') }], dataSources: [source()] },
      flows: [flow([{ ref: 'builtin.dataSource.load', input: { dataSourceId: 'choices' } }], { kind: 'form.initialize' })],
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
