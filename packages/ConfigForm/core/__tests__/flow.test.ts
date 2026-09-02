import type { ConfigFormFlow } from '../src/flow'
import { describe, expect, it, vi } from 'vitest'
import { analyzeConfigFormFlow, ConfigFormFlowInterpreter, getConfigFormFlowSemanticHash } from '../src/flow'

function flow(overrides: Partial<ConfigFormFlow> = {}): ConfigFormFlow {
  return {
    version: 1,
    id: 'profile-submit',
    name: 'Profile submit',
    trigger: { kind: 'form.submit' },
    nodes: [
      { id: 'trigger', type: 'trigger' },
      { id: 'check', type: 'condition', config: { condition: { kind: 'literal', value: true } } },
      { id: 'save', type: 'action', ref: 'save-profile', config: { input: { $field: 'name' } } },
      { id: 'success', type: 'success' },
      { id: 'failure', type: 'failure' },
    ],
    edges: [
      { id: 'e1', source: 'trigger', target: 'check', condition: 'next' },
      { id: 'e2', source: 'check', target: 'save', condition: 'true' },
      { id: 'e3', source: 'check', target: 'failure', condition: 'false' },
      { id: 'e4', source: 'save', target: 'success', condition: 'next' },
    ],
    ...overrides,
  }
}

describe('config form flow core', () => {
  it('creates a deterministic plan and rejects malformed branch graphs', () => {
    const result = analyzeConfigFormFlow(flow())
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.plan).toMatchObject({
        version: 1,
        flowId: 'profile-submit',
        name: 'Profile submit',
        trigger: { kind: 'form.submit' },
      })
      expect(result.plan).not.toHaveProperty('revision')
      expect(result.plan.topologicalOrder).toEqual(['trigger', 'check', 'failure', 'save', 'success'])
      expect(result.plan.nodes.find(node => node.id === 'check')?.outgoing.map(edge => edge.condition)).toEqual(['true', 'false'])
    }
    const invalid = analyzeConfigFormFlow(flow({ edges: [{ id: 'e1', source: 'trigger', target: 'check' }] }))
    expect(invalid.success).toBe(false)
    expect(invalid.diagnostics.map(diagnostic => diagnostic.code)).toContain('FLOW_BRANCH_INCOMPLETE')
  })

  it('ignores editor-only node positions in semantic hashes', () => {
    const left = flow()
    const right = structuredClone(left)
    right.nodes.forEach((node, index) => {
      node.position = { x: index * 120, y: 240 }
    })
    expect(getConfigFormFlowSemanticHash(left)).toBe(getConfigFormFlowSemanticHash(right))
    const analyzed = analyzeConfigFormFlow(right)
    expect(analyzed.success).toBe(true)
    if (analyzed.success)
      expect(analyzed.plan.nodes.every(node => !Object.hasOwn(node, 'position'))).toBe(true)
  })

  it('executes a self-contained plan without depending on the authoring graph', async () => {
    const source = flow({ concurrency: 'ignore', errorPolicy: { onError: 'end' } })
    const analyzed = analyzeConfigFormFlow(source)
    expect(analyzed.success).toBe(true)
    if (!analyzed.success)
      return

    const execute = vi.fn(async (input: unknown) => ({ saved: input }))
    const interpreter = new ConfigFormFlowInterpreter({ get: () => ({ execute }) })
    const result = await interpreter.run(structuredClone(analyzed.plan), {
      revision: 11,
      values: { name: 'Plan only' },
    })

    expect(result).toMatchObject({ status: 'success', revision: 11 })
    expect(execute).toHaveBeenCalledWith('Plan only', expect.objectContaining({
      flow: expect.objectContaining({
        concurrency: 'ignore',
        errorPolicy: { onError: 'end' },
        trigger: { kind: 'form.submit' },
      }),
    }))
  })

  it('keeps semantic hashes stable across JSON object key order', () => {
    const left = flow({ nodes: [{ id: 'trigger', type: 'trigger' }, { id: 'end', type: 'end' }] })
    const right = flow({ nodes: [{ type: 'trigger', id: 'trigger' }, { type: 'end', id: 'end' }] })
    expect(getConfigFormFlowSemanticHash(left)).toBe(getConfigFormFlowSemanticHash(right))
  })

  it('rejects invalid trigger fields, concurrency, and timeout policy before execution', () => {
    const invalid = analyzeConfigFormFlow(flow({
      trigger: { kind: 'form.submit', field: 'name' },
      concurrency: 'parallel' as ConfigFormFlow['concurrency'],
      errorPolicy: { onError: 'retry' as 'failure', timeoutMs: -1 },
    }))
    expect(invalid.success).toBe(false)
    expect(invalid.diagnostics.map(diagnostic => diagnostic.code)).toEqual(expect.arrayContaining([
      'FLOW_TRIGGER_FIELD_UNEXPECTED',
      'FLOW_CONCURRENCY_INVALID',
      'FLOW_ERROR_POLICY_INVALID',
      'FLOW_TIMEOUT_INVALID',
    ]))
  })

  it('requires a stable node and event for component event triggers', () => {
    const valid = analyzeConfigFormFlow(flow({
      trigger: { kind: 'component.event', nodeId: 'profile-button', event: 'click' },
    }))
    expect(valid.success).toBe(true)
    if (valid.success)
      expect(valid.plan.trigger).toEqual({ kind: 'component.event', nodeId: 'profile-button', event: 'click' })

    const invalid = analyzeConfigFormFlow(flow({
      trigger: { kind: 'component.event' },
    }))
    expect(invalid.success).toBe(false)
    expect(invalid.diagnostics.map(diagnostic => diagnostic.code)).toEqual(expect.arrayContaining([
      'FLOW_TRIGGER_NODE_REQUIRED',
      'FLOW_TRIGGER_EVENT_REQUIRED',
    ]))
  })

  it('returns diagnostics for malformed nodes without throwing', () => {
    const malformed = flow({ nodes: [null as unknown as ConfigFormFlow['nodes'][number]] })
    expect(() => analyzeConfigFormFlow(malformed)).not.toThrow()
    expect(analyzeConfigFormFlow(malformed)).toMatchObject({
      success: false,
      diagnostics: [{ code: 'FLOW_NODE_ID_REQUIRED' }],
    })

    const malformedAfterTrigger = flow({ nodes: [flow().nodes[0]!, null as unknown as ConfigFormFlow['nodes'][number]] })
    expect(() => analyzeConfigFormFlow(malformedAfterTrigger)).not.toThrow()
    expect(analyzeConfigFormFlow(malformedAfterTrigger)).toMatchObject({
      success: false,
      diagnostics: [{ code: 'FLOW_NODE_ID_REQUIRED' }],
    })
  })

  it('accepts JSON-equivalent shared references while rejecting cyclic payloads', () => {
    const shared = { label: 'shared' }
    const sharedPayload = flow({
      nodes: [
        { id: 'trigger', type: 'trigger' },
        { id: 'save', type: 'action', ref: 'save-profile', config: { input: { left: shared, right: shared } } },
        { id: 'end', type: 'end' },
      ],
      edges: [
        { id: 'trigger-save', source: 'trigger', target: 'save', condition: 'next' },
        { id: 'save-end', source: 'save', target: 'end', condition: 'next' },
      ],
    })
    expect(analyzeConfigFormFlow(sharedPayload).success).toBe(true)

    const cyclic = { label: 'cycle' } as { label: string, self?: unknown }
    cyclic.self = cyclic
    const cyclicPayload = flow({
      nodes: [
        { id: 'trigger', type: 'trigger' },
        { id: 'save', type: 'action', ref: 'save-profile', config: { input: cyclic as never } },
        { id: 'end', type: 'end' },
      ],
      edges: [
        { id: 'trigger-save', source: 'trigger', target: 'save', condition: 'next' },
        { id: 'save-end', source: 'save', target: 'end', condition: 'next' },
      ],
    })
    expect(analyzeConfigFormFlow(cyclicPayload).diagnostics.map(diagnostic => diagnostic.code)).toContain('FLOW_NON_JSON')
  })

  it('executes condition/action paths with trace and JSON input mapping', async () => {
    const execute = vi.fn(async (input: unknown) => ({ saved: input }))
    const interpreter = new ConfigFormFlowInterpreter({ get: ref => ref === 'save-profile' ? { execute } : undefined })
    const result = await interpreter.run(flow(), { revision: 3, runId: 'run-1', values: { name: 'Ada' } })
    expect(result.status).toBe('success')
    expect(result.outputs.save).toEqual({ saved: 'Ada' })
    expect(execute).toHaveBeenCalledWith('Ada', expect.objectContaining({ runId: 'run-1', revision: 3 }))
    expect(result.trace.at(-1)).toMatchObject({ type: 'finish', status: 'success' })
  })

  it('preserves reaction props, states and validation as one run projection', async () => {
    const reactionFlow = flow({
      nodes: [
        { id: 'trigger', type: 'trigger' },
        {
          id: 'project',
          type: 'reaction',
          config: {
            reactions: [{
              id: 'project-name',
              when: { kind: 'literal', value: true },
              then: [
                { kind: 'setValue', target: 'name', value: { kind: 'literal', value: 'Grace' } },
                { kind: 'setProps', target: 'name', props: { placeholder: { kind: 'literal', value: 'Generated' } } },
                { kind: 'setState', target: 'name', state: { disabled: true, required: true } },
                { kind: 'validate', target: 'name' },
              ],
            }],
          },
        },
        { id: 'success', type: 'success' },
      ],
      edges: [
        { id: 'trigger-project', source: 'trigger', target: 'project', condition: 'next' },
        { id: 'project-success', source: 'project', target: 'success', condition: 'next' },
      ],
    })

    const result = await new ConfigFormFlowInterpreter().run(reactionFlow, { values: { name: 'Ada' } })

    expect(result.values).toEqual({ name: 'Grace' })
    expect(result.projection).toEqual({
      values: { name: 'Grace' },
      props: { name: { placeholder: 'Generated' } },
      states: { name: { disabled: true, required: true } },
      validate: ['name'],
    })
  })

  it('applies registered action output mappings to run values', async () => {
    const outputFlow = flow({
      nodes: [
        { id: 'trigger', type: 'trigger' },
        {
          id: 'load',
          type: 'action',
          ref: 'load-profile',
          config: { output: { profile: { $output: 'load' } } },
        },
        { id: 'success', type: 'success' },
      ],
      edges: [
        { id: 'trigger-load', source: 'trigger', target: 'load', condition: 'next' },
        { id: 'load-success', source: 'load', target: 'success', condition: 'next' },
      ],
    })
    const interpreter = new ConfigFormFlowInterpreter({
      get: ref => ref === 'load-profile' ? { execute: () => ({ id: 7 }) } : undefined,
    })

    const result = await interpreter.run(outputFlow)

    expect(result.values.profile).toEqual({ id: 7 })
    expect(result.projection.values.profile).toEqual({ id: 7 })
  })

  it('routes action failures through error edges and isolates aborted latest runs', async () => {
    const execute = vi.fn((_input: unknown, context: { signal: AbortSignal, runId: string }) => new Promise((_resolve, reject) => {
      if (context.runId === 'second') {
        reject(new Error('network'))
        return
      }
      context.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
    }))
    const interpreter = new ConfigFormFlowInterpreter({ get: () => ({ execute }) })
    const errorFlow = flow({ errorPolicy: { onError: 'failure' }, edges: [
      { id: 'e1', source: 'trigger', target: 'save', condition: 'next' },
      { id: 'e2', source: 'save', target: 'failure', condition: 'error' },
      { id: 'e3', source: 'save', target: 'success', condition: 'next' },
    ], nodes: flow().nodes.filter(node => node.id !== 'check') })
    const first = interpreter.run(errorFlow, { runId: 'first' })
    const second = interpreter.run(errorFlow, { runId: 'second' })
    expect((await first).status).toBe('aborted')
    expect((await second).status).toBe('failure')
  })

  it('settles a superseded latest run even when its action ignores abort signals', async () => {
    const execute = vi.fn((input: unknown) => input === 'first'
      ? new Promise(() => {})
      : Promise.resolve(input))
    const interpreter = new ConfigFormFlowInterpreter({ get: () => ({ execute }) })
    const latestFlow = flow({ concurrency: 'latest' })
    const first = interpreter.run(latestFlow, { runId: 'first', values: { name: 'first' } })
    await vi.waitFor(() => expect(execute).toHaveBeenCalledTimes(1))

    const second = interpreter.run(latestFlow, { runId: 'second', values: { name: 'second' } })

    await expect(first).resolves.toMatchObject({ runId: 'first', status: 'aborted' })
    await expect(second).resolves.toMatchObject({ runId: 'second', status: 'success' })
  })

  it('settles an externally aborted queued run before the active run finishes', async () => {
    let releaseActive!: () => void
    const execute = vi.fn((input: unknown) => input === 'active'
      ? new Promise<void>((resolve) => { releaseActive = resolve })
      : Promise.resolve(input))
    const interpreter = new ConfigFormFlowInterpreter({ get: () => ({ execute }) })
    const queuedFlow = flow({ concurrency: 'queue' })
    const active = interpreter.run(queuedFlow, { runId: 'active', values: { name: 'active' } })
    await vi.waitFor(() => expect(execute).toHaveBeenCalledTimes(1))
    const controller = new AbortController()
    const queued = interpreter.run(queuedFlow, {
      runId: 'queued',
      signal: controller.signal,
      values: { name: 'queued' },
    })
    let queuedSettled = false
    void queued.then(() => {
      queuedSettled = true
    })

    controller.abort('revision-changed')
    await Promise.resolve()

    expect(queuedSettled).toBe(true)
    await expect(queued).resolves.toMatchObject({ runId: 'queued', status: 'aborted' })
    expect(execute).toHaveBeenCalledTimes(1)
    releaseActive()
    await expect(active).resolves.toMatchObject({ status: 'success' })
  })

  it('removes the external abort listener after a normal run completes', async () => {
    const controller = new AbortController()
    const add = vi.spyOn(controller.signal, 'addEventListener')
    const remove = vi.spyOn(controller.signal, 'removeEventListener')
    const interpreter = new ConfigFormFlowInterpreter({
      get: () => ({ execute: async (input: unknown) => input }),
    })

    await expect(
      interpreter.run(flow(), { signal: controller.signal, values: { name: 'Ada' } }),
    ).resolves.toMatchObject({ status: 'success' })

    expect(add.mock.calls.filter(([type]) => type === 'abort')).toHaveLength(1)
    expect(remove.mock.calls.filter(([type]) => type === 'abort')).toHaveLength(1)
  })

  it('honors an end error policy instead of reporting a failure', async () => {
    const endFlow = flow({
      errorPolicy: { onError: 'end' },
      nodes: [
        { id: 'trigger', type: 'trigger' },
        { id: 'save', type: 'action', ref: 'save-profile', config: {} },
        { id: 'end', type: 'end' },
      ],
      edges: [
        { id: 'trigger-save', source: 'trigger', target: 'save', condition: 'next' },
        { id: 'save-end', source: 'save', target: 'end', condition: 'next' },
      ],
    })
    const interpreter = new ConfigFormFlowInterpreter({
      get: () => ({ execute: async () => { throw new Error('best effort') } }),
    })

    const result = await interpreter.run(endFlow)

    expect(result.status).toBe('end')
    expect(result.error?.code).toBe('FLOW_NODE_ERROR')
    expect(result.trace.at(-1)).toMatchObject({ type: 'finish', status: 'end' })
  })
})
