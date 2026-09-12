import type { ConfigFormDataSourceHost } from '@moluoxixi/config-form-core'
import type { ConfigFormRendererNode } from '../types'
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { Control, deferred, fieldRef, fixture, flow, outputRef, plan, response, source } from './data-runtime-fixture'

const valueSchema = {
  valueScopes: [{ nodeId: 'rows', field: 'rows', kind: 'array' as const }],
  scopedFields: [
    { nodeId: 'choice', field: 'choice' },
    { nodeId: 'row-choice', field: 'choice', scopeId: 'rows' },
    { nodeId: 'row-result', field: 'result', scopeId: 'rows' },
  ],
}
const fields: ConfigFormRendererNode[] = [
  { id: 'choice', field: 'choice', component: Control },
  {
    id: 'rows',
    component: 'div',
    valueScope: { kind: 'array', field: 'rows' },
    slots: { default: [
      { id: 'row-choice', field: 'choice', component: Control },
      { id: 'row-result', field: 'result', component: 'input' },
    ] },
  },
]
const initialValues = () => ({ choice: null, rows: [{ choice: 'a', result: '' }, { choice: 'b', result: '' }] })

describe('component Flow scope lifetimes', () => {
  it('commits structural root changes and variables together without cancelling itself', async () => {
    const { api, run, values, wrapper } = await fixture({
      values: initialValues(),
      props: { fields },
      actions: { remove: (_input, context) => context.form.setValue('rows', []) },
      plan: plan({
        valueSchema,
        runtime: { variables: [{ id: 'v', name: 'V', initialValue: 0 }], dataSources: [] },
        flows: [flow([
          { ref: 'builtin.variable.set', input: { variableId: 'v', value: 1 } },
          { ref: 'remove' },
        ])],
      }),
    })
    const changes = wrapper.emitted('change')?.length ?? 0
    await run()
    expect(values.value.rows).toEqual([])
    expect(api.getVariables()).toEqual({ v: 1 })
    expect(wrapper.emitted('flowError')).toBeUndefined()
    expect(wrapper.emitted('flowResult')?.at(-1)?.[0]).toMatchObject({ status: 'committed' })
    expect(wrapper.emitted('change')).toHaveLength(changes + 1)
  })

  it('cancels only the removed row while the surviving row request and Flow still commit', async () => {
    const pending = [deferred(), deferred()]
    const request = vi.fn<NonNullable<ConfigFormDataSourceHost['request']>>()
      .mockImplementationOnce(() => pending[0]!.promise)
      .mockImplementationOnce(() => pending[1]!.promise)
    const { api, values, wrapper } = await fixture({
      values: initialValues(),
      props: { fields, dataSourceHost: { request } },
      plan: plan({
        valueSchema,
        runtime: {
          variables: [],
          dataSources: [source({ request: { url: '/choices', query: { row: fieldRef('row-choice') } } })],
        },
        flows: [flow([
          { ref: 'builtin.dataSource.load', input: { dataSourceId: 'choices' } },
          { ref: 'builtin.field.set', input: { fieldId: 'row-result', value: outputRef('step0', ['state', 'data']) } },
        ], { kind: 'component.event', nodeId: 'row-choice', event: 'run' })],
      }),
    })
    const [first, second] = api.listRows('rows')
    for (const row of [first!, second!]) {
      await wrapper.get(`[data-row-id="${row.rowId}"] [data-field="choice"] button`).trigger('click')
      await flushPromises()
    }
    expect(request).toHaveBeenCalledTimes(2)
    expect(request.mock.calls.map(([input]) => input.query)).toEqual([{ row: 'a' }, { row: 'b' }])
    api.removeRow('rows', first!.rowId)
    expect(request.mock.calls[0]![1].aborted).toBe(true)
    expect(request.mock.calls[1]![1].aborted).toBe(false)
    pending[1]!.resolve(response(['B completed']))
    await flushPromises()
    expect(api.listRows('rows').map(row => row.rowId)).toEqual([second!.rowId])
    expect(values.value.rows).toEqual([{ choice: 'b', result: ['B completed'] }])
    const traces = wrapper.emitted('flowTrace')?.length ?? 0
    const results = wrapper.emitted('flowResult')?.length ?? 0
    pending[0]!.resolve(response(['late A']))
    await flushPromises()
    expect(values.value.rows).toEqual([{ choice: 'b', result: ['B completed'] }])
    expect(wrapper.emitted('flowTrace')).toHaveLength(traces)
    expect(wrapper.emitted('flowResult')).toHaveLength(results)
    expect(wrapper.emitted('flowError')).toBeUndefined()
  })
})
