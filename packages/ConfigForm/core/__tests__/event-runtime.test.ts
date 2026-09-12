import type { ConfigFormFlow, ConfigFormFlowActionContext } from '../index'
import { describe, expect, it, vi } from 'vitest'
import {
  analyzeConfigFormFlow,
  ConfigFormFlowInterpreter,
  createConfigFormEventRuntime,
  snapshotConfigFormEventArgs,
} from '../index'

function flow(concurrency: ConfigFormFlow['concurrency'] = 'latest'): ConfigFormFlow {
  return {
    version: 1,
    id: 'change',
    name: 'Change',
    concurrency,
    trigger: { kind: 'component.event', nodeId: 'name', event: 'change' },
    nodes: [
      { id: 'start', type: 'trigger' },
      { id: 'action', type: 'action', ref: 'work', config: { input: { $event: 'args.0' } } },
      { id: 'done', type: 'success' },
    ],
    edges: [
      { id: 'a', source: 'start', target: 'action', condition: 'next' },
      { id: 'b', source: 'action', target: 'done', condition: 'next' },
    ],
  }
}

function plan(input = flow()) {
  const result = analyzeConfigFormFlow(input)
  if (!result.success)
    throw new Error(JSON.stringify(result.diagnostics))
  return result.plan
}

describe('event runtime', () => {
  it('injects event arguments and transactional form access without sharing mutable input', async () => {
    let values = { name: 'Ada', nested: { untouched: true }, answer: '' }
    let context: ConfigFormFlowActionContext | undefined
    const runtime = createConfigFormEventRuntime({
      readValues: () => values,
      writeValues: (next) => { values = next as typeof values },
      actions: { get: () => ({ execute: (input, current) => {
        context = current
        expect(input).toEqual({ label: 'Lovelace' })
        ;(current.values.nested as { untouched: boolean }).untouched = false
        current.form.setValue('answer', (input as { label: string }).label)
      } }) },
    })
    runtime.sync([plan()])
    const args = [{ label: 'Lovelace' }]
    const trigger = flow().trigger
    const pending = runtime.dispatch({ trigger, event: { trigger, args, field: 'name' } })
    args[0]!.label = 'changed later'
    expect((await pending).status).toBe('committed')
    expect(values).toEqual({ name: 'Ada', nested: { untouched: true }, answer: 'Lovelace' })
    expect(context?.event.field).toBe('name')
    runtime.dispose()
  })

  it('commits before starting the next queued action and rebuilds stable context from current values', async () => {
    let values = { count: 0, note: '' }
    let release!: () => void
    const barrier = new Promise<void>((resolve) => {
      release = resolve
    })
    const started = vi.fn()
    const runtime = createConfigFormEventRuntime({
      readValues: () => values,
      writeValues: (next) => { values = next as typeof values },
      readValueContext: current => ({
        resolveField: nodeId => nodeId === 'count-node'
          ? { found: true, value: current.count }
          : { found: false },
      }),
      actions: { get: () => ({ execute: async (input, context) => {
        started(input)
        if (started.mock.calls.length === 1)
          await barrier
        context.form.setValue('count', Number(input) + 1)
      } }) },
    })
    const source = flow('queue')
    source.nodes[1]!.config = { input: { $ref: { kind: 'field', nodeId: 'count-node' } } }
    runtime.sync([plan(source)])
    const trigger = source.trigger
    const event = { trigger, args: [1] }
    const first = runtime.dispatch({ trigger, event })
    const second = runtime.dispatch({ trigger, event })
    await vi.waitFor(() => expect(started).toHaveBeenCalledTimes(1))
    values = { ...values, note: 'user edit' }
    release()
    await Promise.all([first, second])
    expect(started.mock.calls.map(([input]) => input)).toEqual([0, 1])
    expect(values).toEqual({ count: 2, note: 'user edit' })
    runtime.dispose()
  })

  it('isolates stable contexts when latest cancels an in-flight run', async () => {
    let values: Record<string, unknown> = { count: 1 }
    const started: unknown[] = []
    const runtime = createConfigFormEventRuntime({
      readValues: () => values,
      writeValues: (next) => { values = next },
      readValueContext: current => ({
        resolveField: nodeId => nodeId === 'count-node'
          ? { found: true, value: current.count }
          : { found: false },
      }),
      actions: { get: () => ({ execute: (input, context) => {
        started.push(input)
        if (input === 1)
          return new Promise(() => {})
        context.form.setValue('seen', input)
      } }) },
    })
    const source = flow('latest')
    source.nodes[1]!.config = { input: { $ref: { kind: 'field', nodeId: 'count-node' } } }
    runtime.sync([plan(source)])
    const trigger = source.trigger
    const first = runtime.dispatch({ trigger })
    await vi.waitFor(() => expect(started).toEqual([1]))
    values = { count: 2 }

    const second = runtime.dispatch({ trigger })

    await expect(first).resolves.toMatchObject({ status: 'aborted' })
    await expect(second).resolves.toMatchObject({ status: 'committed' })
    expect(started).toEqual([1, 2])
    expect(values).toEqual({ count: 2, seen: 2 })
    runtime.dispose()
  })

  it('isolates latest concurrency by stable row scope while preserving same-row policy', async () => {
    const releases = new Map<string, () => void>()
    const started: string[] = []
    const runtime = createConfigFormEventRuntime({
      readValues: () => ({}),
      writeValues: () => {},
      actions: { get: () => ({ execute: (_input, context) => new Promise<void>((resolve) => {
        const rowId = context.event.scope?.[0]?.rowId ?? 'root'
        started.push(rowId)
        releases.set(rowId, resolve)
      }) }) },
    })
    runtime.sync([plan(flow('latest'))])
    const trigger = flow().trigger
    const left = runtime.dispatch({
      trigger,
      event: { trigger, args: ['left'], scope: [{ scopeId: 'rows', rowId: 'left' }] },
    })
    const right = runtime.dispatch({
      trigger,
      event: { trigger, args: ['right'], scope: [{ scopeId: 'rows', rowId: 'right' }] },
    })
    await vi.waitFor(() => expect(started).toEqual(['left', 'right']))

    releases.get('right')?.()
    await expect(right).resolves.toMatchObject({ status: 'committed' })
    let leftSettled = false
    void left.then(() => { leftSettled = true })
    await Promise.resolve()
    expect(leftSettled).toBe(false)

    releases.get('left')?.()
    await expect(left).resolves.toMatchObject({ status: 'committed' })
    runtime.dispose()
  })

  it('settles active and queued work on disposal even when an action ignores cancellation', async () => {
    const started = vi.fn()
    const writeValues = vi.fn()
    const runtime = createConfigFormEventRuntime({
      readValues: () => ({}),
      writeValues,
      actions: { get: () => ({ execute: () => {
        started()
        return new Promise(() => {})
      } }) },
    })
    runtime.sync([plan(flow('queue'))])
    const trigger = flow().trigger
    const event = { trigger, args: [1] }
    const first = runtime.dispatch({ trigger, event })
    const second = runtime.dispatch({ trigger, event })
    await vi.waitFor(() => expect(started).toHaveBeenCalledOnce())
    runtime.dispose()
    expect((await first).status).toBe('stale')
    expect((await second).status).toBe('stale')
    expect(writeValues).not.toHaveBeenCalled()
  })

  it('reports missing event parameters and invalid expressions before invoking an action', async () => {
    const execute = vi.fn()
    const interpreter = new ConfigFormFlowInterpreter({ get: () => ({ execute }) })
    const input = flow()
    expect((await interpreter.run(input)).status).toBe('failure')
    input.nodes[1]!.config = { input: { $expression: '1 +' } }
    expect((await interpreter.run(input)).status).toBe('failure')
    expect(execute).not.toHaveBeenCalled()
  })

  it('rejects ambiguous exits and outgoing terminal edges at the authoring boundary', () => {
    const ambiguous = flow()
    ambiguous.edges.push({ id: 'duplicate', source: 'action', target: 'done' })
    const result = analyzeConfigFormFlow(ambiguous)
    expect(result.diagnostics.some(item => item.code === 'FLOW_EXIT_DUPLICATE')).toBe(true)
    ambiguous.edges.push({ id: 'terminal', source: 'done', target: 'start' })
    expect(analyzeConfigFormFlow(ambiguous).diagnostics.some(item => item.code === 'FLOW_EXIT_INVALID')).toBe(true)
  })

  it('snapshots portable event data and rejects cycles, unsafe keys and unsupported objects', () => {
    expect(snapshotConfigFormEventArgs([undefined, new Date('2026-09-12T00:00:00Z'), { value: [1, true] }]))
      .toEqual([null, '2026-09-12T00:00:00.000Z', { value: [1, true] }])
    const circular: Record<string, unknown> = {}
    circular.self = circular
    expect(() => snapshotConfigFormEventArgs([circular])).toThrow('circular')
    expect(() => snapshotConfigFormEventArgs([JSON.parse('{"__proto__":{}}')])).toThrow('Unsafe')
    expect(() => snapshotConfigFormEventArgs([() => {}])).toThrow('serializable')
    expect(() => snapshotConfigFormEventArgs([new Map()])).toThrow('unsupported')
  })
})
