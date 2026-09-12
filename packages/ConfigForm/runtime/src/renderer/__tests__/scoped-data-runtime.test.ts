import type { ConfigFormDataSourceHost, ConfigFormFlowHttpRequestOutput } from '@moluoxixi/config-form-core'
import type { ConfigFormRendererNode } from '../types'
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { binding, Control, deferred, fieldRef, fixture, plan, response, source } from './data-runtime-fixture'

const fields: ConfigFormRendererNode[] = [
  { id: 'country', field: 'country', component: Control },
  {
    id: 'rows',
    component: 'div',
    valueScope: { kind: 'array', field: 'rows' },
    slots: { default: [
      { id: 'choice', field: 'choice', component: Control },
      { id: 'code', field: 'code', component: Control },
      {
        id: 'items',
        component: 'div',
        valueScope: { kind: 'array', field: 'items' },
        slots: { default: [
          { id: 'detail', field: 'detail', component: Control },
          { id: 'detail-code', field: 'code', component: Control },
        ] },
      },
    ] },
  },
]
function scopedPlan() {
  return plan({
    valueSchema: {
      valueScopes: [
        { nodeId: 'rows', field: 'rows', kind: 'array' },
        { nodeId: 'items', field: 'items', kind: 'array', parentId: 'rows' },
      ],
      scopedFields: [
        { nodeId: 'country', field: 'country' },
        { nodeId: 'choice', field: 'choice', scopeId: 'rows' },
        { nodeId: 'code', field: 'code', scopeId: 'rows' },
        { nodeId: 'detail', field: 'detail', scopeId: 'items' },
        { nodeId: 'detail-code', field: 'code', scopeId: 'items' },
      ],
    },
    runtime: { variables: [], dataSources: [source()] },
    optionBindings: [
      binding('choice', { q: fieldRef('code'), country: fieldRef('country', 'root') }),
      binding('detail', { q: fieldRef('detail-code'), parent: fieldRef('code', 'parent'), country: fieldRef('country', 'root') }),
    ],
  })
}
function scopedValues() {
  return { country: 'root', rows: ['a', 'b'].map(code => ({ code, choice: null, items: [1, 2].map(index => ({ code: `${code}${index}`, detail: null })) })) }
}

describe('renderer scoped option consumers', () => {
  it('isolates two rows and nested scopes and preserves state across row sorting', async () => {
    const request = vi.fn<NonNullable<ConfigFormDataSourceHost['request']>>(async input => response([input.query]))
    const { api, wrapper } = await fixture({ values: scopedValues(), props: { fields, dataSourceHost: { request } }, plan: scopedPlan() })
    expect(request).toHaveBeenCalledTimes(6)
    const [first, second] = api.listRows('rows')
    const nested = api.listRows('items', first!.scope)
    const address = { nodeId: 'detail', scope: nested[0]!.scope }
    const initial = api.getOptionState(address)
    expect(initial?.options).toEqual([{ q: 'a1', parent: 'a', country: 'root' }])
    expect(api.getOptionState({ nodeId: 'choice', scope: second!.scope })?.options).toEqual([{ q: 'b', country: 'root' }])
    api.moveRow('rows', first!.rowId, 1)
    api.moveRow('items', nested[0]!.rowId, 1, first!.scope)
    await flushPromises()
    expect(api.getOptionState(address)).toEqual(initial)
    expect(request).toHaveBeenCalledTimes(6)
    expect(wrapper.emitted('flowError')).toBeUndefined()
  })

  it.each(['delete', 'ancestor', 'replacement', 'empty replacement'] as const)('cancels removed consumers on %s and never publishes a late host result', async (operation) => {
    const waits: Array<ReturnType<typeof deferred<ConfigFormFlowHttpRequestOutput>>> = []
    const request = vi.fn<NonNullable<ConfigFormDataSourceHost['request']>>(() => {
      const wait = deferred()
      waits.push(wait)
      return wait.promise
    })
    const { api, values, wrapper } = await fixture({ values: scopedValues(), props: { fields, dataSourceHost: { request } }, plan: scopedPlan() })
    const first = api.listRows('rows')[0]!
    const nested = api.listRows('items', first.scope)[0]!
    const address = { nodeId: 'detail', scope: nested.scope }
    const key = api.getInstanceKey(address)
    if (operation === 'delete')
      api.removeRow('items', nested.rowId, first.scope)
    else if (operation === 'ancestor')
      api.removeRow('rows', first.rowId)
    else if (operation === 'replacement')
      values.value = scopedValues()
    else
      values.value = { country: 'replacement', rows: [] }
    await flushPromises()
    expect(api.getOptionState(address)).toBeUndefined()
    expect(request.mock.calls[2]![1].aborted).toBe(true)
    const count = wrapper.emitted('dataSourceStateChange')?.filter(([change]) => (change as { consumerKey: string }).consumerKey === `option:${key}`).length
    waits.forEach(wait => wait.resolve(response(['late'])))
    await flushPromises()
    expect(api.getOptionState(address)).toBeUndefined()
    expect(wrapper.emitted('dataSourceStateChange')?.filter(([change]) => (change as { consumerKey: string }).consumerKey === `option:${key}`).length).toBe(count)
  })

  it('only reloads the affected branch for parent/current/root request references', async () => {
    const request = vi.fn<NonNullable<ConfigFormDataSourceHost['request']>>(async input => response([input.query]))
    const { api } = await fixture({ values: scopedValues(), props: { fields, dataSourceHost: { request } }, plan: scopedPlan() })
    const first = api.listRows('rows')[0]!
    const nested = api.listRows('items', first.scope)[0]!
    api.setInstanceValue({ nodeId: 'detail-code', scope: nested.scope }, 'changed')
    await flushPromises()
    expect(request).toHaveBeenCalledTimes(7)
    api.setInstanceValue({ nodeId: 'code', scope: first.scope }, 'parent')
    await flushPromises()
    expect(request).toHaveBeenCalledTimes(10)
    api.setValue('country', 'all')
    await flushPromises()
    expect(request).toHaveBeenCalledTimes(16)
  })
})
