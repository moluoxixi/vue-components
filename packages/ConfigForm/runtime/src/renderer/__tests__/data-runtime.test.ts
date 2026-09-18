import type { ConfigFormDataSourceHost, ConfigFormDataSourceHttpRequestOutput, ConfigFormValueInput } from '@moluoxixi/config-form-core'
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { binding, Control, deferred, fieldRef, fixture, plan, response, source, variableRef } from './data-runtime-fixture'

const address = { nodeId: 'choice', scope: [] }

describe('renderer page variables and data sources', () => {
  it('initializes chained variables and restores their field-derived baseline on reset', async () => {
    const runtime = { dataSources: [], variables: [
      { id: 'last', name: 'Last', initialValue: variableRef('next') },
      { id: 'next', name: 'Next', initialValue: { $ref: { kind: 'expression', source: '$variables["first"] + 1' } } as ConfigFormValueInput },
      { id: 'first', name: 'First', initialValue: fieldRef('result') },
    ] }
    const { api, values } = await fixture({ plan: plan({ runtime }) })

    expect(api.getVariables()).toEqual({ first: 0, next: 1, last: 1 })
    const snapshot = api.getVariables() as Record<string, unknown>
    snapshot.last = 'changed'
    expect(api.getVariables().last).toBe(1)

    api.setValue('result', 100)
    await api.resetFields()

    expect(values.value.result).toBe(0)
    expect(api.getVariables()).toEqual({ first: 0, next: 1, last: 1 })
  })

  it('shares a named source and cache between option and explicit consumers', async () => {
    const request = vi.fn(async () => response([{ label: 'A', value: 'a' }]))
    const { api, wrapper } = await fixture({
      configForm: true,
      props: { dataSourceHost: { request } },
      plan: plan({
        runtime: { dataSources: [source()], variables: [{ id: 'v', name: 'V', initialValue: 1 }] },
        optionBindings: [binding()],
      }),
    })

    expect(api.getOptionState(address)).toMatchObject({ status: 'success', options: [{ label: 'A', value: 'a' }] })
    expect(wrapper.get('[data-field="choice"]').findComponent(Control).props('options')).toEqual([{ label: 'A', value: 'a' }])
    await api.loadDataSource('choices')
    expect(request).toHaveBeenCalledTimes(1)
    expect(api.getDataSourceState('choices')).toMatchObject({ status: 'success', scopeKey: '[]' })
    expect(wrapper.emitted('variablesChange')).toEqual([[{ v: 1 }]])
    const state = api.getOptionState(address)!
    ;(state.options[0] as Record<string, unknown>).label = 'mutated'
    expect(api.getOptionState(address)!.options[0]).toEqual({ label: 'A', value: 'a' })
    expect(() => structuredClone(wrapper.emitted('dataSourceStateChange'))).not.toThrow()
  })

  it('resolves readonly component props from the same option state and preserves static options', async () => {
    const render = vi.fn(({ componentProps }) => JSON.stringify(componentProps.options))
    const { wrapper } = await fixture({
      props: {
        readonly: true,
        readonlyRender: render,
        dataSourceHost: { request: async () => response(['remote']) },
        fields: [
          { id: 'choice', field: 'choice', component: Control },
          { id: 'second', field: 'second', component: Control, props: { options: ['static'] } },
        ],
      },
      plan: plan({ runtime: { variables: [], dataSources: [source()] }, optionBindings: [binding()] }),
    })

    expect(wrapper.get('[data-field="choice"]').text()).toContain('remote')
    expect(wrapper.get('[data-field="second"]').text()).toContain('static')
    expect(render.mock.calls.some(([context]) => context.componentProps.optionState?.status === 'success')).toBe(true)
  })

  it('re-evaluates field dependencies, aborts stale requests, and ignores unrelated writes', async () => {
    const pending = [deferred(), deferred()]
    const request = vi.fn<NonNullable<ConfigFormDataSourceHost['request']>>()
      .mockImplementationOnce(() => pending[0]!.promise)
      .mockImplementationOnce(() => pending[1]!.promise)
    const { api, wrapper } = await fixture({
      props: { dataSourceHost: { request } },
      plan: plan({
        runtime: { variables: [], dataSources: [source({ request: { url: '/choices', query: { country: fieldRef('country') } } })] },
        optionBindings: [binding()],
      }),
    })

    api.setValue('country', 'b')
    expect(request).toHaveBeenCalledTimes(2)
    expect(request.mock.calls[0]![1].aborted).toBe(true)
    pending[1]!.resolve(response(['B']))
    await flushPromises()
    pending[0]!.resolve(response(['late A']))
    await flushPromises()
    expect(api.getOptionState(address)?.options).toEqual(['B'])
    const events = wrapper.emitted('dataSourceStateChange')!.length
    api.setValue('result', 123)
    expect(request).toHaveBeenCalledTimes(2)
    expect(wrapper.emitted('dataSourceStateChange')!.length).toBe(events)
  })

  it('isolates same-source parameters and retains a shared request until its last consumer leaves', async () => {
    const calls: Array<ReturnType<typeof deferred<ConfigFormDataSourceHttpRequestOutput>>> = []
    const request = vi.fn<NonNullable<ConfigFormDataSourceHost['request']>>(() => {
      const wait = deferred()
      calls.push(wait)
      return wait.promise
    })
    const { api } = await fixture({ props: { dataSourceHost: { request } }, plan: plan({
      runtime: { variables: [], dataSources: [source()] },
      optionBindings: [binding('choice', { q: fieldRef('country') }), binding('second', { q: fieldRef('country') })],
    }) })

    expect(request).toHaveBeenCalledTimes(1)
    const explicit = api.loadDataSource('choices', { params: { q: 'a' } })
    api.setValue('country', 'b')
    expect(request).toHaveBeenCalledTimes(2)
    expect(request.mock.calls[0]![1].aborted).toBe(false)
    calls[1]!.resolve(response(['B']))
    calls[0]!.resolve(response(['A']))
    await explicit
    await flushPromises()
    expect(api.getOptionState(address)?.options).toEqual(['B'])
    expect(api.getOptionState({ nodeId: 'second', scope: [] })?.options).toEqual(['B'])
  })

  it.each(['missing', 'host', 'mapping'] as const)('publishes explicit data diagnostics for %s', async (kind) => {
    const { api, wrapper } = await fixture({
      props: kind === 'host' ? {} : { dataSourceHost: { request: async () => response({ rows: [] }) } },
      plan: plan({
        runtime: { variables: [], dataSources: kind === 'missing' ? [] : [source()] },
        optionBindings: [binding()],
      }),
    })

    const error = api.getOptionState(address)?.error
    expect(error?.code).toBe({
      missing: 'CONFIG_FORM_DATA_SOURCE_MISSING',
      host: 'CONFIG_FORM_DATA_SOURCE_HOST_MISSING',
      mapping: 'CONFIG_FORM_OPTION_SOURCE_NOT_ARRAY',
    }[kind])
    expect(wrapper.emitted('dataSourceStateChange')?.some(([change]) =>
      (change as { state: { error?: { code: string } } }).state.error?.code === error?.code)).toBe(true)
  })

  it('does not request in design mode and starts after switching to preview', async () => {
    const request = vi.fn(async () => response([]))
    const runtimePlan = plan({ runtime: { variables: [], dataSources: [source({ auto: true })] }, optionBindings: [binding()] })
    const { api, wrapper } = await fixture({ props: { mode: 'design', dataSourceHost: { request } }, plan: runtimePlan })
    await api.loadDataSource('choices')
    expect(request).not.toHaveBeenCalled()
    await wrapper.setProps({ mode: 'preview' })
    await flushPromises()
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('cancels pending loads on reset, plan replacement, and unmount', async () => {
    const waits: Array<ReturnType<typeof deferred<ConfigFormDataSourceHttpRequestOutput>>> = []
    const request = vi.fn<NonNullable<ConfigFormDataSourceHost['request']>>(() => {
      const wait = deferred()
      waits.push(wait)
      return wait.promise
    })
    const runtimePlan = plan({ runtime: { variables: [], dataSources: [source()] }, optionBindings: [binding()] })
    const onState = vi.fn()
    const { api, wrapper } = await fixture({ props: { dataSourceHost: { request }, onDataSourceStateChange: onState }, plan: runtimePlan })

    await api.resetFields()
    expect(request.mock.calls[0]![1].aborted).toBe(true)
    await wrapper.setProps({ plan: structuredClone(runtimePlan) })
    await flushPromises()
    expect(request.mock.calls[1]![1].aborted).toBe(true)
    wrapper.unmount()
    expect(request.mock.calls[2]![1].aborted).toBe(true)
    const events = onState.mock.calls.length
    waits.forEach(wait => wait.resolve(response(['late'])))
    await flushPromises()
    expect(onState.mock.calls.length).toBe(events)
  })
})
