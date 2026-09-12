import type {
  ConfigFormFlow,
  ConfigFormFlowAction,
  ConfigFormFlowExecutionPlan,
  ConfigFormFlowNodePolicy,
  ConfigFormFlowTriggerKind,
} from '../src/flow'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  analyzeConfigFormFlow,
  CONFIG_FORM_FLOW_DEFAULT_TIMEOUT_MS,
  CONFIG_FORM_FLOW_MAX_QUEUE_SIZE,
  CONFIG_FORM_FLOW_MAX_REENTRANT_RUNS,
  CONFIG_FORM_FLOW_TRIGGER_KINDS,
  ConfigFormFlowActionError,
  ConfigFormFlowInterpreter,
  createConfigFormBuiltinFlowActions,
  createConfigFormEventRuntime,
  createConfigFormFlowActionRegistry,
  listConfigFormBuiltinFlowActionDescriptors,
} from '../src/flow'

function flow(
  nodes: ConfigFormFlow['nodes'],
  edges: ConfigFormFlow['edges'],
  overrides: Partial<ConfigFormFlow> = {},
): ConfigFormFlow {
  return {
    version: 1,
    id: 'policy-flow',
    name: 'Policy flow',
    trigger: { kind: 'form.beforeSubmit' },
    nodes,
    edges,
    ...overrides,
  }
}

function actionFlow(
  policy?: ConfigFormFlowNodePolicy,
  overrides: Partial<ConfigFormFlow> = {},
): ConfigFormFlow {
  return flow(
    [
      { id: 'start', type: 'trigger' },
      { id: 'act', type: 'action', ref: 'work', config: { input: { $field: 'name' } }, ...(policy ? { policy } : {}) },
      { id: 'done', type: 'success' },
    ],
    [
      { id: 'start-act', source: 'start', target: 'act' },
      { id: 'act-done', source: 'act', target: 'done' },
    ],
    overrides,
  )
}

function plan(source: ConfigFormFlow): ConfigFormFlowExecutionPlan {
  const result = analyzeConfigFormFlow(source)
  if (!result.success)
    throw new Error(JSON.stringify(result.diagnostics))
  return result.plan
}

function registry(actions: Record<string, ConfigFormFlowAction>) {
  return createConfigFormFlowActionRegistry(actions)
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('flow product kernel policies', () => {
  it('exports the complete frozen lifecycle trigger catalog', () => {
    expect(CONFIG_FORM_FLOW_TRIGGER_KINDS).toEqual([
      'form.initialize',
      'page.mount',
      'page.unmount',
      'form.valuesChange',
      'form.beforeSubmit',
      'form.validationSuccess',
      'form.validationFailure',
      'form.reset',
      'form.submit',
      'component.event',
    ])

    for (const kind of CONFIG_FORM_FLOW_TRIGGER_KINDS) {
      const source = flow(
        [{ id: 'start', type: 'trigger' }, { id: 'done', type: 'end' }],
        [{ id: 'next', source: 'start', target: 'done' }],
        {
          id: `flow-${kind}`,
          trigger: kind === 'component.event'
            ? { kind, nodeId: 'button', event: 'click' }
            : { kind: kind as ConfigFormFlowTriggerKind },
        },
      )
      expect(analyzeConfigFormFlow(source).success).toBe(true)
    }
  })

  it('skips an action whose policy.when is false without resolving its input', async () => {
    const execute = vi.fn()
    const source = actionFlow({ when: { kind: 'literal', value: false } })

    const result = await new ConfigFormFlowInterpreter(registry({ work: { execute } })).run(source)

    expect(result.status).toBe('success')
    expect(execute).not.toHaveBeenCalled()
    expect(result.trace.find(event => event.nodeId === 'act' && event.type === 'exit'))
      .toMatchObject({ output: { skipped: true } })
  })

  it('commits completed writes and stops later matching flows when stopWhen blocks', async () => {
    let values: Record<string, unknown> = { accepted: false }
    const later = vi.fn()
    const first = flow(
      [
        { id: 'start', type: 'trigger' },
        {
          id: 'write',
          type: 'action',
          ref: 'write',
          config: {},
          policy: { stopWhen: { kind: 'literal', value: true } },
        },
        { id: 'done', type: 'success' },
      ],
      [
        { id: 'start-write', source: 'start', target: 'write' },
        { id: 'write-done', source: 'write', target: 'done' },
      ],
      { id: 'first' },
    )
    const second = flow(
      [
        { id: 'start', type: 'trigger' },
        { id: 'later', type: 'action', ref: 'later', config: {} },
        { id: 'done', type: 'success' },
      ],
      [
        { id: 'start-later', source: 'start', target: 'later' },
        { id: 'later-done', source: 'later', target: 'done' },
      ],
      { id: 'second' },
    )
    const runtime = createConfigFormEventRuntime({
      actions: registry({
        write: { execute: (_input, context) => context.form.setValue('accepted', true) },
        later: { execute: later },
      }),
      readValues: () => values,
      writeValues: (next) => { values = next },
    })
    runtime.sync([plan(first), plan(second)])

    const result = await runtime.dispatch({ trigger: first.trigger })

    expect(result.status).toBe('blocked')
    expect(result.results).toHaveLength(1)
    expect(result.valuePatch.set).toEqual({ accepted: true })
    expect(values).toEqual({ accepted: true })
    expect(later).not.toHaveBeenCalled()
    runtime.dispose()
  })

  it('supports an explicit blocked terminal', async () => {
    const source = flow(
      [{ id: 'start', type: 'trigger' }, { id: 'stop', type: 'blocked' }],
      [{ id: 'next', source: 'start', target: 'stop' }],
    )

    await expect(new ConfigFormFlowInterpreter().run(source)).resolves.toMatchObject({ status: 'blocked' })
  })

  it('continues after a node error while preserving its original diagnostic', async () => {
    const after = vi.fn()
    const source = flow(
      [
        { id: 'start', type: 'trigger' },
        { id: 'fail', type: 'action', ref: 'fail', config: {}, policy: { onError: 'continue' } },
        { id: 'after', type: 'action', ref: 'after', config: {} },
        { id: 'done', type: 'success' },
      ],
      [
        { id: 'start-fail', source: 'start', target: 'fail' },
        { id: 'fail-after', source: 'fail', target: 'after' },
        { id: 'after-done', source: 'after', target: 'done' },
      ],
    )
    const interpreter = new ConfigFormFlowInterpreter(registry({
      fail: { execute: () => { throw new ConfigFormFlowActionError('CUSTOM_ACTION_FAILED', 'custom failure', 'config.input.token') } },
      after: { execute: after },
    }))

    const result = await interpreter.run(source)

    expect(result.status).toBe('success')
    expect(result.error).toBeUndefined()
    expect(after).toHaveBeenCalledOnce()
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: 'CUSTOM_ACTION_FAILED',
      path: 'config.input.token',
      nodeId: 'fail',
    }))
  })

  it('uses node timeout before flow timeout and applies the 10000ms default', async () => {
    vi.useFakeTimers()
    const hanging = { execute: () => new Promise(() => {}) }
    const interpreter = new ConfigFormFlowInterpreter(registry({ work: hanging }))

    const nodeTimeout = interpreter.run(actionFlow(
      { timeoutMs: 5 },
      { errorPolicy: { onError: 'failure', timeoutMs: 50 } },
    ), { values: { name: 'Ada' } })
    await vi.advanceTimersByTimeAsync(5)
    await expect(nodeTimeout).resolves.toMatchObject({ status: 'timeout', error: { code: 'FLOW_TIMEOUT' } })

    const defaultTimeout = interpreter.run(actionFlow(undefined, { id: 'default-timeout' }), { values: { name: 'Ada' } })
    await vi.advanceTimersByTimeAsync(CONFIG_FORM_FLOW_DEFAULT_TIMEOUT_MS - 1)
    let settled = false
    void defaultTimeout.then(() => {
      settled = true
    })
    await Promise.resolve()
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await expect(defaultTimeout).resolves.toMatchObject({ status: 'timeout' })
  })

  it('treats timeoutMs zero as explicitly disabled', async () => {
    vi.useFakeTimers()
    let release!: () => void
    const interpreter = new ConfigFormFlowInterpreter(registry({
      work: { execute: () => new Promise<void>((resolve) => { release = resolve }) },
    }))
    const pending = interpreter.run(actionFlow({ timeoutMs: 0 }), { values: { name: 'Ada' } })
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(CONFIG_FORM_FLOW_DEFAULT_TIMEOUT_MS * 2)
    let settled = false
    void pending.then(() => {
      settled = true
    })
    await Promise.resolve()
    expect(settled).toBe(false)

    release()
    await expect(pending).resolves.toMatchObject({ status: 'success' })
  })

  it('fails queue overflow with a stable bounded-queue diagnostic', async () => {
    const interpreter = new ConfigFormFlowInterpreter(registry({
      work: { execute: () => new Promise(() => {}) },
    }))
    const source = actionFlow(undefined, { concurrency: 'queue' })
    const active = interpreter.run(source, { runId: 'active', values: { name: 'Ada' } })
    await Promise.resolve()
    const queued = Array.from({ length: CONFIG_FORM_FLOW_MAX_QUEUE_SIZE }, (_, index) =>
      interpreter.run(source, { runId: `queued-${index}`, values: { name: 'Ada' } }))

    const overflow = await interpreter.run(source, { runId: 'overflow', values: { name: 'Ada' } })

    expect(overflow).toMatchObject({ status: 'failure', error: { code: 'FLOW_QUEUE_LIMIT_EXCEEDED' } })
    expect(overflow.trace).toHaveLength(3)
    interpreter.abort()
    await Promise.all([active, ...queued])
  })

  it('bounds latest supersession chains with a reentry diagnostic', async () => {
    const interpreter = new ConfigFormFlowInterpreter(registry({
      work: { execute: () => new Promise(() => {}) },
    }))
    const source = actionFlow(undefined, { concurrency: 'latest' })
    const pending = [interpreter.run(source, { runId: 'initial', values: { name: 'Ada' } })]
    for (let index = 0; index < CONFIG_FORM_FLOW_MAX_REENTRANT_RUNS; index += 1) {
      pending.push(interpreter.run(source, { runId: `latest-${index}`, values: { name: 'Ada' } }))
    }

    const overflow = await interpreter.run(source, { runId: 'reentrant', values: { name: 'Ada' } })

    expect(overflow).toMatchObject({ status: 'failure', error: { code: 'FLOW_REENTRY_LIMIT_EXCEEDED' } })
    interpreter.abort()
    await Promise.all(pending)
  })

  it('records bounded JSON trace snapshots with time, duration, output and value patches', async () => {
    const source = flow(
      [
        { id: 'start', type: 'trigger' },
        { id: 'act', type: 'action', ref: 'trace', config: { input: 'x'.repeat(20_000) } },
        { id: 'done', type: 'success' },
      ],
      [
        { id: 'start-act', source: 'start', target: 'act' },
        { id: 'act-done', source: 'act', target: 'done' },
      ],
    )
    const result = await new ConfigFormFlowInterpreter(registry({
      trace: { execute: (_input, context) => {
        context.form.setValue('saved', true)
        return { ok: true }
      } },
    })).run(source)
    const exit = result.trace.find(event => event.nodeId === 'act' && event.type === 'exit')

    expect(exit).toMatchObject({
      output: { ok: true },
      valuePatch: { remove: [], set: { saved: true } },
      truncated: true,
    })
    expect(exit?.timestamp).toEqual(expect.any(Number))
    expect(exit?.durationMs).toEqual(expect.any(Number))
    expect(() => JSON.stringify(exit?.input)).not.toThrow()
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: 'FLOW_TRACE_VALUE_LIMIT_EXCEEDED' }))
  })

  it('keeps missing fields and invalid expressions as precise failures', async () => {
    const execute = vi.fn()
    const interpreter = new ConfigFormFlowInterpreter(registry({ work: { execute } }))
    const missing = await interpreter.run(actionFlow())
    expect(missing).toMatchObject({
      status: 'failure',
      error: { code: 'FLOW_FIELD_UNAVAILABLE', path: 'config.input.$field', nodeId: 'act' },
    })

    const invalid = actionFlow()
    invalid.nodes[1]!.config = { input: { $expression: '1 +' } }
    const analysis = analyzeConfigFormFlow(invalid)
    expect(analysis.success).toBe(false)
    expect(analysis.diagnostics).toContainEqual(expect.objectContaining({
      code: 'CONFIG_FORM_EXPRESSION_UNEXPECTED_END',
      nodeId: 'act',
    }))
    expect(execute).not.toHaveBeenCalled()
  })

  it('rejects downstream and mutually exclusive output references before execution', () => {
    const downstream = flow(
      [
        { id: 'start', type: 'trigger' },
        { id: 'first', type: 'action', ref: 'work', config: { input: { $output: 'later' } } },
        { id: 'later', type: 'action', ref: 'work', config: {} },
        { id: 'done', type: 'success' },
      ],
      [
        { id: 'start-first', source: 'start', target: 'first' },
        { id: 'first-later', source: 'first', target: 'later' },
        { id: 'later-done', source: 'later', target: 'done' },
      ],
    )
    expect(analyzeConfigFormFlow(downstream).diagnostics)
      .toContainEqual(expect.objectContaining({ code: 'FLOW_OUTPUT_UNAVAILABLE', nodeId: 'first' }))

    const branch = flow(
      [
        { id: 'start', type: 'trigger' },
        { id: 'choose', type: 'condition', config: { condition: { kind: 'literal', value: true } } },
        { id: 'left', type: 'action', ref: 'work', config: {} },
        { id: 'right', type: 'action', ref: 'work', config: {} },
        { id: 'merge', type: 'action', ref: 'work', config: { input: { $output: 'left' } } },
        { id: 'done', type: 'success' },
      ],
      [
        { id: 'start-choose', source: 'start', target: 'choose' },
        { id: 'choose-left', source: 'choose', target: 'left', condition: 'true' },
        { id: 'choose-right', source: 'choose', target: 'right', condition: 'false' },
        { id: 'left-merge', source: 'left', target: 'merge' },
        { id: 'right-merge', source: 'right', target: 'merge' },
        { id: 'merge-done', source: 'merge', target: 'done' },
      ],
    )
    expect(analyzeConfigFormFlow(branch).diagnostics)
      .toContainEqual(expect.objectContaining({ code: 'FLOW_OUTPUT_UNAVAILABLE', nodeId: 'merge' }))

    const skipped = flow(
      [
        { id: 'start', type: 'trigger' },
        { id: 'optional', type: 'action', ref: 'work', config: {}, policy: { when: { kind: 'literal', value: false } } },
        {
          id: 'consume',
          type: 'action',
          ref: 'work',
          config: { input: { $ref: { kind: 'output', stepId: 'optional' } } },
        },
        { id: 'done', type: 'success' },
      ],
      [
        { id: 'start-optional', source: 'start', target: 'optional' },
        { id: 'optional-consume', source: 'optional', target: 'consume' },
        { id: 'consume-done', source: 'consume', target: 'done' },
      ],
    )
    expect(analyzeConfigFormFlow(skipped).diagnostics)
      .toContainEqual(expect.objectContaining({ code: 'FLOW_OUTPUT_UNAVAILABLE', nodeId: 'consume' }))

    const continued = structuredClone(skipped)
    continued.nodes[1]!.policy = { onError: 'continue' }
    expect(analyzeConfigFormFlow(continued).diagnostics)
      .toContainEqual(expect.objectContaining({ code: 'FLOW_OUTPUT_UNAVAILABLE', nodeId: 'consume' }))
  })

  it('lists JSON-safe built-in and notify descriptors and diagnoses execute-only actions', async () => {
    const descriptors = listConfigFormBuiltinFlowActionDescriptors()
    expect(descriptors).toHaveLength(6)
    expect(descriptors.map(item => item.ref)).toContain('notify')
    expect(descriptors.flatMap(item => item.parameters).every(parameter => [
      'text',
      'number',
      'boolean',
      'enum',
      'value',
      'field',
      'variable',
      'dataSource',
      'object',
      'array',
    ].includes(parameter.control))).toBe(true)
    expect(() => JSON.stringify(descriptors)).not.toThrow()

    const builtins = createConfigFormFlowActionRegistry(createConfigFormBuiltinFlowActions({}))
    expect(builtins.list()).toHaveLength(5)
    expect(builtins.describe('builtin.delay')).toMatchObject({ ref: 'builtin.delay', category: 'timing' })

    const legacy = new ConfigFormFlowInterpreter({ get: () => ({ execute: input => input }) })
    const result = await legacy.run(actionFlow(), { values: { name: 'Ada' } })
    expect(result.status).toBe('success')
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: 'FLOW_ACTION_DESCRIPTOR_MISSING',
      severity: 'warning',
    }))
  })

  it('never falls back to global fetch for HTTP actions', async () => {
    const globalFetch = vi.fn()
    vi.stubGlobal('fetch', globalFetch)
    const interpreter = new ConfigFormFlowInterpreter(createConfigFormFlowActionRegistry(
      createConfigFormBuiltinFlowActions({}),
    ))
    const source = flow(
      [
        { id: 'start', type: 'trigger' },
        { id: 'request', type: 'action', ref: 'builtin.http.request', config: { input: { url: 'https://example.test' } } },
        { id: 'done', type: 'success' },
      ],
      [
        { id: 'start-request', source: 'start', target: 'request' },
        { id: 'request-done', source: 'request', target: 'done' },
      ],
    )

    const result = await interpreter.run(source)

    expect(result).toMatchObject({ status: 'failure', error: { code: 'FLOW_ACTION_HOST_MISSING' } })
    expect(globalFetch).not.toHaveBeenCalled()
  })
})
