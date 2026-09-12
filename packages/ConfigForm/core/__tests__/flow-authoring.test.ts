import type { ConfigFormFlow } from '../src/flow'
import type {
  ConfigFormFlowMetadata,
  ConfigFormFlowStep,
} from '../src/flow-authoring'
import { describe, expect, it, vi } from 'vitest'
import { ConfigFormFlowInterpreter } from '../src/flow'
import {
  cloneConfigFormFlowSteps,
  createConfigFormFlowFromSteps,
  getConfigFormFlowStepOutputs,
  insertConfigFormFlowStep,
  moveConfigFormFlowStep,
  readConfigFormFlowSteps,
  removeConfigFormFlowStep,
  validateConfigFormFlowSteps,
} from '../src/flow-authoring'

const metadata: ConfigFormFlowMetadata = {
  version: 1,
  id: 'authoring-flow',
  name: 'Authoring flow',
  trigger: { kind: 'form.submit' },
  concurrency: 'queue',
  errorPolicy: { onError: 'failure', timeoutMs: 5000 },
}

function action(id: string, input?: Extract<ConfigFormFlowStep, { type: 'action' }>['input']): ConfigFormFlowStep {
  return {
    id,
    type: 'action',
    ref: `test.${id}`,
    ...(input === undefined ? {} : { input }),
  }
}

function createFlow(steps: readonly ConfigFormFlowStep[]): ConfigFormFlow {
  const result = createConfigFormFlowFromSteps(metadata, steps)
  expect(result.success, JSON.stringify(result.diagnostics)).toBe(true)
  if (!result.success)
    throw new Error(JSON.stringify(result.diagnostics))
  return result.flow
}

describe('config form flow authoring', () => {
  it('round-trips two nested condition levels with titles, reactions, policies, and termination', () => {
    const steps: ConfigFormFlowStep[] = [
      {
        id: 'load',
        type: 'action',
        title: 'Load profile',
        ref: 'profile.load',
        input: { userId: { $field: 'userId' } },
        output: { profile: { $output: 'load' } },
        policy: {
          when: { kind: 'literal', value: true },
          stopWhen: { kind: 'literal', value: false },
          onError: 'failure',
          timeoutMs: 250,
        },
      },
      {
        id: 'outer',
        type: 'condition',
        title: 'Loaded?',
        when: { kind: 'expression', expression: '$outputs.load.ok == true' },
        then: [{
          id: 'inner',
          type: 'condition',
          when: { kind: 'literal', value: true },
          then: [{
            id: 'project',
            type: 'reaction',
            title: 'Project state',
            reactions: [{
              id: 'mark-ready',
              when: { kind: 'literal', value: true },
              then: [{ kind: 'setValue', target: 'status', value: { kind: 'literal', value: 'ready' } }],
            }],
            policy: { onError: 'continue', timeoutMs: 0 },
          }],
          else: [],
        }],
        else: [{ id: 'blocked', type: 'terminate', title: 'Stop submit', outcome: 'blocked' }],
      },
      {
        id: 'save',
        type: 'action',
        ref: 'profile.save',
        input: { profile: { $output: 'load' }, event: { $event: 'args.0' } },
      },
      { id: 'success', type: 'terminate', outcome: 'success' },
    ]

    const flow = createFlow(steps)
    expect(flow.nodes.filter(node => node.type === 'trigger')).toHaveLength(1)
    expect(flow.nodes.some(node => node.id.includes('join:'))).toBe(true)
    expect(flow).not.toHaveProperty('steps')

    const read = readConfigFormFlowSteps(JSON.parse(JSON.stringify(flow)) as ConfigFormFlow)
    expect(read.success, JSON.stringify(read.diagnostics)).toBe(true)
    expect(read.steps).toEqual(steps)

    const recreated = createConfigFormFlowFromSteps(metadata, read.steps)
    expect(recreated.success).toBe(true)
    if (recreated.success)
      expect(recreated.flow).toEqual(flow)
  })

  it('inserts into both branches and supports pure move and remove edits', () => {
    const original: ConfigFormFlowStep[] = [{
      id: 'choose',
      type: 'condition',
      when: { kind: 'literal', value: true },
      then: [],
      else: [],
    }]
    const thenInserted = insertConfigFormFlowStep(original, action('then-action'), {
      parentId: 'choose',
      branch: 'then',
      index: 0,
    })
    expect(thenInserted).toMatchObject({ applied: true, success: true })
    const elseInserted = insertConfigFormFlowStep(thenInserted.steps, action('else-action'), {
      parentId: 'choose',
      branch: 'else',
    })
    expect(elseInserted).toMatchObject({ applied: true, success: true })
    expect(original[0]).toMatchObject({ then: [], else: [] })

    const moved = moveConfigFormFlowStep(elseInserted.steps, 'then-action', {
      parentId: 'choose',
      branch: 'else',
      index: 1,
    })
    expect(moved).toMatchObject({ applied: true, success: true })
    expect((moved.steps[0] as Extract<ConfigFormFlowStep, { type: 'condition' }>).else.map(step => step.id)).toEqual([
      'else-action',
      'then-action',
    ])

    const removed = removeConfigFormFlowStep(moved.steps, 'else-action')
    expect(removed).toMatchObject({ applied: true, success: true })
    expect((removed.steps[0] as Extract<ConfigFormFlowStep, { type: 'condition' }>).else.map(step => step.id)).toEqual([
      'then-action',
    ])
  })

  it('uses an explicit join for empty branches and executes the continuation once', async () => {
    const steps: ConfigFormFlowStep[] = [
      {
        id: 'empty-choice',
        type: 'condition',
        when: { kind: 'literal', value: true },
        then: [],
        else: [],
      },
      action('after-empty'),
    ]
    const flow = createFlow(steps)
    const condition = flow.nodes.find(node => node.id === 'empty-choice')!
    const outlets = flow.edges.filter(edge => edge.source === condition.id)
    expect(outlets).toHaveLength(2)
    expect(new Set(outlets.map(edge => edge.target)).size).toBe(1)
    expect(readConfigFormFlowSteps(flow)).toMatchObject({ success: true, steps })

    const execute = vi.fn(() => 'continued')
    const result = await new ConfigFormFlowInterpreter({ get: () => ({ execute }) }).run(flow)
    expect(result.status).toBe('end')
    expect(execute).toHaveBeenCalledTimes(1)
  })

  it('keeps two terminating branches separate without an unreachable join', () => {
    const steps: ConfigFormFlowStep[] = [{
      id: 'terminal-choice',
      type: 'condition',
      when: { kind: 'literal', value: true },
      then: [{ id: 'yes', type: 'terminate', outcome: 'success' }],
      else: [{ id: 'no', type: 'terminate', outcome: 'failure' }],
    }]
    const flow = createFlow(steps)
    expect(flow.nodes.some(node => node.id.includes('join:'))).toBe(false)
    expect(readConfigFormFlowSteps(flow)).toMatchObject({ success: true, steps })
  })

  it('preserves a continuation outside a condition when the other branch terminates', () => {
    const steps: ConfigFormFlowStep[] = [
      {
        id: 'optional-stop',
        type: 'condition',
        when: { kind: 'literal', value: false },
        then: [{ id: 'stop', type: 'terminate', outcome: 'blocked' }],
        else: [action('surviving-branch')],
      },
      action('after-condition', { $output: 'surviving-branch' }),
      { id: 'done', type: 'terminate', outcome: 'end' },
    ]
    const flow = createFlow(steps)
    const read = readConfigFormFlowSteps(flow)
    expect(read.success, JSON.stringify(read.diagnostics)).toBe(true)
    expect(read.steps).toEqual(steps)
    expect(read.steps.map(step => step.id)).toEqual(['optional-stop', 'after-condition', 'done'])
    expect(getConfigFormFlowStepOutputs(steps, 'after-condition').map(output => output.stepId)).toEqual([
      'surviving-branch',
    ])
  })

  it('clones every step id and remaps direct and parsed expression output references', () => {
    const steps: ConfigFormFlowStep[] = [
      action('source'),
      {
        id: 'consumer',
        type: 'action',
        ref: 'test.consumer',
        input: {
          direct: { $output: 'source' },
          external: { $output: 'outside' },
          expression: { $expression: '$outputs.source.value + $outputs["outside"].value' },
          stableDirect: { $ref: { kind: 'output', stepId: 'source', path: ['value'] } },
          stableExpression: { $ref: { kind: 'expression', source: '$outputs["source"].value + $outputs["outside"].value' } },
          escaped: {
            $ref: {
              kind: 'literal',
              value: {
                legacy: { $output: 'source' },
                stable: { $ref: { kind: 'output', stepId: 'source' } },
              },
            },
          },
        },
        policy: {
          when: { kind: 'expression', expression: '$outputs.source.ready == true' },
        },
      },
      { id: 'done', type: 'terminate', outcome: 'success' },
    ]

    const cloned = cloneConfigFormFlowSteps(steps, id => `copy-${id}`)
    expect(cloned.success, JSON.stringify(cloned.diagnostics)).toBe(true)
    expect(cloned.steps.map(step => step.id)).toEqual(['copy-source', 'copy-consumer', 'copy-done'])
    const consumer = cloned.steps[1] as Extract<ConfigFormFlowStep, { type: 'action' }>
    expect(consumer.input).toMatchObject({
      direct: { $output: 'copy-source' },
      external: { $output: 'outside' },
      stableDirect: { $ref: { kind: 'output', stepId: 'copy-source', path: ['value'] } },
    })
    expect(JSON.stringify(consumer.input)).toContain('$outputs[\\"copy-source\\"]')
    expect(JSON.stringify(consumer.input)).toContain('$outputs[\\"outside\\"]')
    const stableExpression = (consumer.input as {
      stableExpression: { $ref: { source: string } }
    }).stableExpression.$ref.source
    expect(stableExpression).toContain('$outputs["copy-source"]')
    expect(stableExpression).toContain('$outputs["outside"]')
    expect((consumer.input as Record<string, unknown>).escaped).toEqual({
      $ref: {
        kind: 'literal',
        value: {
          legacy: { $output: 'source' },
          stable: { $ref: { kind: 'output', stepId: 'source' } },
        },
      },
    })
    expect(consumer.policy?.when).toMatchObject({
      kind: 'expression',
      expression: expect.stringContaining('$outputs["copy-source"]'),
    })
    expect(steps[1]).not.toBe(consumer)

    const dynamic = cloneConfigFormFlowSteps([{
      id: 'dynamic',
      type: 'action',
      ref: 'test.dynamic',
      input: { $expression: '$outputs[key]' },
    }], id => `copy-${id}`)
    expect(dynamic.success).toBe(false)
    expect(dynamic.diagnostics.map(diagnostic => diagnostic.code)).toContain('FLOW_AUTHORING_OUTPUT_EXPRESSION_DYNAMIC')
  })

  it('diagnoses generated-id collisions, budgets, dangerous keys, and cyclic values', () => {
    const empty = createConfigFormFlowFromSteps(metadata, [])
    expect(empty.success).toBe(true)
    if (!empty.success)
      return
    const generatedId = empty.flow.nodes[0]!.id
    const collision = createConfigFormFlowFromSteps(metadata, [action(generatedId)])
    expect(collision.success).toBe(false)
    expect(collision.diagnostics.map(diagnostic => diagnostic.code)).toContain('FLOW_AUTHORING_GENERATED_ID_COLLISION')

    const oversized = Array.from({ length: 4097 }, (_, index): ConfigFormFlowStep => action(`step-${index}`))
    expect(validateConfigFormFlowSteps(oversized).map(diagnostic => diagnostic.code)).toContain('FLOW_AUTHORING_STEP_LIMIT_EXCEEDED')

    let nested: ConfigFormFlowStep[] = []
    for (let index = 0; index < 33; index += 1) {
      nested = [{
        id: `condition-${index}`,
        type: 'condition',
        when: { kind: 'literal', value: true },
        then: nested,
        else: [],
      }]
    }
    expect(validateConfigFormFlowSteps(nested).map(diagnostic => diagnostic.code)).toContain('FLOW_AUTHORING_DEPTH_EXCEEDED')

    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    const cyclicStep = action('cyclic') as Extract<ConfigFormFlowStep, { type: 'action' }>
    cyclicStep.input = cyclic as Extract<ConfigFormFlowStep, { type: 'action' }>['input']
    expect(validateConfigFormFlowSteps([cyclicStep]).map(diagnostic => diagnostic.code)).toContain('FLOW_AUTHORING_CYCLE')

    const unsafe: Record<string, unknown> = {}
    Object.defineProperty(unsafe, '__proto__', { enumerable: true, value: 'unsafe' })
    const unsafeStep = action('unsafe') as Extract<ConfigFormFlowStep, { type: 'action' }>
    unsafeStep.input = unsafe as Extract<ConfigFormFlowStep, { type: 'action' }>['input']
    expect(validateConfigFormFlowSteps([unsafeStep]).map(diagnostic => diagnostic.code)).toContain('FLOW_AUTHORING_UNSAFE_KEY')

    const malformedReference = action('malformed-reference') as Extract<ConfigFormFlowStep, { type: 'action' }>
    malformedReference.input = { $ref: { kind: 'output', stepId: '' } } as never
    expect(validateConfigFormFlowSteps([malformedReference])).toContainEqual(expect.objectContaining({
      code: 'CONFIG_FORM_VALUE_REFERENCE_INVALID',
      path: 'steps.0.input.$ref.stepId',
    }))
  })

  it('excludes mutually exclusive outputs after a join and diagnoses downstream references', () => {
    const steps: ConfigFormFlowStep[] = [
      action('before'),
      {
        id: 'choose',
        type: 'condition',
        when: { kind: 'literal', value: true },
        then: [action('then-only')],
        else: [action('else-only')],
      },
      {
        id: 'after',
        type: 'action',
        ref: 'test.after',
        input: { $ref: { kind: 'output', stepId: 'then-only', path: ['value'] } },
      },
    ]

    expect(getConfigFormFlowStepOutputs(steps, 'then-only').map(output => output.stepId)).toEqual(['before'])
    expect(getConfigFormFlowStepOutputs(steps, 'else-only').map(output => output.stepId)).toEqual(['before'])
    expect(getConfigFormFlowStepOutputs(steps, 'after').map(output => output.stepId)).toEqual(['before'])
    expect(validateConfigFormFlowSteps(steps)).toContainEqual(expect.objectContaining({
      code: 'FLOW_AUTHORING_OUTPUT_UNAVAILABLE',
      stepId: 'after',
    }))
    expect(createConfigFormFlowFromSteps(metadata, steps).success).toBe(false)
  })

  it('diagnoses non-structured DAG merges instead of dropping graph nodes', () => {
    const structured = createFlow([
      {
        id: 'choose',
        type: 'condition',
        when: { kind: 'literal', value: true },
        then: [action('left')],
        else: [action('right')],
      },
      action('shared'),
    ])
    const flow = structuredClone(structured)
    const join = flow.nodes.find(node => node.id.includes('join:'))!
    flow.nodes = flow.nodes.filter(node => node.id !== join.id)
    flow.edges = flow.edges
      .filter(edge => edge.source !== join.id)
      .map(edge => edge.target === join.id ? { ...edge, target: 'shared' } : edge)

    const read = readConfigFormFlowSteps(flow)
    expect(read.success).toBe(false)
    expect(read.steps).toEqual([])
    expect(read.diagnostics.map(diagnostic => diagnostic.code)).toContain('FLOW_AUTHORING_GRAPH_UNSTRUCTURED_MERGE')
  })

  it('executes the actual true and false branch results without running the other branch', async () => {
    const steps: ConfigFormFlowStep[] = [
      {
        id: 'route',
        type: 'condition',
        when: {
          kind: 'compare',
          operator: 'eq',
          left: { kind: 'field', field: 'route' },
          right: { kind: 'literal', value: 'left' },
        },
        then: [action('left')],
        else: [action('right')],
      },
      action('after'),
      { id: 'done', type: 'terminate', outcome: 'success' },
    ]
    const flow = createFlow(steps)
    const execute = vi.fn((_input: unknown, context: { node: { id: string } }) => context.node.id)
    const interpreter = new ConfigFormFlowInterpreter({ get: () => ({ execute }) })

    const left = await interpreter.run(flow, { values: { route: 'left' } })
    expect(left.status).toBe('success')
    expect(left.outputs).toMatchObject({ left: 'left', after: 'after' })
    expect(left.outputs).not.toHaveProperty('right')

    const right = await interpreter.run(flow, { values: { route: 'right' } })
    expect(right.status).toBe('success')
    expect(right.outputs).toMatchObject({ right: 'right', after: 'after' })
    expect(right.outputs).not.toHaveProperty('left')
  })
})
