import type {
  ConfigFormFlow,
  ConfigFormFlowActionContext,
  ConfigFormFlowExecutionPlan,
  ConfigFormFlowTrigger,
  ConfigFormJsonObject,
} from '@moluoxixi/config-form-core'
import {
  analyzeConfigFormFlow,
  applyConfigFormFlowValuePatch,
  CONFIG_FORM_FLOW_RUNTIME_VERSION,
  CONFIG_FORM_FLOW_VERSION,
  createConfigFormEventRuntime,
  createConfigFormFlowValuePatch,
} from '@moluoxixi/config-form-core'
import { describe, expect, it } from 'vitest'
import { createStandaloneFlowRuntimeSource } from '../export'
import { evaluateGeneratedRuntimeModule } from './generated-runtime-module'

type FlowValues = Record<string, unknown>
type PortableAction = (
  input: unknown,
  context: Pick<ConfigFormFlowActionContext, 'node' | 'outputs' | 'signal' | 'values'>,
) => unknown | Promise<unknown>

interface PortableFlowResult {
  status: string
  values: FlowValues
  error?: string
}

interface PortableFlowHarness {
  applyPatch: (current: FlowValues, before: FlowValues, after: FlowValues) => FlowValues
  register: (ref: string, action: PortableAction) => void
  run: (trigger: ConfigFormFlowTrigger, values?: FlowValues, signal?: AbortSignal) => Promise<PortableFlowResult>
  runtimeVersion: number
}

function plan(flow: ConfigFormFlow): ConfigFormFlowExecutionPlan {
  const result = analyzeConfigFormFlow(flow)
  if (!result.success)
    throw new Error(result.diagnostics[0]?.message ?? 'Flow analysis failed.')
  return result.plan
}

function actionFlow(options: {
  id: string
  ref?: string
  concurrency?: ConfigFormFlow['concurrency']
  errorPolicy?: ConfigFormFlow['errorPolicy']
  output?: ConfigFormJsonObject
  errorTerminal?: boolean
}): ConfigFormFlowExecutionPlan {
  const actionId = `${options.id}-action`
  const terminalId = `${options.id}-${options.errorTerminal ? 'failure' : 'success'}`
  return plan({
    version: CONFIG_FORM_FLOW_VERSION,
    id: options.id,
    name: options.id,
    trigger: { kind: 'form.submit' },
    ...(options.concurrency ? { concurrency: options.concurrency } : {}),
    ...(options.errorPolicy ? { errorPolicy: options.errorPolicy } : {}),
    nodes: [
      { id: `${options.id}-trigger`, type: 'trigger' },
      {
        id: actionId,
        type: 'action',
        ref: options.ref ?? 'work',
        config: {
          input: { $field: 'name' },
          ...(options.output ? { output: options.output } : {}),
        },
      },
      { id: terminalId, type: options.errorTerminal ? 'failure' : 'success' },
    ],
    edges: [
      { id: `${options.id}-start`, source: `${options.id}-trigger`, target: actionId, condition: 'next' },
      {
        id: `${options.id}-terminal`,
        source: actionId,
        target: terminalId,
        condition: options.errorTerminal ? 'error' : 'next',
      },
      ...(options.errorTerminal ? [{ id: `${options.id}-normal`, source: actionId, target: terminalId, condition: 'next' as const }] : []),
    ],
  })
}

function createCoreHarness(
  plans: readonly ConfigFormFlowExecutionPlan[],
  core = { createConfigFormEventRuntime, applyConfigFormFlowValuePatch, createConfigFormFlowValuePatch, CONFIG_FORM_FLOW_RUNTIME_VERSION },
): PortableFlowHarness {
  const actions = new Map<string, PortableAction>()
  let current: FlowValues = {}
  const runtime = core.createConfigFormEventRuntime({
    readValues: () => current,
    writeValues: (values) => { current = values },
    actions: { get: ref => actions.has(ref)
      ? { execute: (input, context) => actions.get(ref)!(input, context) }
      : undefined },
  })
  runtime.sync(plans)
  return {
    runtimeVersion: core.CONFIG_FORM_FLOW_RUNTIME_VERSION,
    register: (ref, action) => actions.set(ref, action),
    applyPatch: (current, before, after) => core.applyConfigFormFlowValuePatch(
      current,
      core.createConfigFormFlowValuePatch(before, after),
    ),
    async run(trigger, values = {}, signal) {
      current = values
      const result = await runtime.dispatch({ trigger, revision: 1, signal })
      return {
        status: result.status,
        values: current,
        ...(result.error ? { error: result.error.message } : {}),
      }
    },
  }
}

async function createGeneratedHarness(plans: readonly ConfigFormFlowExecutionPlan[]): Promise<PortableFlowHarness> {
  const source = createStandaloneFlowRuntimeSource(plans)
  const module = await evaluateGeneratedRuntimeModule(source)
  expect(module.flowPlans).toEqual(plans)
  expect(module.FLOW_RUNTIME_VERSION).toBe(module.CONFIG_FORM_FLOW_RUNTIME_VERSION)
  return createCoreHarness(module.flowPlans, module as Parameters<typeof createCoreHarness>[1])
}

async function harnesses(plans: readonly ConfigFormFlowExecutionPlan[]): Promise<PortableFlowHarness[]> {
  return [createCoreHarness(plans), await createGeneratedHarness(plans)]
}

describe('portable Flow runtime parity', () => {
  it('pins Core and generated Source to one runtime version and no-op contract', async () => {
    for (const runtime of await harnesses([])) {
      expect(runtime.runtimeVersion).toBe(CONFIG_FORM_FLOW_RUNTIME_VERSION)
      await expect(runtime.run({ kind: 'page.mount' }, { name: 'Ada' })).resolves.toEqual({
        status: 'noop',
        values: { name: 'Ada' },
      })
    }
  })

  it('runs matching plans in model order and preserves unrelated concurrent values through patches', async () => {
    const plans = [
      actionFlow({ id: 'append-a', ref: 'append-a', output: { name: { $output: 'append-a-action' } } }),
      actionFlow({ id: 'append-b', ref: 'append-b', output: { name: { $output: 'append-b-action' } } }),
    ]
    for (const runtime of await harnesses(plans)) {
      runtime.register('append-a', input => `${String(input)}A`)
      runtime.register('append-b', input => `${String(input)}B`)
      const before = { name: 'x', untouched: 'old' }
      const result = await runtime.run({ kind: 'form.submit' }, before)
      expect(result).toMatchObject({ status: 'committed', values: { name: 'xAB', untouched: 'old' } })
      expect(runtime.applyPatch(
        { name: 'x', untouched: 'new', localOnly: true },
        before,
        result.values,
      )).toEqual({ name: 'xAB', untouched: 'new', localOnly: true })
    }
  })

  it('implements latest, queue, and ignore at the Flow id boundary', async () => {
    for (const concurrency of ['latest', 'queue', 'ignore'] as const) {
      const plans = [actionFlow({ id: `concurrency-${concurrency}`, concurrency })]
      for (const runtime of await harnesses(plans)) {
        let calls = 0
        let markStarted!: () => void
        let releaseFirst!: () => void
        const started = new Promise<void>(resolve => markStarted = resolve)
        const firstAction = new Promise<string>(resolve => releaseFirst = () => resolve('first'))
        runtime.register('work', async (_input, context) => {
          calls += 1
          if (calls === 1) {
            markStarted()
            return firstAction
          }
          if (context.signal.aborted)
            throw context.signal.reason
          return 'next'
        })

        const firstController = new AbortController()
        const first = runtime.run({ kind: 'form.submit' }, { name: 'first' }, firstController.signal)
        await started
        const secondController = new AbortController()
        const second = runtime.run({ kind: 'form.submit' }, { name: 'second' }, secondController.signal)

        if (concurrency === 'latest') {
          await expect(first).resolves.toMatchObject({ status: 'aborted' })
          await expect(second).resolves.toMatchObject({ status: 'committed' })
          expect(calls).toBe(2)
        }
        else if (concurrency === 'queue') {
          secondController.abort('cancel queued')
          await expect(second).resolves.toMatchObject({ status: expect.stringMatching(/^(aborted|stale)$/) })
          expect(calls).toBe(1)
          releaseFirst()
          await expect(first).resolves.toMatchObject({ status: 'committed' })
        }
        else {
          await expect(second).resolves.toMatchObject({ status: 'ignored' })
          expect(calls).toBe(1)
          firstController.abort('finish ignore case')
          await expect(first).resolves.toMatchObject({ status: expect.stringMatching(/^(aborted|stale)$/) })
        }
        releaseFirst()
      }
    }
  })

  it('keeps timeout and error policy terminal states observable', async () => {
    const timeoutPlan = actionFlow({
      id: 'timeout',
      errorPolicy: { onError: 'end', timeoutMs: 5 },
    })
    for (const runtime of await harnesses([timeoutPlan])) {
      runtime.register('work', () => new Promise(() => {}))
      await expect(runtime.run({ kind: 'form.submit' }, { name: 'Ada' })).resolves.toMatchObject({
        status: 'timeout',
        values: { name: 'Ada' },
      })
    }

    const failurePlan = actionFlow({
      id: 'failure-edge',
      errorPolicy: { onError: 'failure' },
      errorTerminal: true,
    })
    for (const runtime of await harnesses([failurePlan])) {
      runtime.register('work', () => {
        throw new Error('expected failure')
      })
      await expect(runtime.run({ kind: 'form.submit' }, { name: 'Ada' })).resolves.toMatchObject({
        status: 'failure',
        values: { name: 'Ada' },
      })
    }
  })
})
