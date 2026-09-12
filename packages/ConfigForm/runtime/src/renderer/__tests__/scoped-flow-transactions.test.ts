import type {
  ConfigFormFlow,
  ConfigFormFlowAction,
  ConfigFormFlowActionContext,
  ConfigFormJsonValue,
} from '@moluoxixi/config-form-core'
import type { VueWrapper } from '@vue/test-utils'
import type { Component } from 'vue'
import type { ConfigFormPageRuntimePlan } from '../../runtime'
import type { ConfigFormRendererExpose, ConfigFormRendererNode } from '../types'
import { analyzeConfigFormFlow } from '@moluoxixi/config-form-core'
import { createConfigFormModel } from '@moluoxixi/config-form-headless'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, shallowRef } from 'vue'
import { ConfigFormRenderer } from '../index'

type Values = {
  root: number
  note: string
  rows: Array<{ amount: number, result: number, items: Array<{ amount: number, result: number, details: { amount: number, result: number } }> }>
}

const Trigger = defineComponent({
  props: ['modelValue'],
  emits: ['run'],
  setup: (props, { emit }) => () => h('button', { type: 'button', onClick: () => emit('run') }, String(props.modelValue)),
})
const wrappers: VueWrapper[] = []
afterEach(() => {
  for (const wrapper of wrappers.splice(0)) {
    if (wrapper.exists())
      wrapper.unmount()
  }
})

function deferred<T = unknown>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

function field(nodeId: string, scope: 'current' | 'parent' | 'root' = 'current'): ConfigFormJsonValue {
  return { $ref: { kind: 'field', nodeId, scope } }
}

function flow(options: {
  nodeId?: string
  input?: ConfigFormJsonValue
  terminal?: 'success' | 'end' | 'blocked' | 'failure'
  concurrency?: ConfigFormFlow['concurrency']
} = {}): ConfigFormFlow {
  return {
    version: 1,
    id: 'scoped-flow',
    name: 'Scoped flow',
    trigger: { kind: 'component.event', nodeId: options.nodeId ?? 'amount', event: 'run' },
    concurrency: options.concurrency ?? 'latest',
    nodes: [
      { id: 'start', type: 'trigger' },
      { id: 'wait', type: 'action', ref: 'wait', config: { input: null } },
      { id: 'write', type: 'action', ref: 'write', config: { input: options.input ?? field('amount') } },
      { id: 'done', type: options.terminal ?? 'success' },
    ],
    edges: [
      { id: 'a', source: 'start', target: 'wait' },
      { id: 'b', source: 'wait', target: 'write' },
      { id: 'c', source: 'write', target: 'done' },
    ],
  }
}

function runtimePlan(source: ConfigFormFlow): ConfigFormPageRuntimePlan {
  const result = analyzeConfigFormFlow(source)
  if (!result.success)
    throw new Error(result.diagnostics.map(item => item.message).join('; '))
  return {
    flows: [result.plan],
    optionBindings: [],
    runtime: { dataSources: [], variables: [{ id: 'count', name: 'Count', initialValue: 0 }] },
    valueSchema: {
      valueScopes: [
        { nodeId: 'rows', kind: 'array', field: 'rows' },
        { nodeId: 'items', kind: 'array', field: 'items', parentId: 'rows' },
        { nodeId: 'details', kind: 'object', field: 'details', parentId: 'items' },
      ],
      scopedFields: [
        { nodeId: 'root', field: 'root' },
        { nodeId: 'note', field: 'note' },
        { nodeId: 'amount', field: 'amount', scopeId: 'rows' },
        { nodeId: 'result', field: 'result', scopeId: 'rows' },
        { nodeId: 'item-amount', field: 'amount', scopeId: 'items' },
        { nodeId: 'item-result', field: 'result', scopeId: 'items' },
        { nodeId: 'detail-amount', field: 'amount', scopeId: 'details' },
        { nodeId: 'detail-result', field: 'result', scopeId: 'details' },
      ],
    },
  }
}

async function fixture(source: ConfigFormFlow, actions: Record<string, ConfigFormFlowAction['execute']>) {
  const values = shallowRef<Values>({
    root: 5,
    note: '',
    rows: [10, 20].map(amount => ({
      amount,
      result: 0,
      items: [1, 2].map(value => ({ amount: value * 100, result: 0, details: { amount: value, result: 0 } })),
    })),
  })
  const fields: ConfigFormRendererNode<Values>[] = [
    { id: 'root', field: 'root', component: Trigger, props: { 'data-flow-node': 'root' } },
    { id: 'note', field: 'note', component: 'input' },
    {
      id: 'rows',
      component: 'div',
      valueScope: { kind: 'array', field: 'rows' },
      slots: { default: [
        { id: 'amount', field: 'amount', component: Trigger, props: { 'data-flow-node': 'amount' } },
        { id: 'result', field: 'result', component: 'input' },
        {
          id: 'items',
          component: 'div',
          valueScope: { kind: 'array', field: 'items' },
          slots: { default: [
            { id: 'item-amount', field: 'amount', component: Trigger, props: { 'data-flow-node': 'item-amount' } },
            { id: 'item-result', field: 'result', component: 'input' },
            {
              id: 'details',
              component: 'div',
              valueScope: { kind: 'object', field: 'details' },
              slots: { default: [
                { id: 'detail-amount', field: 'amount', component: Trigger, props: { 'data-flow-node': 'detail-amount' } },
                { id: 'detail-result', field: 'result', component: 'input' },
              ] },
            },
          ] },
        },
      ] },
    },
  ]
  const onTrace = vi.fn()
  const onResult = vi.fn()
  const wrapper = mount(ConfigFormRenderer as Component, { props: {
    model: createConfigFormModel(values),
    plan: runtimePlan(source),
    fields,
    onFlowTrace: onTrace,
    onFlowResult: onResult,
    flowActions: { get: (ref: string) => actions[ref] ? {
      descriptor: { ref, title: ref, category: 'test', parameters: [], outputs: [], capabilities: [] },
      execute: actions[ref],
    } : undefined },
  } })
  wrappers.push(wrapper)
  const api = wrapper.vm as unknown as ConfigFormRendererExpose<Values>
  await flushPromises()
  expect(wrapper.emitted('flowError')).toBeUndefined()
  const rows = api.listRows('rows')
  const click = async (rowId: string, nestedRowId?: string) => {
    const row = wrapper.get(`[data-row-id="${rowId}"]`)
    const target = nestedRowId ? row.get(`[data-row-id="${nestedRowId}"]`) : row
    const nodeId = source.trigger.kind === 'component.event' ? source.trigger.nodeId : 'amount'
    await target.get(`[data-flow-node="${nodeId}"]`).trigger('click')
    await flushPromises()
  }
  return { api, click, onResult, onTrace, rows, values, wrapper }
}

function identities(api: ConfigFormRendererExpose<Values>) {
  return api.listFieldInstances().map(instance => instance.instanceKey).sort()
}

describe('Renderer scoped Core flow transactions', () => {
  it('reads the first row snapshot after moveRow and rebases only its field patch', async () => {
    const wait = deferred()
    const read = vi.fn((input: unknown, context: ConfigFormFlowActionContext) => {
      expect(context.form.getField?.('amount')).toBe(10)
      context.form.setField?.('result', input)
    })
    const { api, click, rows, values, wrapper } = await fixture(flow(), { wait: () => wait.promise, write: read })
    const ids = identities(api)
    await click(rows[0]!.rowId)
    api.moveRow('rows', rows[0]!.rowId, 1)
    api.setInstanceValue({ nodeId: 'amount', scope: rows[1]!.scope }, 21)
    api.setValue('note', 'concurrent edit')
    wait.resolve(null)
    await flushPromises()
    expect(read).toHaveBeenCalledWith(10, expect.anything())
    expect(values.value.rows.map(row => [row.amount, row.result])).toEqual([[21, 0], [10, 10]])
    expect(values.value.note).toBe('concurrent edit')
    expect(identities(api)).toEqual(ids)
    expect(wrapper.emitted('flowError')).toBeUndefined()
  })

  it('isolates the same latest flow between rows and preserves the other row commit', async () => {
    const waits = [deferred(), deferred()]
    const signals: AbortSignal[] = []
    const wait = vi.fn((_input, context: ConfigFormFlowActionContext) => {
      signals.push(context.signal)
      return waits[signals.length - 1]!.promise
    })
    const { api, click, rows, values } = await fixture(flow(), {
      wait,
      write: (input, context) => context.form.setField?.('result', Number(input) + 1),
    })
    const ids = identities(api)
    await click(rows[0]!.rowId)
    await click(rows[1]!.rowId)
    expect(wait).toHaveBeenCalledTimes(2)
    expect(signals.every(signal => !signal.aborted)).toBe(true)
    waits[1]!.resolve(null)
    await flushPromises()
    expect(values.value.rows.map(row => row.result)).toEqual([0, 21])
    waits[0]!.resolve(null)
    await flushPromises()
    expect(values.value.rows.map(row => row.result)).toEqual([11, 21])
    expect(identities(api)).toEqual(ids)
  })

  it('keeps latest cancellation within one row and rejects the superseded output', async () => {
    const waits = [deferred<number>(), deferred<number>()]
    const signals: AbortSignal[] = []
    const { click, rows, values, wrapper } = await fixture(flow({ input: { $ref: { kind: 'output', stepId: 'wait' } } }), {
      wait: (_input, context) => {
        signals.push(context.signal)
        return waits[signals.length - 1]!.promise
      },
      write: (input, context) => context.form.setField?.('result', input),
    })
    await click(rows[0]!.rowId)
    await click(rows[0]!.rowId)
    expect(signals[0]!.aborted).toBe(true)
    expect(signals[1]!.aborted).toBe(false)
    waits[1]!.resolve(200)
    await flushPromises()
    const traces = wrapper.emitted('flowTrace')?.length
    waits[0]!.resolve(100)
    await flushPromises()
    expect(values.value.rows[0]!.result).toBe(200)
    expect(wrapper.emitted('flowTrace')).toHaveLength(traces!)
  })

  it.each(['root patch', 'array snapshot'] as const)('keeps unkeyed identities for form setValue/setValues and instance writes: %s', async (mode) => {
    const { api, click, rows, values, wrapper } = await fixture(flow(), {
      wait: () => undefined,
      write: (_input, context) => {
        context.form.setValue('note', 'flow')
        context.form.setValues({ root: 6 })
        if (mode === 'array snapshot') {
          const snapshot = context.form.getValues() as Values
          snapshot.rows[0]!.result = 11
          context.form.setValues(snapshot)
        }
        else {
          context.form.setField?.('result', 11)
        }
      },
    })
    const ids = identities(api)
    api.setInstanceValue({ nodeId: 'result', scope: rows[1]!.scope }, 22)
    await click(rows[0]!.rowId)
    expect(values.value.rows.map(row => row.result)).toEqual([11, 22])
    expect(values.value.note).toBe('flow')
    expect(values.value.root).toBe(6)
    expect(identities(api)).toEqual(ids)
    expect(wrapper.emitted('flowError')).toBeUndefined()
  })

  it.each([
    { kind: 'object', source: 'detail-amount', target: 'detail-result', parentSource: 'item-amount', parentTarget: 'item-result', currentValue: 1, parentValue: 100 },
    { kind: 'array', source: 'item-amount', target: 'item-result', parentSource: 'amount', parentTarget: 'result', currentValue: 100, parentValue: 10 },
  ])('resolves the direct $kind parent and root after both array moves', async ({ kind, source, target, parentSource, parentTarget, currentValue, parentValue }) => {
    const wait = deferred()
    const write = vi.fn((input: unknown, context: ConfigFormFlowActionContext) => {
      expect(context.form.getField?.(source)).toBe(currentValue)
      expect(context.form.getField?.(parentSource, 'parent')).toBe(parentValue)
      expect(context.form.getField?.('root', 'root')).toBe(5)
      context.form.setField?.(target, input)
      context.form.setField?.(parentTarget, 15, 'parent')
      context.form.setField?.('note', 'nested', 'root')
    })
    const { api, click, rows, values, wrapper } = await fixture(flow({
      nodeId: source,
      input: [field(source), field(parentSource, 'parent'), field('root', 'root')],
    }), { wait: () => wait.promise, write })
    const parent = rows[0]!
    const items = api.listRows('items', parent.scope)
    const ids = identities(api)
    await click(parent.rowId, items[0]!.rowId)
    api.moveRow('rows', parent.rowId, 1)
    api.moveRow('items', items[0]!.rowId, 1, parent.scope)
    wait.resolve(null)
    await flushPromises()
    const expected = [currentValue, parentValue, 5]
    expect(write).toHaveBeenCalledWith(expected, expect.anything())
    const moved = values.value.rows[1]!
    if (kind === 'object') {
      expect(moved.items[1]!.details.result).toEqual(expected)
      expect(moved.items[1]!.result).toBe(15)
      expect(moved.result).toBe(0)
    }
    else {
      expect(moved.items[1]!.result).toEqual(expected)
      expect(moved.result).toBe(15)
      expect(moved.items[1]!.details.result).toBe(0)
    }
    expect(moved.items[0]!.result).toBe(0)
    expect(values.value.rows[0]!.result).toBe(0)
    expect(values.value.note).toBe('nested')
    expect(identities(api)).toEqual(ids)
    expect(wrapper.emitted('flowError')).toBeUndefined()
  })

  it.each(['row', 'ancestor'] as const)('cancels a pending nested flow on %s deletion without late values or trace', async (removed) => {
    const wait = deferred()
    let signal!: AbortSignal
    const write = vi.fn((_input, context: ConfigFormFlowActionContext) => context.form.setValue('note', 'late'))
    const { api, click, rows, values, wrapper } = await fixture(flow({ nodeId: 'detail-amount', input: field('detail-amount') }), {
      wait: (_input, context) => { signal = context.signal; return wait.promise },
      write,
    })
    const parent = rows[0]!
    const item = api.listRows('items', parent.scope)[0]!
    await click(parent.rowId, item.rowId)
    if (removed === 'row')
      api.removeRow('items', item.rowId, parent.scope)
    else
      api.removeRow('rows', parent.rowId)
    expect(signal.aborted).toBe(true)
    const traces = wrapper.emitted('flowTrace')?.length
    const results = wrapper.emitted('flowResult')?.length ?? 0
    wait.resolve(null)
    await flushPromises()
    expect(write).not.toHaveBeenCalled()
    expect(values.value.note).toBe('')
    expect(wrapper.emitted('flowTrace')).toHaveLength(traces!)
    expect(wrapper.emitted('flowResult')?.length ?? 0).toBe(results)
  })

  it.each(['all', 'unrelated field'] as const)('resetFields(%s) cancels ordinary component events even without a reset flow', async (reset) => {
    const wait = deferred()
    let signal!: AbortSignal
    const write = vi.fn((_input, context: ConfigFormFlowActionContext) => context.form.setValue('note', 'late'))
    const { api, click, rows, values, wrapper } = await fixture(flow(), {
      wait: (_input, context) => { signal = context.signal; return wait.promise },
      write,
    })
    await click(rows[0]!.rowId)
    expect(await api.resetFields(reset === 'all' ? undefined : 'note')).toBe(true)
    expect(signal.aborted).toBe(true)
    const traces = wrapper.emitted('flowTrace')?.length
    const results = wrapper.emitted('flowResult')?.length ?? 0
    wait.resolve(null)
    await flushPromises()
    expect(write).not.toHaveBeenCalled()
    expect(values.value.note).toBe('')
    expect(wrapper.emitted('flowTrace')).toHaveLength(traces!)
    expect(wrapper.emitted('flowResult')?.length ?? 0).toBe(results)
  })

  it.each(['plan replacement', 'unmount'] as const)('suppresses late output after %s', async (boundary) => {
    const wait = deferred()
    let signal!: AbortSignal
    const write = vi.fn((_input, context: ConfigFormFlowActionContext) => context.form.setValue('note', 'late'))
    const { click, onResult, onTrace, rows, values, wrapper } = await fixture(flow(), {
      wait: (_input, context) => { signal = context.signal; return wait.promise },
      write,
    })
    await click(rows[0]!.rowId)
    if (boundary === 'unmount')
      wrapper.unmount()
    else
      await wrapper.setProps({ plan: runtimePlan(flow()) })
    await flushPromises()
    expect(signal.aborted).toBe(true)
    const traces = onTrace.mock.calls.length
    const results = onResult.mock.calls.length
    expect(traces).toBeGreaterThan(0)
    wait.resolve(null)
    await flushPromises()
    expect(write).not.toHaveBeenCalled()
    expect(values.value.note).toBe('')
    expect(onTrace).toHaveBeenCalledTimes(traces)
    expect(onResult).toHaveBeenCalledTimes(results)
  })

  it.each(['success', 'end', 'blocked', 'failure'] as const)('uses Core commit semantics for the %s terminal', async (terminal) => {
    const { api, click, rows, values, wrapper } = await fixture(flow({ terminal }), {
      wait: () => undefined,
      write: (_input, context) => {
        context.form.setField?.('result', 42)
        context.form.setValue('note', 'transaction')
        context.form.setVariable?.('count', 1)
        expect(context.form.getVariable?.('count')).toBe(1)
        expect(values.value.rows[0]!.result).toBe(0)
        expect(values.value.note).toBe('')
      },
    })
    const ids = identities(api)
    await click(rows[0]!.rowId)
    const commit = terminal !== 'failure'
    expect(values.value.rows[0]!.result).toBe(commit ? 42 : 0)
    expect(values.value.note).toBe(commit ? 'transaction' : '')
    expect(identities(api)).toEqual(ids)
    expect(wrapper.emitted('flowResult')?.at(-1)?.[0]).toMatchObject({
      status: terminal === 'success' || terminal === 'end' ? 'committed' : terminal,
    })
  })

  it('rebases legacy form.setValues snapshots without overwriting newer sibling edits', async () => {
    const wait = deferred()
    const { api, click, rows, values, wrapper } = await fixture(flow(), {
      wait: () => wait.promise,
      write: (_input, context) => {
        const snapshot = context.form.getValues() as Values
        snapshot.rows[0]!.result = 10
        context.form.setValues(snapshot)
      },
    })
    const ids = identities(api)
    await click(rows[0]!.rowId)
    api.moveRow('rows', rows[0]!.rowId, 1)
    api.setInstanceValue({ nodeId: 'result', scope: rows[1]!.scope }, 99)
    api.setValue('note', 'newer')
    wait.resolve(null)
    await flushPromises()
    expect(values.value.rows.map(row => [row.amount, row.result])).toEqual([[20, 99], [10, 10]])
    expect(values.value.note).toBe('newer')
    expect(identities(api)).toEqual(ids)
    expect(wrapper.emitted('flowError')).toBeUndefined()
  })

  it('captures the queued transaction directory and values when that run starts', async () => {
    const gate = deferred()
    const wait = vi.fn(() => wait.mock.calls.length === 1 ? gate.promise : undefined)
    const inputs: unknown[] = []
    const { api, click, rows, values, wrapper } = await fixture(flow({ concurrency: 'queue' }), {
      wait,
      write: (input, context) => {
        inputs.push(input)
        context.form.setField?.('amount', Number(input) + 1)
      },
    })
    const ids = identities(api)
    await click(rows[0]!.rowId)
    await click(rows[0]!.rowId)
    expect(wait).toHaveBeenCalledOnce()
    api.moveRow('rows', rows[0]!.rowId, 1)
    gate.resolve(null)
    await flushPromises()
    expect(wait).toHaveBeenCalledTimes(2)
    expect(inputs).toEqual([10, 11])
    expect(values.value.rows.map(row => row.amount)).toEqual([20, 12])
    expect(identities(api)).toEqual(ids)
    expect(wrapper.emitted('flowError')).toBeUndefined()
  })

  it('binds unscoped component events to reset cancellation and renews their signal afterwards', async () => {
    const gate = deferred()
    const signals: AbortSignal[] = []
    const write = vi.fn((_input, context: ConfigFormFlowActionContext) => context.form.setValue('note', 'after reset'))
    const { api, values, wrapper } = await fixture(flow({ nodeId: 'root', input: field('root') }), {
      wait: (_input, context) => {
        signals.push(context.signal)
        return signals.length === 1 ? gate.promise : undefined
      },
      write,
    })
    const ids = identities(api)
    await wrapper.findComponent(Trigger).get('button').trigger('click')
    await flushPromises()
    expect(signals).toHaveLength(1)
    expect(await api.resetFields('note')).toBe(true)
    expect(signals[0]!.aborted).toBe(true)
    gate.resolve(null)
    await flushPromises()
    expect(write).not.toHaveBeenCalled()
    expect(values.value.note).toBe('')
    await wrapper.findComponent(Trigger).get('button').trigger('click')
    await flushPromises()
    expect(write).toHaveBeenCalledOnce()
    expect(values.value.note).toBe('after reset')
    expect(identities(api)).toEqual(ids)
    expect(wrapper.emitted('flowError')).toBeUndefined()
  })
})
