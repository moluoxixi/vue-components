import type {
  ConfigFormFlow,
  ConfigFormFlowActionContext,
  ConfigFormFlowTransactionFactory,
} from '../src/flow'
import { describe, expect, it, vi } from 'vitest'
import {
  analyzeConfigFormFlow,
  cloneConfigFormFlowData,
  CONFIG_FORM_FLOW_MAX_STRUCTURE_DEPTH,
  CONFIG_FORM_FLOW_MAX_STRUCTURE_ENTRIES,
  ConfigFormFlowInterpreter,
  createConfigFormEventRuntime,
  createConfigFormFlowFormApi,
  resolveConfigFormFlowInput,
  snapshotConfigFormEventArgs,
} from '../src/flow'

function sequence(): ConfigFormFlow {
  return {
    version: 1,
    id: 'data-boundaries',
    name: 'Data boundaries',
    trigger: { kind: 'page.mount' },
    nodes: [
      { id: 'start', type: 'trigger' },
      { id: 'first', type: 'action', ref: 'first', config: { output: { mapped: { $output: 'first' } } } },
      { id: 'second', type: 'action', ref: 'second', config: { input: { $output: 'first' } } },
      { id: 'done', type: 'success' },
    ],
    edges: [
      { id: 'start-first', source: 'start', target: 'first' },
      { id: 'first-second', source: 'first', target: 'second' },
      { id: 'second-done', source: 'second', target: 'done' },
    ],
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((accept) => {
    resolve = accept
  })
  return { promise, resolve }
}

function nestedTransaction(commit = vi.fn()) {
  const createTransaction: ConfigFormFlowTransactionFactory = ({ values: local }) => ({
    form: {
      getField: () => (local.profile as { name: string }).name,
      setField: (_nodeId, value) => {
        ;(local.profile as { name: string }).name = value as string
        ;(local.rows as { count: number }[])[0]!.count += 1
      },
      getVariable: () => undefined,
      setVariable: () => {},
      setFieldState: () => {},
    },
    commit,
  })
  return { createTransaction, commit }
}

function unsafeDataCases(): { name: string, code: string, create: () => unknown }[] {
  return [
    ...['__proto__', 'constructor', 'prototype'].map(key => ({
      name: key,
      code: 'FLOW_DATA_KEY_INVALID',
      create: () => ({ nested: { [key]: true } }),
    })),
    { name: 'function', code: 'FLOW_DATA_UNSUPPORTED', create: () => ({ nested: () => {} }) },
    { name: 'non-finite number', code: 'FLOW_DATA_NON_FINITE', create: () => ({ nested: Number.NaN }) },
    { name: 'unsupported object', code: 'FLOW_DATA_OBJECT_UNSUPPORTED', create: () => new Map() },
    {
      name: 'cycle',
      code: 'FLOW_DATA_CIRCULAR',
      create: () => {
        const value: Record<string, unknown> = {}
        value.self = value
        return value
      },
    },
    {
      name: 'depth limit',
      code: 'FLOW_STRUCTURE_LIMIT_EXCEEDED',
      create: () => Array.from({ length: CONFIG_FORM_FLOW_MAX_STRUCTURE_DEPTH + 1 }).reduce<unknown>(value => [value], 0),
    },
    {
      name: 'entry limit',
      code: 'FLOW_STRUCTURE_LIMIT_EXCEEDED',
      create: () => Array.from({ length: CONFIG_FORM_FLOW_MAX_STRUCTURE_ENTRIES + 1 }).fill(0),
    },
    {
      name: 'unreadable proxy',
      code: 'FLOW_DATA_UNREADABLE',
      create: () => new Proxy({}, { ownKeys: () => { throw new Error('unreadable payload') } }),
    },
  ]
}

describe('transaction input isolation', () => {
  it.each(['failure', 'blocked', 'cancel'] as const)('isolates the audit probe nested mutation on %s before any commit', async (mode) => {
    const original = { profile: { name: 'Ada' }, rows: [{ count: 1 }] }
    const host = nestedTransaction()
    const started = deferred<void>()
    const controller = new AbortController()
    const source = sequence()
    if (mode === 'blocked') {
      source.nodes[1]!.policy = { stopWhen: { kind: 'literal', value: true } }
      source.nodes[2]!.config = {}
    }
    const interpreter = new ConfigFormFlowInterpreter({ get: () => ({ execute: (_input, context) => {
      context.form.setField!('name', 'Grace')
      started.resolve()
      if (mode === 'failure')
        throw new Error('expected failure')
      if (mode === 'cancel')
        return new Promise(() => {})
    } }) })
    const pending = interpreter.run(source, { values: original, ...host, signal: controller.signal })
    await started.promise
    expect(original).toEqual({ profile: { name: 'Ada' }, rows: [{ count: 1 }] })
    if (mode === 'cancel')
      controller.abort()
    const result = await pending
    expect(result.status).toBe(mode === 'cancel' ? 'aborted' : mode)
    expect(result.values.profile).toEqual({ name: 'Grace' })
    expect(result.values.rows).toEqual([{ count: 2 }])
    expect(original).toEqual({ profile: { name: 'Ada' }, rows: [{ count: 1 }] })
    expect(host.commit).not.toHaveBeenCalled()
  })

  it.each(['failure', 'cancel'] as const)('does not publish a nested transaction mutation after runtime %s', async (mode) => {
    const original = { profile: { name: 'Ada' }, rows: [{ count: 1 }] }
    const host = nestedTransaction()
    const started = deferred<void>()
    const source = sequence()
    const analyzed = analyzeConfigFormFlow(source)
    if (!analyzed.success)
      throw new Error(JSON.stringify(analyzed.diagnostics))
    const runtime = createConfigFormEventRuntime({
      ...host,
      readValues: () => original,
      writeValues: vi.fn(),
      actions: { get: () => ({ execute: (_input, context) => {
        context.form.setField!('name', 'Grace')
        started.resolve()
        if (mode === 'failure')
          throw new Error('expected failure')
        return new Promise(() => {})
      } }) },
    })
    runtime.sync([analyzed.plan])
    const pending = runtime.dispatch({ trigger: source.trigger })
    await started.promise
    if (mode === 'cancel')
      runtime.dispose()
    expect((await pending).status).toBe(mode === 'cancel' ? 'stale' : 'failure')
    expect(original).toEqual({ profile: { name: 'Ada' }, rows: [{ count: 1 }] })
    expect(host.commit).not.toHaveBeenCalled()
    runtime.dispose()
  })

  it('commits changed nested roots without overwriting concurrent edits to untouched roots', async () => {
    let values = { profile: { name: 'Ada' }, rows: [{ count: 1 }], note: { text: 'initial' } }
    const started = deferred<void>()
    const release = deferred<void>()
    const host = nestedTransaction(vi.fn((patch) => {
      values = { ...values, ...patch.set }
    }))
    const source = sequence()
    const analyzed = analyzeConfigFormFlow(source)
    if (!analyzed.success)
      throw new Error(JSON.stringify(analyzed.diagnostics))
    const runtime = createConfigFormEventRuntime({
      ...host,
      readValues: () => values,
      writeValues: vi.fn(),
      actions: { get: ref => ({ execute: async (_input, context) => {
        if (ref === 'first') {
          context.form.setField!('name', 'Grace')
          started.resolve()
          await release.promise
        }
      } }) },
    })
    runtime.sync([analyzed.plan])
    const pending = runtime.dispatch({ trigger: source.trigger })
    await started.promise
    values.note.text = 'concurrent edit'
    release.resolve()
    const result = await pending
    expect(result.status).toBe('committed')
    expect(result.valuePatch.set).toEqual({ profile: { name: 'Grace' }, rows: [{ count: 2 }], mapped: undefined })
    expect(host.commit).toHaveBeenCalledExactlyOnceWith(result.valuePatch)
    expect(values).toEqual({ profile: { name: 'Grace' }, rows: [{ count: 2 }], note: { text: 'concurrent edit' }, mapped: undefined })
    runtime.dispose()
  })

  it.each(unsafeDataCases())('rejects unsafe initial values before creating a transaction: $name', async ({ create, code }) => {
    const createTransaction = vi.fn(nestedTransaction().createTransaction)
    const execute = vi.fn()
    const result = await new ConfigFormFlowInterpreter({ get: () => ({ execute }) }).run(sequence(), {
      values: { payload: create() },
      createTransaction,
    })
    expect(result.status).toBe('failure')
    expect(result.error).toMatchObject({ code })
    expect(JSON.parse(JSON.stringify(result.diagnostics))).toEqual([result.error])
    expect(createTransaction).not.toHaveBeenCalled()
    expect(execute).not.toHaveBeenCalled()
  })
})

describe('action return acceptance', () => {
  it.each(['synchronous', 'asynchronous'] as const)('snapshots %s output when observed, before queued mutation and abort listeners', async (mode) => {
    const output = { n: 0, nested: [{ n: 0 }] }
    const started = deferred<void>()
    const release = deferred<typeof output>()
    const seen = vi.fn()
    const mutate = () => {
      output.n = 1
      output.nested[0]!.n = 1
    }
    const interpreter = new ConfigFormFlowInterpreter({ get: ref => ({ execute: (input, context) => {
      if (ref === 'second') {
        seen(input, context.form.getValue('mapped'), context.outputs.first)
        return input
      }
      context.signal.addEventListener('abort', mutate)
      started.resolve()
      if (mode === 'synchronous') {
        queueMicrotask(mutate)
        return output
      }
      return release.promise
    } }) })
    const pending = interpreter.run(sequence())
    await started.promise
    if (mode === 'asynchronous') {
      release.resolve(output)
      queueMicrotask(mutate)
    }
    const result = await pending
    const expected = { n: 0, nested: [{ n: 0 }] }
    expect(result.status).toBe('success')
    expect(output).toEqual({ n: 1, nested: [{ n: 1 }] })
    expect(result.outputs).toEqual({ first: expected, second: expected })
    expect(result.values.mapped).toEqual(expected)
    expect(seen).toHaveBeenCalledExactlyOnceWith(expected, expected, expected)
    expect(result.trace.find(event => event.nodeId === 'first' && event.type === 'exit')?.output).toEqual(expected)
  })

  it.each(['synchronous', 'asynchronous'] as const)('preserves explicit undefined %s outputs and mappings', async (mode) => {
    const source = sequence()
    const interpreter = new ConfigFormFlowInterpreter({ get: () => ({ execute: () => mode === 'asynchronous' ? Promise.resolve(undefined) : undefined }) })
    const result = await interpreter.run(source)
    expect(result.status).toBe('success')
    expect(Object.hasOwn(result.outputs, 'first')).toBe(true)
    expect(result.outputs.first).toBeUndefined()
    expect(Object.hasOwn(result.values, 'mapped')).toBe(true)
    expect(result.values.mapped).toBeUndefined()
  })

  it.each(['duplicate-resolve', 'duplicate-reject', 'resolve-reject', 'throw', 'resolve-throw', 'nested', 'self-cycle', 'throwing-getter'] as const)(
    'rejects custom thenables without adopting them: %s',
    async (mode) => {
      let retained!: ConfigFormFlowActionContext
      let lateError: unknown
      let thenable: object
      const nestedThen = vi.fn()
      const then = vi.fn((resolve: (value: unknown) => void, reject: (reason: unknown) => void) => {
        if (mode === 'throw')
          throw new Error('then failed')
        if (mode === 'duplicate-reject') {
          reject(new Error('first rejection'))
          reject(new Error('second rejection'))
          return
        }
        resolve(mode === 'self-cycle' ? thenable : mode === 'nested' ? { then: nestedThen } : { n: 0 })
        if (mode === 'duplicate-resolve')
          resolve({ n: 1 })
        if (mode === 'resolve-reject')
          reject(new Error('late rejection'))
        if (mode === 'resolve-throw')
          throw new Error('late throw')
        retained.form.setValue('thenableWrite', true)
      })
      const getter = vi.fn(() => {
        throw new Error('bad then getter')
      })
      thenable = mode === 'throwing-getter' ? Object.defineProperty({}, 'then', { get: getter }) : { then }
      const interpreter = new ConfigFormFlowInterpreter({ get: () => ({ execute: (_input, context) => {
        retained = context
        queueMicrotask(() => {
          try {
            context.form.setValue('late', true)
          }
          catch (cause) {
            lateError = cause
          }
        })
        return thenable
      } }) })
      const result = await interpreter.run(sequence())
      expect(result.status).toBe('failure')
      expect(result.error).toMatchObject({ code: 'FLOW_ACTION_THENABLE_UNSUPPORTED', nodeId: 'first' })
      expect(then).not.toHaveBeenCalled()
      expect(nestedThen).not.toHaveBeenCalled()
      expect(getter).toHaveBeenCalledTimes(mode === 'throwing-getter' ? 1 : 0)
      expect(retained.signal.aborted).toBe(true)
      expect(lateError).toMatchObject({ code: 'FLOW_ACTION_INACTIVE', path: 'form.setValue' })
      expect(result.values).toEqual({})
      expect(result.outputs).toEqual({})
    },
  )

  it('keeps native Promise access active until runtime observation, then rejects retained writes', async () => {
    let retained!: ConfigFormFlowActionContext
    let lateError: unknown
    const interpreter = new ConfigFormFlowInterpreter({ get: ref => ({ execute: (_input, context) => {
      if (ref === 'second')
        return undefined
      retained = context
      const result = Promise.resolve({ n: 0 })
      // This microtask precedes registration of the runtime observer on result.
      queueMicrotask(() => context.form.setValue('beforeObservation', true))
      context.signal.addEventListener('abort', () => {
        try {
          context.form.setValue('afterObservation', true)
        }
        catch (cause) {
          lateError = cause
        }
      })
      return result
    } }) })
    const result = await interpreter.run(sequence())
    expect(result.status).toBe('success')
    expect(result.values).toEqual({ beforeObservation: true, mapped: { n: 0 } })
    expect(lateError).toMatchObject({ code: 'FLOW_ACTION_INACTIVE', nodeId: 'first' })
    expect(() => retained.form.setValue('retained', true)).toThrow(expect.objectContaining({ code: 'FLOW_ACTION_INACTIVE' }))
  })

  it('allows writes after a legitimate await and observes native promises without invoking an overridden then', async () => {
    const then = vi.fn()
    const interpreter = new ConfigFormFlowInterpreter({ get: ref => ({ execute: (_input, context) => {
      if (ref === 'second')
        return undefined
      const result = (async () => {
        await Promise.resolve()
        context.form.setValue('afterAwait', true)
        return { n: 0 }
      })()
      Object.defineProperty(result, 'then', { value: then })
      return result
    } }) })
    const result = await interpreter.run(sequence())
    expect(result.status).toBe('success')
    expect(result.values).toEqual({ afterAwait: true, mapped: { n: 0 } })
    expect(then).not.toHaveBeenCalled()
  })

  it.each(unsafeDataCases().flatMap(test => [false, true].map(async => ({ ...test, async }))))('reports rejected action output data instead of hanging: $name, async=$async', async ({ create, code, async }) => {
    let retained!: ConfigFormFlowActionContext
    const result = await new ConfigFormFlowInterpreter({ get: () => ({ execute: (_input, context) => {
      retained = context
      const value = create()
      return async ? Promise.resolve(value) : value
    } }) }).run(sequence())
    expect(result.status).toBe('failure')
    expect(result.error).toMatchObject({ code, nodeId: 'first' })
    expect(result.outputs).toEqual({})
    expect(result.values).toEqual({})
    expect(retained.signal.aborted).toBe(true)
  })
})

describe('flow JSON keys and analysis diagnostics', () => {
  it.each(['literal', 'ordinary'] as const)('roundtrips empty object keys in %s JSON through analysis, execution and event snapshots', async (mode) => {
    const data = { '': 1, 'nested': [{ '': 2 }], 'then': 'JSON data' }
    const source = sequence()
    source.nodes[1]!.config!.input = mode === 'literal' ? { $ref: { kind: 'literal', value: data } } : data
    const analyzed = analyzeConfigFormFlow(source)
    expect(analyzed.success).toBe(true)
    if (!analyzed.success)
      throw new Error(JSON.stringify(analyzed.diagnostics))
    expect(analyzeConfigFormFlow(JSON.parse(JSON.stringify(analyzed.flow)))).toEqual(analyzed)
    const result = await new ConfigFormFlowInterpreter({ get: () => ({ execute: input => input }) }).run(analyzed.plan)
    expect(result.status).toBe('success')
    expect(result.outputs.first).toEqual(data)
    expect(result.values.mapped).toEqual(data)
    expect(snapshotConfigFormEventArgs([data])).toEqual([data])
    const cloned = cloneConfigFormFlowData(data)
    data.nested[0]![''] = 99
    expect(cloned.nested).toEqual([{ '': 2 }])
    expect(result.outputs.first).toEqual({ '': 1, 'nested': [{ '': 2 }], 'then': 'JSON data' })
  })

  it.each(['', '__proto__', 'constructor', 'prototype'])('still rejects invalid field identifiers: %s', (field) => {
    const source = sequence()
    source.nodes[1]!.config = { output: { [field]: 1 } }
    expect(analyzeConfigFormFlow(source).diagnostics).toContainEqual(expect.objectContaining({
      code: field === '' ? 'FLOW_ACTION_OUTPUT_FIELD_INVALID' : 'FLOW_UNSAFE_KEY',
    }))
    const form = createConfigFormFlowFormApi({})
    expect(() => form.setValue(field, 1)).toThrow(expect.objectContaining({ code: 'FLOW_DATA_KEY_INVALID' }))
    expect(() => resolveConfigFormFlowInput({ $field: field }, {}, {}, { trigger: source.trigger, args: [] }))
      .toThrow(expect.objectContaining({ code: 'FLOW_DATA_KEY_INVALID' }))
  })

  it.each(['__proto__', 'constructor', 'prototype'])('rejects dangerous literal keys with diagnostics: %s', (key) => {
    const source = sequence()
    source.nodes[1]!.config!.input = { $ref: { kind: 'literal', value: { [key]: 1 } } }
    const analyzed = analyzeConfigFormFlow(source)
    expect(analyzed.success).toBe(false)
    expect(analyzed.diagnostics).toContainEqual(expect.objectContaining({ code: 'FLOW_UNSAFE_KEY' }))
    expect(() => cloneConfigFormFlowData({ [key]: 1 })).toThrow(expect.objectContaining({ code: 'FLOW_DATA_KEY_INVALID' }))
    expect(() => snapshotConfigFormEventArgs([{ [key]: 1 }])).toThrow(expect.objectContaining({ code: 'FLOW_EVENT_UNSAFE_KEY' }))
  })

  it.each([() => new Map(), () => () => {}, () => Number.NaN])('returns analysis diagnostics for unsupported literal values', (create) => {
    const source = sequence()
    source.nodes[1]!.config!.input = { $ref: { kind: 'literal', value: create() as never } }
    const result = analyzeConfigFormFlow(source)
    expect(result.success).toBe(false)
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: 'FLOW_NON_JSON' }))
  })

  it.each(['inspection', 'cloning'] as const)('converts unreadable graph %s into diagnostics rather than throwing', (stage) => {
    const source = sequence()
    let reads = 0
    source.trigger = new Proxy(source.trigger, {
      getPrototypeOf: (target) => {
        reads += 1
        if (stage === 'inspection' || reads > 1)
          throw new Error('graph cannot be read')
        return Reflect.getPrototypeOf(target)
      },
    })
    const result = analyzeConfigFormFlow(source)
    expect(result.success).toBe(false)
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: 'FLOW_DATA_UNREADABLE', message: 'graph cannot be read' }))
  })
})
