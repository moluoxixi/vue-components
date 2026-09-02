import type {
  ConfigFormFlow,
  ConfigFormFlowActionContext,
  ConfigFormFlowExecutionPlan,
  ConfigFormFlowTrigger,
  ConfigFormJsonObject,
} from '@moluoxixi/config-form-core'
import { Buffer } from 'node:buffer'
import {
  analyzeConfigFormFlow,
  CONFIG_FORM_FLOW_RUNTIME_VERSION,
  CONFIG_FORM_FLOW_VERSION,
  ConfigFormFlowInterpreter,
} from '@moluoxixi/config-form-core'
import { transformWithEsbuild } from 'vite'
import { describe, expect, it } from 'vitest'
import {
  applyPreviewFlowValuePatch,
  createPreviewFlowValuePatch,
  PreviewFlowCoordinator,
} from '../../preview'
import { createStandaloneFlowRuntimeSource } from '../export'

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

interface GeneratedFlowModule {
  FLOW_RUNTIME_VERSION: number
  applyFlowValuePatch: (target: FlowValues, before: FlowValues, after: FlowValues) => void
  registerFlowAction: (ref: string, action: PortableAction) => void
  runFlows: (trigger: ConfigFormFlowTrigger, values?: FlowValues, signal?: AbortSignal) => Promise<PortableFlowResult>
}

let generatedModuleSequence = 0

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
    ],
  })
}

function createCoreHarness(plans: readonly ConfigFormFlowExecutionPlan[]): PortableFlowHarness {
  const actions = new Map<string, PortableAction>()
  const interpreter = new ConfigFormFlowInterpreter({
    get: ref => actions.has(ref)
      ? { execute: (input, context) => actions.get(ref)!(input, context) }
      : undefined,
  })
  const coordinator = new PreviewFlowCoordinator(interpreter)
  return {
    runtimeVersion: interpreter.runtimeVersion,
    register: (ref, action) => actions.set(ref, action),
    applyPatch: (current, before, after) => applyPreviewFlowValuePatch(
      current,
      createPreviewFlowValuePatch(before, after),
    ),
    async run(trigger, values = {}, signal) {
      const result = await coordinator.dispatch({ plans, trigger, values, revision: 1, signal })
      return {
        status: result.status,
        values: applyPreviewFlowValuePatch(values, result.valuePatch),
        ...(result.error ? { error: result.error.message } : {}),
      }
    },
  }
}

async function createGeneratedHarness(plans: readonly ConfigFormFlowExecutionPlan[]): Promise<PortableFlowHarness> {
  const source = createStandaloneFlowRuntimeSource(plans)
  const transformed = await transformWithEsbuild(source, 'flows.ts', {
    format: 'esm',
    loader: 'ts',
    target: 'es2022',
  })
  const encoded = Buffer.from(transformed.code).toString('base64')
  const module = await import(`data:text/javascript;base64,${encoded}#${++generatedModuleSequence}`) as GeneratedFlowModule
  return {
    runtimeVersion: module.FLOW_RUNTIME_VERSION,
    register: module.registerFlowAction,
    applyPatch(current, before, after) {
      const next = { ...current }
      module.applyFlowValuePatch(next, before, after)
      return next
    },
    run: module.runFlows,
  }
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
