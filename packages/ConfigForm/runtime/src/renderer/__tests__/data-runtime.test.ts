import type { ConfigFormDataSourceHost, ConfigFormFlowHttpRequestOutput, ConfigFormValueInput } from '@moluoxixi/config-form-core'
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { binding, Control, deferred, fieldRef, fixture, flow, outputRef, plan, response, source, variableRef } from './data-runtime-fixture'

const address = { nodeId: 'choice', scope: [] }
const loadStep = { ref: 'builtin.dataSource.load', input: { dataSourceId: 'choices' } }

describe('renderer page variables and data sources', () => {
  it('initializes chained safe variables before initialize and restores the original field baseline before reset flows', async () => {
    const read = vi.fn()
    const runtime = { dataSources: [], variables: [
      { id: 'last', name: 'Last', initialValue: variableRef('next') },
      { id: 'next', name: 'Next', initialValue: { $ref: { kind: 'expression', source: '$variables["first"] + 1' } } as ConfigFormValueInput },
      { id: 'first', name: 'First', initialValue: fieldRef('result') },
    ] }
    const { api, run, values, wrapper } = await fixture({
      plan: plan({ runtime, flows: [
        flow([{ ref: 'read', input: variableRef('last') }], { kind: 'form.initialize' }),
        flow([{ ref: 'read', input: variableRef('last') }], { kind: 'form.reset' }),
        flow([{ ref: 'builtin.variable.set', input: { variableId: 'last', value: 99 } }]),
      ] }),
      actions: { read },
    })
    expect(api.getVariables()).toEqual({ first: 0, next: 1, last: 1 })
    expect(read.mock.calls[0]?.[0]).toBe(1)
    await run()
    expect(api.getVariables().last).toBe(99)
    api.setValue('result', 100)
    await api.resetFields()
    expect(values.value.result).toBe(0)
    expect(api.getVariables()).toEqual({ first: 0, next: 1, last: 1 })
    expect(read.mock.calls.at(-1)?.[0]).toBe(1)
    const snapshot = api.getVariables() as Record<string, unknown>
    snapshot.last = 'changed'
    expect(api.getVariables().last).toBe(1)
    expect(wrapper.emitted('flowError')).toBeUndefined()
  })

  it.each(['failure', 'success'] as const)('publishes field/variable builtins only for terminal %s and reserves builtin names', async (terminal) => {
    const override = vi.fn()
    const { api, run, values, wrapper } = await fixture({
      plan: plan({
        runtime: { variables: [{ id: 'v', name: 'V', initialValue: 0 }], dataSources: [] },
        flows: [flow([
          { ref: 'builtin.variable.set', input: { variableId: 'v', value: 2 } },
          { ref: 'builtin.field.set', input: { fieldId: 'result', value: variableRef('v') } },
          { ref: 'builtin.field.state', input: { fieldId: 'choice', state: 'disabled', value: true } },
        ], undefined, terminal)],
      }),
      actions: { 'builtin.variable.set': override },
    })
    const count = wrapper.emitted('variablesChange')!.length
    await run()
    expect(override).not.toHaveBeenCalled()
    expect(api.getVariables().v).toBe(terminal === 'success' ? 2 : 0)
    expect(values.value.result).toBe(terminal === 'success' ? 2 : 0)
    expect(wrapper.emitted('variablesChange')!.length).toBe(count + Number(terminal === 'success'))
    expect(wrapper.get('[data-field="choice"] button').attributes('disabled') !== undefined).toBe(terminal === 'success')
  })

  it.each([
    { initialValue: variableRef('missing'), code: 'CONFIG_FORM_VARIABLE_MISSING' },
    { initialValue: variableRef('v'), code: 'CONFIG_FORM_VARIABLE_CYCLE' },
    { initialValue: fieldRef('missing'), code: 'CONFIG_FORM_VALUE_REFERENCE_MISSING' },
    { initialValue: { $ref: { kind: 'expression', source: 'globalThis.alert(1)' } } as ConfigFormValueInput, code: 'CONFIG_FORM_EXPRESSION_UNEXPECTED_TOKEN' },
  ])('reports precise initialization diagnostics without publishing partial variables: $code', async ({ initialValue, code }) => {
    const { api, wrapper } = await fixture({ plan: plan({ runtime: {
      variables: [{ id: 'v', name: 'V', initialValue }],
      dataSources: [],
    } }) })
    expect(api.getVariables()).toEqual({})
    expect(wrapper.emitted('variablesChange')).toBeUndefined()
    expect(wrapper.emitted('flowError')?.[0]?.[0]).toMatchObject({ code, path: expect.stringContaining('runtime.variables[0].initialValue') })
  })

  it('shares a named source and cache between options and Flow and forwards ConfigForm snapshots and methods', async () => {
    const request = vi.fn(async () => response([{ label: 'A', value: 'a' }]))
    const read = vi.fn()
    const { api, run, wrapper } = await fixture({
      configForm: true,
      props: { dataSourceHost: { request } },
      actions: { read },
      plan: plan({
        runtime: { dataSources: [source()], variables: [{ id: 'v', name: 'V', initialValue: 1 }] },
        optionBindings: [binding()],
        flows: [flow([loadStep, { ref: 'read', input: outputRef('step0', ['state', 'status']) }])],
      }),
    })
    expect(api.getOptionState(address)).toMatchObject({ status: 'success', options: [{ label: 'A', value: 'a' }] })
    expect(wrapper.get('[data-field="choice"]').findComponent(Control).props('options')).toEqual([{ label: 'A', value: 'a' }])
    await run()
    expect(request).toHaveBeenCalledTimes(1)
    expect(read.mock.calls[0]?.[0]).toBe('success')
    expect(api.getDataSourceState('choices')).toMatchObject({ status: 'success', scopeKey: '[]' })
    expect(wrapper.emitted('dataSourceStateChange')?.length).toBeGreaterThanOrEqual(3)
    expect(wrapper.emitted('variablesChange')).toEqual([[{ v: 1 }]])
    expect(wrapper.emitted('flowTrace')?.length).toBeGreaterThan(0)
    const state = api.getOptionState(address)!
    ;(state.options[0] as Record<string, unknown>).label = 'mutated'
    expect(api.getOptionState(address)!.options[0]).toEqual({ label: 'A', value: 'a' })
    expect(() => structuredClone(wrapper.emitted('dataSourceStateChange'))).not.toThrow()
    expect(JSON.parse(JSON.stringify(wrapper.emitted('dataSourceStateChange')))).toEqual(wrapper.emitted('dataSourceStateChange'))
  })

  it('resolves readonlyRender componentProps from the same option state and preserves static options', async () => {
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

  it('cascades by resolved dependencies with latest/abort, ignores late hosts and updates options on cache hits', async () => {
    const pending = [deferred(), deferred()]
    const request = vi.fn<NonNullable<ConfigFormDataSourceHost['request']>>()
      .mockImplementationOnce(() => pending[0]!.promise)
      .mockImplementationOnce(() => pending[1]!.promise)
    const { api, wrapper } = await fixture({
      props: { dataSourceHost: { request } },
      plan: plan({ runtime: { variables: [], dataSources: [source({ request: { url: '/choices', query: { country: fieldRef('country') } } })] }, optionBindings: [binding()] }),
    })
    expect(api.getOptionState(address)?.status).toBe('loading')
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
    await api.loadDataSource('choices')
    expect(request).toHaveBeenCalledTimes(2)
    expect(api.getDataSourceState('choices')).toMatchObject({ status: 'success', data: ['B'] })
  })

  it('isolates same-source consumers with different parameters and retains a shared request until its last consumer leaves', async () => {
    const calls: Array<ReturnType<typeof deferred<ConfigFormFlowHttpRequestOutput>>> = []
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
    expect(api.getDataSourceState('choices').data).toEqual(['B'])
  })

  it('turns HTTP errors into Flow failure without committing, supports retry and empty output branching', async () => {
    const request = vi.fn(async () => response([], false))
    const read = vi.fn()
    const { api, run, wrapper } = await fixture({ props: { dataSourceHost: { request } }, actions: { read }, plan: plan({
      runtime: { variables: [{ id: 'v', name: 'V', initialValue: 0 }], dataSources: [source()] },
      flows: [flow([
        { ref: 'builtin.variable.set', input: { variableId: 'v', value: 10 } },
        loadStep,
        { ref: 'read', input: outputRef('step1', ['state', 'status']) },
      ])],
    }) })
    await run()
    expect(api.getVariables().v).toBe(0)
    expect(wrapper.emitted('flowResult')?.at(-1)?.[0]).toMatchObject({ status: 'failure' })
    expect(read).not.toHaveBeenCalled()
    request.mockResolvedValue(response([]))
    await run()
    expect(request).toHaveBeenCalledTimes(2)
    expect(api.getVariables().v).toBe(10)
    expect(read.mock.calls[0]?.[0]).toBe('empty')
    await api.loadDataSource('choices', { force: true })
    expect(request).toHaveBeenCalledTimes(3)
  })

  it('loads action requests from the run-local fields and variables, then cascades options only after commit', async () => {
    const pause = deferred<null>()
    const request = vi.fn(async input => response([input.query]))
    const { api, run, values } = await fixture({
      props: { dataSourceHost: { request } },
      actions: { pause: () => pause.promise },
      plan: plan({
        runtime: {
          variables: [{ id: 'v', name: 'V', initialValue: 'initial' }],
          dataSources: [source({ request: { url: '/choices', query: { country: fieldRef('country'), v: variableRef('v') } } })],
        },
        flows: [flow([
          { ref: 'builtin.field.set', input: { fieldId: 'country', value: 'run' } },
          { ref: 'builtin.variable.set', input: { variableId: 'v', value: 'local' } },
          { ref: 'pause' },
          loadStep,
        ])],
      }),
    })
    await run()
    api.setValue('country', 'future')
    expect(api.getVariables().v).toBe('initial')
    pause.resolve(null)
    await flushPromises()
    expect(request.mock.calls[0]?.[0].query).toEqual({ country: 'run', v: 'local' })
    expect(values.value.country).toBe('run')
    expect(api.getVariables().v).toBe('local')
  })

  it.each(['missing', 'host', 'mapping'] as const)('reports explicit source/field diagnostics for %s', async (kind) => {
    const { api, wrapper } = await fixture({ props: kind === 'host' ? {} : { dataSourceHost: { request: async () => response({ rows: [] }) } }, plan: plan({
      runtime: { variables: [], dataSources: kind === 'missing' ? [] : [source()] },
      optionBindings: [binding()],
    }) })
    expect(api.getOptionState(address)?.status).toBe('error')
    const error = api.getOptionState(address)?.error
    expect(error?.code).toBe({ missing: 'CONFIG_FORM_DATA_SOURCE_MISSING', host: 'CONFIG_FORM_DATA_SOURCE_HOST_MISSING', mapping: 'CONFIG_FORM_OPTION_SOURCE_NOT_ARRAY' }[kind])
    expect(wrapper.emitted('flowError')?.[0]?.[0]).toMatchObject({ path: expect.stringContaining('choice') })
  })

  it('makes no design/import/plan-change requests and starts only on runtime mount', async () => {
    const request = vi.fn(async () => response([]))
    const runtimePlan = plan({ runtime: { variables: [], dataSources: [source({ auto: true })] }, optionBindings: [binding()] })
    const { api, wrapper } = await fixture({ props: { mode: 'design', dataSourceHost: { request } }, plan: runtimePlan })
    await wrapper.setProps({ plan: structuredClone(runtimePlan) })
    await api.loadDataSource('choices')
    expect(request).not.toHaveBeenCalled()
    await wrapper.setProps({ mode: 'preview' })
    await flushPromises()
    expect(request).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('cancels pending loads on reset, plan update and unmount even when the host ignores AbortSignal', async () => {
    const waits: Array<ReturnType<typeof deferred<ConfigFormFlowHttpRequestOutput>>> = []
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
    expect(events).toBeGreaterThan(0)
    waits.forEach(wait => wait.resolve(response(['late'])))
    await flushPromises()
    expect(onState.mock.calls.length).toBe(events)
  })
})
