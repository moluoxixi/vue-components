import type { ConfigFormFlow, ConfigFormFlowConcurrency } from '@moluoxixi/config-form-core'
import { analyzeConfigFormFlow, ConfigFormFlowInterpreter } from '@moluoxixi/config-form-core'
import { describe, expect, it, vi } from 'vitest'
import {
  applyPreviewFlowValuePatch,
  PreviewFlowCoordinator,
} from '../flow-coordinator'

function actionFlow(
  concurrency: ConfigFormFlowConcurrency,
  options: { id?: string, inputField?: string, outputField?: string, projection?: boolean } = {},
): ConfigFormFlow {
  const nodes: ConfigFormFlow['nodes'] = [
    { id: 'trigger', type: 'trigger' },
    {
      id: 'work',
      type: 'action',
      ref: 'work',
      config: {
        input: { $field: options.inputField ?? 'request' },
        output: { [options.outputField ?? 'result']: { $output: 'work' } },
      },
    },
  ]
  const edges: ConfigFormFlow['edges'] = [
    { id: 'trigger-work', source: 'trigger', target: 'work', condition: 'next' },
  ]
  if (options.projection) {
    nodes.push({
      id: 'project',
      type: 'reaction',
      config: {
        reactions: [{
          id: 'project-result',
          when: { kind: 'literal', value: true },
          then: [{
            kind: 'setProps',
            target: 'result',
            props: { placeholder: { kind: 'literal', value: 'Completed' } },
          }],
        }],
      },
    })
    edges.push({ id: 'work-project', source: 'work', target: 'project', condition: 'next' })
  }
  nodes.push({ id: 'success', type: 'success' })
  edges.push({
    id: 'finish',
    source: options.projection ? 'project' : 'work',
    target: 'success',
    condition: 'next',
  })
  return {
    version: 1,
    id: options.id ?? 'preview-flow',
    name: 'Preview flow',
    trigger: { kind: 'field.change', field: 'request' },
    concurrency,
    nodes,
    edges,
  }
}

function executionPlan(flow: ConfigFormFlow) {
  const result = analyzeConfigFormFlow(flow)
  if (!result.success)
    throw new Error(result.diagnostics[0]?.message ?? 'Invalid test flow')
  return result.plan
}

describe('preview flow coordinator', () => {
  it('publishes every queued trigger in execution order without a global latest gate', async () => {
    const calls: unknown[] = []
    const releases: Array<(value: unknown) => void> = []
    const execute = vi.fn((input: unknown) => new Promise((resolve) => {
      calls.push(input)
      releases.push(resolve)
    }))
    const coordinator = new PreviewFlowCoordinator(new ConfigFormFlowInterpreter({ get: () => ({ execute }) }))
    const flow = actionFlow('queue')
    const first = coordinator.dispatch({ plans: [executionPlan(flow)], trigger: flow.trigger, values: { request: 'first' }, revision: 1 })
    await vi.waitFor(() => expect(calls).toEqual(['first']))
    const second = coordinator.dispatch({ plans: [executionPlan(flow)], trigger: flow.trigger, values: { request: 'second' }, revision: 1 })
    const third = coordinator.dispatch({ plans: [executionPlan(flow)], trigger: flow.trigger, values: { request: 'third' }, revision: 1 })

    releases.shift()!('first-result')
    await vi.waitFor(() => expect(calls).toEqual(['first', 'second']))
    releases.shift()!('second-result')
    await vi.waitFor(() => expect(calls).toEqual(['first', 'second', 'third']))
    releases.shift()!('third-result')

    await expect(first).resolves.toMatchObject({ status: 'committed', valuePatch: { set: { result: 'first-result' } } })
    await expect(second).resolves.toMatchObject({ status: 'committed', valuePatch: { set: { result: 'second-result' } } })
    await expect(third).resolves.toMatchObject({ status: 'committed', valuePatch: { set: { result: 'third-result' } } })
  })

  it('does not let an ignored trigger clear the active run projection', async () => {
    let release!: (value: unknown) => void
    const execute = vi.fn(() => new Promise((resolve) => {
      release = resolve
    }))
    const coordinator = new PreviewFlowCoordinator(new ConfigFormFlowInterpreter({ get: () => ({ execute }) }))
    const flow = actionFlow('ignore', { projection: true })
    const active = coordinator.dispatch({ plans: [executionPlan(flow)], trigger: flow.trigger, values: { request: 'active' }, revision: 1 })
    await vi.waitFor(() => expect(execute).toHaveBeenCalledTimes(1))

    await expect(coordinator.dispatch({
      plans: [executionPlan(flow)],
      trigger: flow.trigger,
      values: { request: 'ignored' },
      revision: 1,
    })).resolves.toEqual(expect.objectContaining({
      projectionUpdates: {},
      status: 'ignored',
    }))

    release('active-result')
    await expect(active).resolves.toMatchObject({
      projectionUpdates: {
        'preview-flow': { props: { result: { placeholder: 'Completed' } } },
      },
      status: 'committed',
    })
  })

  it('returns no state when the page revision becomes stale during execution', async () => {
    let release!: (value: unknown) => void
    let current = true
    const coordinator = new PreviewFlowCoordinator(new ConfigFormFlowInterpreter({
      get: () => ({ execute: () => new Promise((resolve) => {
        release = resolve
      }) }),
    }))
    const flow = actionFlow('latest')
    const dispatch = coordinator.dispatch({
      plans: [executionPlan(flow)],
      trigger: flow.trigger,
      values: { request: 'stale' },
      revision: 1,
      isCurrent: () => current,
    })
    await vi.waitFor(() => expect(release).toBeTypeOf('function'))

    current = false
    release('late-result')

    await expect(dispatch).resolves.toMatchObject({
      projectionUpdates: {},
      status: 'stale',
      valuePatch: { remove: [], set: {} },
    })
  })

  it('passes values through matching flows in model order', async () => {
    const calls: unknown[] = []
    const coordinator = new PreviewFlowCoordinator(new ConfigFormFlowInterpreter({
      get: () => ({
        execute: async (input: unknown) => {
          calls.push(input)
          return `${String(input)}:${calls.length}`
        },
      }),
    }))
    const flows = [
      actionFlow('latest', { id: 'first', outputField: 'intermediate' }),
      actionFlow('latest', { id: 'second', inputField: 'intermediate', outputField: 'result' }),
    ]

    await expect(coordinator.dispatch({
      plans: flows.map(executionPlan),
      trigger: { kind: 'field.change', field: 'request' },
      values: { request: 'start' },
      revision: 1,
    })).resolves.toMatchObject({
      status: 'committed',
      valuePatch: { set: { intermediate: 'start:1', result: 'start:1:2' } },
    })
    expect(calls).toEqual(['start', 'start:1'])
  })

  it('matches component event triggers by node id and event name', async () => {
    const execute = vi.fn(async (input: unknown) => input)
    const coordinator = new PreviewFlowCoordinator(new ConfigFormFlowInterpreter({ get: () => ({ execute }) }))
    const flow = actionFlow('latest', { id: 'component-event' })
    flow.trigger = { kind: 'component.event', nodeId: 'submit-button', event: 'click' }

    await expect(coordinator.dispatch({
      plans: [executionPlan(flow)],
      trigger: { kind: 'component.event', nodeId: 'submit-button', event: 'click' },
      values: { request: 'clicked' },
      revision: 1,
    })).resolves.toMatchObject({ status: 'committed', valuePatch: { set: { result: 'clicked' } } })
    expect(execute).toHaveBeenCalledWith('clicked', expect.anything())

    await expect(coordinator.dispatch({
      plans: [executionPlan(flow)],
      trigger: { kind: 'component.event', nodeId: 'other-button', event: 'click' },
      values: { request: 'ignored' },
      revision: 1,
    })).resolves.toMatchObject({ status: 'noop' })
  })

  it('applies only flow-owned value changes to the latest preview values', () => {
    expect(applyPreviewFlowValuePatch(
      { request: 'latest', result: 'old', untouched: 'newer-user-value' },
      { remove: [], set: { result: 'flow-result' } },
    )).toEqual({
      request: 'latest',
      result: 'flow-result',
      untouched: 'newer-user-value',
    })
  })

  it('preserves the current model identity when a patch has no effective changes', () => {
    const current = { request: 'latest', result: 'flow-result' }

    expect(applyPreviewFlowValuePatch(current, { remove: [], set: {} })).toBe(current)
    expect(applyPreviewFlowValuePatch(current, {
      remove: ['missing'],
      set: { result: 'flow-result' },
    })).toBe(current)
  })
})
