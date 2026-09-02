import type { ConfigFormFlow, ConfigFormFlowActionRegistry } from '@moluoxixi/config-form-core'
import { analyzeConfigFormFlow } from '@moluoxixi/config-form-core'
import { describe, expect, it, vi } from 'vitest'
import {
  createPageFlowEngine,
  createWorkbenchPageFlowEngine,
} from '..'

function executionPlan(flow: ConfigFormFlow) {
  const result = analyzeConfigFormFlow(flow)
  if (!result.success)
    throw new Error(result.diagnostics[0]?.message ?? 'Invalid test flow')
  return result.plan
}

function componentEventFlow(options: { action?: string, projection?: boolean } = {}): ConfigFormFlow {
  const nodes: ConfigFormFlow['nodes'] = [
    { id: 'trigger', type: 'trigger' },
    {
      id: 'work',
      type: 'action',
      ref: options.action ?? 'notify',
      config: { input: 'clicked', output: { result: { $output: 'work' } } },
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
          id: 'show-result',
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
    id: 'button-click',
    name: 'Button click',
    trigger: { kind: 'component.event', nodeId: 'submit', event: 'click' },
    concurrency: 'latest',
    nodes,
    edges,
  }
}

describe('page flow engine', () => {
  it('owns the Workbench action registry and projects a registered component event', async () => {
    let values: Record<string, unknown> = { untouched: 'current' }
    const notify = vi.fn()
    const engine = createWorkbenchPageFlowEngine({
      onNotify: notify,
      readValues: () => values,
      writeValues: next => values = next,
    })
    const flow = componentEventFlow({ projection: true })
    engine.sync({ pageKey: 'project:page-a', plans: [executionPlan(flow)] })

    await expect(engine.dispatch({
      trigger: flow.trigger,
      values,
      revision: 1,
    })).resolves.toMatchObject({ status: 'committed' })

    expect(notify).toHaveBeenCalledWith('clicked')
    expect(values).toEqual({ result: { notified: 'clicked' }, untouched: 'current' })
    expect(engine.projection.value.props).toEqual({ result: { placeholder: 'Completed' } })
  })

  it('invalidates pending event work when the owning page changes', async () => {
    let release!: (value: unknown) => void
    let values: Record<string, unknown> = { untouched: true }
    const actions: ConfigFormFlowActionRegistry = {
      get: () => ({ execute: () => new Promise(resolve => release = resolve) }),
    }
    const engine = createPageFlowEngine({
      actions,
      readValues: () => values,
      writeValues: next => values = next,
    })
    const flow = componentEventFlow({ action: 'work', projection: true })
    engine.sync({ pageKey: 'project:page-a', plans: [executionPlan(flow)] })
    const pending = engine.dispatch({ trigger: flow.trigger, values, revision: 1 })
    await vi.waitFor(() => expect(release).toBeTypeOf('function'))

    engine.sync({ pageKey: 'project:page-b', plans: [] })
    release('late')

    await expect(pending).resolves.toMatchObject({ status: 'stale' })
    expect(values).toEqual({ untouched: true })
    expect(engine.projection.value).toEqual({
      values,
      props: {},
      states: {},
      validate: [],
    })
  })

  it('prunes projections when a flow is removed from the same page', async () => {
    let values: Record<string, unknown> = {}
    const engine = createWorkbenchPageFlowEngine({
      readValues: () => values,
      writeValues: next => values = next,
    })
    const flow = componentEventFlow({ projection: true })
    engine.sync({ pageKey: 'project:page-a', plans: [executionPlan(flow)] })
    await engine.dispatch({ trigger: flow.trigger, values, revision: 1 })
    expect(engine.projection.value.props).toHaveProperty('result')

    engine.sync({ pageKey: 'project:page-a', plans: [] })
    expect(engine.projection.value.props).toEqual({})
  })

  it('publishes one diagnostic when an action error reaches both trace and terminal state', async () => {
    let values: Record<string, unknown> = {}
    const onDiagnostic = vi.fn()
    const engine = createPageFlowEngine({
      actions: { get: () => ({ execute: () => Promise.reject(new Error('request failed')) }) },
      readValues: () => values,
      writeValues: next => values = next,
      onDiagnostic,
    })
    const flow = componentEventFlow({ action: 'work' })
    engine.sync({ pageKey: 'project:page-a', plans: [executionPlan(flow)] })

    await expect(
      engine.dispatch({ trigger: flow.trigger, values, revision: 1 }),
    ).resolves.toMatchObject({ status: 'failure' })
    expect(onDiagnostic).toHaveBeenCalledTimes(1)
    expect(onDiagnostic).toHaveBeenCalledWith(expect.objectContaining({ message: 'request failed' }))
  })
})
