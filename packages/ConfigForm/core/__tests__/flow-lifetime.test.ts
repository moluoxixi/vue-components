import type {
  ConfigFormFlow,
  ConfigFormFlowActionContext,
  ConfigFormFlowFormApi,
  ConfigFormFlowTransactionFactory,
  ConfigFormFlowValuePatch,
} from '../src/flow'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  analyzeConfigFormFlow,
  ConfigFormFlowInterpreter,
  createConfigFormEventRuntime,
} from '../src/flow'

function sequence(): ConfigFormFlow {
  return {
    version: 1,
    id: 'lifetime',
    name: 'Action lifetime',
    trigger: { kind: 'page.mount' },
    errorPolicy: { onError: 'failure', timeoutMs: 100 },
    nodes: [
      { id: 'start', type: 'trigger' },
      { id: 'first', type: 'action', ref: 'first', config: {}, policy: { onError: 'continue' } },
      { id: 'second', type: 'action', ref: 'second', config: {} },
      { id: 'done', type: 'success' },
    ],
    edges: [
      { id: 'start-first', source: 'start', target: 'first' },
      { id: 'first-second', source: 'first', target: 'second' },
      { id: 'second-done', source: 'second', target: 'done' },
    ],
  }
}

function plan(source: ConfigFormFlow) {
  const result = analyzeConfigFormFlow(source)
  if (!result.success)
    throw new Error(JSON.stringify(result.diagnostics))
  return result.plan
}

function transactionHost() {
  let values: Record<string, unknown> = { field: { count: 0 } }
  const runs: {
    values: Record<string, unknown>
    variables: Record<string, unknown>
    states: Record<string, unknown>
  }[] = []
  const commit = vi.fn((patch: ConfigFormFlowValuePatch) => {
    values = { ...values, ...patch.set }
    for (const key of patch.remove)
      delete values[key]
  })
  const createTransaction: ConfigFormFlowTransactionFactory = ({ values: local }) => {
    const variables: Record<string, unknown> = { flag: { count: 0 } }
    const states: Record<string, unknown> = {}
    runs.push({ values: local, variables, states })
    return {
      form: {
        getField: nodeId => local[nodeId],
        setField: (nodeId, value) => { local[nodeId] = value },
        getVariable: variableId => variables[variableId],
        setVariable: (variableId, value) => { variables[variableId] = value },
        setFieldState: (nodeId, state, value) => { states[`${nodeId}.${state}`] = value },
      },
      readValueContext: () => ({ fields: local, variables }),
      commit,
    }
  }
  return {
    readValues: () => values,
    writeValues: vi.fn((next: Record<string, unknown>) => { values = next }),
    createTransaction,
    commit,
    runs,
  }
}

function captureInactiveAccess(form: ConfigFormFlowFormApi): unknown[] {
  const { getValue, getValues, setValue, setValues, getField, setField, getVariable, setVariable, setFieldState } = form
  const calls = [
    () => setValue('late', true),
    () => setValues({ lateBatch: true }),
    () => setField!('field', { count: 99 }),
    () => setVariable!('flag', { count: 99 }),
    () => setFieldState!('field', 'readonly', true),
    () => getValue('field'),
    () => getValues(),
    () => getField!('field'),
    () => getVariable!('flag'),
  ]
  return calls.map((call) => {
    // Detached host work must capture its own synchronous capability errors.
    try {
      call()
      return undefined
    }
    catch (cause) {
      return cause
    }
  })
}

function expectInactive(errors: unknown[]) {
  expect(errors).toHaveLength(9)
  expect(errors).toEqual([
    'setValue',
    'setValues',
    'setField',
    'setVariable',
    'setFieldState',
    'getValue',
    'getValues',
    'getField',
    'getVariable',
  ].map(method => expect.objectContaining({ code: 'FLOW_ACTION_INACTIVE', nodeId: 'first', path: `form.${method}` })))
}

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function proxyData<T extends object>(value: T): T {
  return new Proxy(value, {
    get(target, property, receiver) {
      const current = Reflect.get(target, property, receiver)
      return current !== null && typeof current === 'object' ? proxyData(current) : current
    },
  })
}

afterEach(() => {
  vi.useRealTimers()
})

describe('action capability lifetime', () => {
  it('rejects the audit probe late write without a transaction adapter', async () => {
    vi.useFakeTimers()
    let values: Record<string, unknown> = { late: false }
    let lateError: unknown
    const source = sequence()
    source.nodes[1]!.policy!.timeoutMs = 5
    const runtime = createConfigFormEventRuntime({
      readValues: () => values,
      writeValues: (next) => { values = next },
      actions: { get: ref => ({ execute: async (_input, context) => {
        if (ref === 'second') {
          await wait(70)
          return 'downstream'
        }
        await wait(25)
        try {
          context.form.setValue('late', true)
        }
        catch (cause) {
          lateError = cause
          throw cause
        }
      } }) },
    })
    runtime.sync([plan(source)])
    const pending = runtime.dispatch({ trigger: source.trigger })
    await vi.advanceTimersByTimeAsync(75)
    const result = await pending
    expect(result.status).toBe('committed')
    expect(values).toEqual({ late: false })
    expect(lateError).toMatchObject({ code: 'FLOW_ACTION_INACTIVE', nodeId: 'first', path: 'form.setValue' })
    expect(result.results[0]?.outputs).toEqual({ second: 'downstream' })
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: 'FLOW_TIMEOUT' }))
    runtime.dispose()
  })

  it.each(['timeout', 'rejection', 'success', 'microtask-success', 'microtask-failure'] as const)(
    'rejects retained root and transaction access after %s without contaminating downstream work',
    async (mode) => {
      vi.useFakeTimers()
      const host = transactionHost()
      let retained!: ConfigFormFlowActionContext
      let errors: unknown[] = []
      const source = sequence()
      if (mode === 'timeout')
        source.nodes[1]!.policy!.timeoutMs = 5
      const runtime = createConfigFormEventRuntime({
        ...host,
        actions: { get: ref => ({ execute: asyncAction(ref) }) },
      })
      function asyncAction(ref: string) {
        if (ref === 'second') {
          return async (_input: unknown, context: ConfigFormFlowActionContext) => {
            await wait(70)
            context.form.setValue('second', context.form.getValue('first'))
            return 'downstream'
          }
        }
        return (_input: unknown, context: ConfigFormFlowActionContext) => {
          retained = context
          context.form.setValue('first', true)
          const late = () => {
            errors = captureInactiveAccess(context.form)
          }
          if (mode === 'timeout') {
            return wait(25).then(() => {
              late()
              throw new Error('late action rejection')
            })
          }
          if (mode.startsWith('microtask'))
            queueMicrotask(late)
          else
            setTimeout(late, 25)
          if (mode === 'microtask-failure')
            throw new Error('expected failure')
          if (mode === 'rejection')
            return Promise.reject(new Error('expected failure'))
          return 'upstream'
        }
      }
      runtime.sync([plan(source)])
      const pending = runtime.dispatch({ trigger: source.trigger })
      await vi.advanceTimersByTimeAsync(25)
      expectInactive(errors)
      expect(retained.signal.aborted).toBe(true)
      expect(host.runs[0]).toEqual({
        values: { field: { count: 0 }, first: true },
        variables: { flag: { count: 0 } },
        states: {},
      })
      await vi.advanceTimersByTimeAsync(70)
      const result = await pending
      expect(result.status).toBe('committed')
      expect(result.results[0]?.outputs.second).toBe('downstream')
      expect(result.valuePatch).toEqual({ remove: [], set: { first: true, second: true } })
      expect(host.readValues()).toEqual({ field: { count: 0 }, first: true, second: true })
      expect(host.commit).toHaveBeenCalledExactlyOnceWith(result.valuePatch)
      if (mode === 'timeout') {
        expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: 'FLOW_TIMEOUT', nodeId: 'first' }))
        expect(result.results[0]?.outputs).not.toHaveProperty('first')
      }
      if (mode === 'rejection' || mode === 'microtask-failure') {
        expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: 'FLOW_NODE_ERROR', message: 'expected failure' }))
        expect(result.results[0]?.outputs).not.toHaveProperty('first')
      }
      expectInactive(captureInactiveAccess(retained.form))
      expect(host.readValues()).not.toHaveProperty('late')
      runtime.dispose()
    },
  )

  it.each(['external', 'dispose', 'sync', 'latest'] as const)(
    'revokes retained access on %s and leaves the next successful run clean',
    async (mode) => {
      const host = transactionHost()
      const source = sequence()
      let retained!: ConfigFormFlowActionContext
      let started!: () => void
      const start = new Promise<void>((resolve) => {
        started = resolve
      })
      const actions = { get: () => ({ execute: (_input: unknown, context: ConfigFormFlowActionContext) => {
        if (!retained) {
          retained = context
          started()
          return new Promise(() => {})
        }
        context.form.setValue('fresh', true)
      } }) }
      let runtime = createConfigFormEventRuntime({ ...host, actions })
      runtime.sync([plan(source)])
      const controller = new AbortController()
      const pending = runtime.dispatch({ trigger: source.trigger, signal: controller.signal })
      await start
      let abortErrors: unknown[] = []
      retained.signal.addEventListener('abort', () => {
        abortErrors = captureInactiveAccess(retained.form)
      })
      let next: ReturnType<typeof runtime.dispatch> | undefined
      if (mode === 'external')
        controller.abort()
      else if (mode === 'dispose')
        runtime.dispose()
      else if (mode === 'sync')
        runtime.sync([plan(source)])
      else
        next = runtime.dispatch({ trigger: source.trigger })
      expectInactive(abortErrors)
      expectInactive(captureInactiveAccess(retained.form))
      expect((await pending).status).toBe(mode === 'latest' ? 'aborted' : 'stale')
      expect(host.runs[0]).toEqual({
        values: { field: { count: 0 } },
        variables: { flag: { count: 0 } },
        states: {},
      })
      if (mode === 'dispose') {
        runtime = createConfigFormEventRuntime({ ...host, actions })
        runtime.sync([plan(source)])
      }
      next ??= runtime.dispatch({ trigger: source.trigger })
      expect((await next).status).toBe('committed')
      expect(host.commit).toHaveBeenCalledExactlyOnceWith({ remove: [], set: { fresh: true } })
      expect(host.readValues()).toEqual({ field: { count: 0 }, fresh: true })
      runtime.dispose()
    },
  )

  it('preserves active transaction reads, defensive copies and internal output mapping', async () => {
    const host = transactionHost()
    const source = sequence()
    source.nodes[1]!.policy = { onError: 'failure' }
    source.nodes[1]!.config = { output: { mapped: { $output: 'first' } } }
    source.nodes[2]!.config = { input: {
      field: { $ref: { kind: 'field', nodeId: 'field' } },
      variable: { $ref: { kind: 'variable', variableId: 'flag' } },
      output: { $ref: { kind: 'output', stepId: 'first' } },
    } }
    let retained!: ConfigFormFlowActionContext
    const runtime = createConfigFormEventRuntime({
      ...host,
      actions: { get: ref => ({ execute: async (input, context) => {
        if (ref === 'first') {
          retained = context
          expect(context.signal.aborted).toBe(false)
          const field = { count: 1 }
          const variable = { count: 2 }
          context.form.setField!('field', field)
          context.form.setVariable!('flag', variable)
          context.form.setFieldState!('field', 'readonly', false)
          context.form.setValues({ root: 'active' })
          field.count = 99
          variable.count = 99
          ;(context.form.getField!('field') as { count: number }).count = 99
          ;(context.form.getVariable!('flag') as { count: number }).count = 99
          await Promise.resolve()
          expect(context.form.getValues()).toEqual({ field: { count: 1 }, root: 'active' })
          expect(context.form.getField!('field')).toEqual({ count: 1 })
          expect(context.form.getVariable!('flag')).toEqual({ count: 2 })
          return { ok: true }
        }
        expectInactive(captureInactiveAccess(retained.form))
        expect(input).toEqual({ field: { count: 1 }, variable: { count: 2 }, output: { ok: true } })
        expect(context.form.getValue('mapped')).toEqual({ ok: true })
        context.form.setValue('downstream', true)
        return input
      } }) },
    })
    runtime.sync([plan(source)])
    const result = await runtime.dispatch({ trigger: source.trigger })
    expect(result.status).toBe('committed')
    expect(host.readValues()).toEqual({ field: { count: 1 }, root: 'active', mapped: { ok: true }, downstream: true })
    expect(host.runs[0]?.variables).toEqual({ flag: { count: 2 } })
    expect(host.runs[0]?.states).toEqual({ 'field.readonly': false })
    expect(result.results[0]?.outputs.second).toEqual({ field: { count: 1 }, variable: { count: 2 }, output: { ok: true } })
    runtime.dispose()
  })
})

describe('proxyable Flow data', () => {
  it('analyzes proxy-only JSON graphs without structuredClone on any graph fragments', () => {
    const source = sequence()
    source.nodes[1]!.config = { input: { nested: ['data', { enabled: true }] } }
    const proxied = proxyData(source)
    expect(() => structuredClone(proxied.trigger)).toThrow()
    const actual = analyzeConfigFormFlow(proxied)
    expect(actual).toEqual(analyzeConfigFormFlow(source))
    if (!actual.success)
      throw new Error(JSON.stringify(actual.diagnostics))
    expect(() => structuredClone(actual.plan)).not.toThrow()
    source.trigger.kind = 'form.submit'
    source.nodes[1]!.config!.input = 'changed'
    expect(actual.plan.trigger.kind).toBe('page.mount')
    expect(actual.plan.nodes[1]?.config?.input).toEqual({ nested: ['data', { enabled: true }] })
  })

  it('runs and dispatches proxy-only plans with nested policies and output mappings', async () => {
    const source = sequence()
    source.nodes[1]!.policy = { when: { kind: 'literal', value: true }, timeoutMs: 50 }
    source.nodes[1]!.config = { input: { nested: ['data'] }, output: { mapped: { $output: 'first' } } }
    source.nodes[2]!.config = { input: { $field: 'mapped' } }
    const proxied = proxyData(plan(source))
    const actions = { get: () => ({ execute: (input: unknown, context: ConfigFormFlowActionContext) => {
      expect(context.form.setField).toBeUndefined()
      expect(context.flow.errorPolicy).toEqual({ onError: 'failure', timeoutMs: 100 })
      return input
    } }) }
    expect((await new ConfigFormFlowInterpreter(actions).run(proxied)).values).toEqual({ mapped: { nested: ['data'] } })
    let values: Record<string, unknown> = {}
    const runtime = createConfigFormEventRuntime({
      actions,
      readValues: () => values,
      writeValues: (next) => { values = next },
    })
    runtime.sync([proxied])
    const result = await runtime.dispatch({ trigger: proxied.trigger })
    expect(result.status).toBe('committed')
    expect(values).toEqual({ mapped: { nested: ['data'] } })
    runtime.dispose()
  })
})
