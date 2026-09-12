import type { ConfigFormFlow, ConfigFormFlowTriggerKind } from '@moluoxixi/config-form-core'
import type { ProjectDocument, ProjectPage } from '../index'
import {
  analyzeConfigFormFlow,
  CONFIG_FORM_FLOW_TRIGGER_KINDS,
  CONFIG_FORM_FLOW_VERSION,
} from '@moluoxixi/config-form-core'
import { describe, expect, it } from 'vitest'
import {
  applyProjectTransaction,
  flowSchema,
  PAGE_GRAPH_VERSION,
  PROJECT_DOCUMENT_VERSION,
  projectPageContentSchema,
} from '../index'

function flow(kind: ConfigFormFlowTriggerKind = 'form.beforeSubmit'): ConfigFormFlow {
  return {
    version: CONFIG_FORM_FLOW_VERSION,
    id: 'confirm-submit',
    name: 'Confirm submission',
    trigger: kind === 'component.event'
      ? { kind, nodeId: 'submit-button', event: 'click' }
      : { kind },
    errorPolicy: { onError: 'failure', timeoutMs: 0 },
    nodes: [
      { id: 'start', type: 'trigger' },
      {
        id: 'confirm',
        type: 'action',
        ref: 'builtin.ui.confirm',
        config: { input: { message: 'Submit this form?' } },
        policy: {
          when: { kind: 'literal', value: true },
          stopWhen: { kind: 'literal', value: false },
          onError: 'continue',
          timeoutMs: 0,
        },
      },
      { id: 'stop', type: 'blocked' },
    ],
    edges: [
      { id: 'start-confirm', source: 'start', target: 'confirm', condition: 'next' },
      { id: 'confirm-stop', source: 'confirm', target: 'stop', condition: 'next' },
    ],
  }
}

describe('event product persistence contract', () => {
  it.each(CONFIG_FORM_FLOW_TRIGGER_KINDS)('accepts the shared %s lifecycle without dropping execution semantics', (kind) => {
    const original = flow(kind)
    const restored = flowSchema.parse(JSON.parse(JSON.stringify(original)))
    expect(restored).toEqual(original)
    expect(analyzeConfigFormFlow(restored).success).toBe(true)
  })

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('rejects invalid timeout %s at both policy boundaries', (timeoutMs) => {
    const invalidFlow = flow()
    invalidFlow.errorPolicy!.timeoutMs = timeoutMs
    expect(flowSchema.safeParse(invalidFlow).success).toBe(false)

    const invalidNode = flow()
    invalidNode.nodes[1]!.policy!.timeoutMs = timeoutMs
    expect(flowSchema.safeParse(invalidNode).success).toBe(false)
  })

  it('rejects unsupported policies and malformed conditions instead of stripping them', () => {
    const original = flow()
    const node = original.nodes[1]!
    for (const policy of [
      { onError: 'silence' },
      { when: { kind: 'compare' } },
      { stopWhen: { kind: 'literal', value: 'true' } },
      { script: 'submit()' },
    ]) {
      expect(flowSchema.safeParse({
        ...original,
        nodes: [original.nodes[0], { ...node, policy }, original.nodes[2]],
      }).success).toBe(false)
    }
  })

  it('rejects unknown lifecycle names and unknown node configuration members', () => {
    const original = flow()
    expect(flowSchema.safeParse({ ...original, trigger: { kind: 'form.unknown' } }).success).toBe(false)
    expect(flowSchema.safeParse({
      ...original,
      nodes: original.nodes.map(node => ({ ...node, javascript: 'return true' })),
    }).success).toBe(false)
  })
})

function pageWithFlow(candidate: ConfigFormFlow): ProjectPage {
  return {
    id: 'home',
    name: 'Home',
    route: '/',
    graph: {
      version: PAGE_GRAPH_VERSION,
      props: {},
      form: {},
      root: [{ nodeId: 'name-input', placement: {} }],
      nodesById: {
        'name-input': {
          id: 'name-input',
          component: 'input',
          kind: 'field',
          field: 'name',
          props: {},
          events: {},
          bindings: {},
        },
      },
    },
    flows: [candidate],
  }
}

describe('flow page reference integrity', () => {
  it('locates a nested action input instead of silently accepting an unknown field', () => {
    const candidate = flow()
    candidate.nodes[1]!.config = { input: { message: { $field: 'missing' } } }
    const { graph, flows } = pageWithFlow(candidate)
    const result = projectPageContentSchema.safeParse({ graph, flows })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues).toContainEqual(expect.objectContaining({
        message: 'Flow references an unknown field: missing',
        path: ['flows', 0, 'nodes', 1, 'config', 'input', 'message', '$field'],
      }))
    }
  })

  it.each(['when', 'stopWhen'] as const)('checks fields referenced by the node %s policy', (key) => {
    const candidate = flow()
    candidate.nodes[1]!.policy![key] = {
      kind: 'compare',
      operator: 'eq',
      left: { kind: 'field', field: 'missing' },
      right: { kind: 'literal', value: true },
    }
    const { graph, flows } = pageWithFlow(candidate)
    const result = projectPageContentSchema.safeParse({ graph, flows })
    expect(result.success).toBe(false)
    if (!result.success)
      expect(result.error.issues.some(issue => issue.path.join('.') === `flows.0.nodes.1.policy.${key}.left.field`)).toBe(true)
  })

  it('checks reaction targets and operands through the same page boundary', () => {
    const candidate = flow()
    candidate.nodes[1] = {
      id: 'confirm',
      type: 'reaction',
      config: {
        reactions: [{
          id: 'assign',
          when: { kind: 'literal', value: true },
          then: [{ kind: 'setValue', target: 'missing-target', value: { kind: 'field', field: 'missing-source' } }],
        }],
      },
    }
    const { graph, flows } = pageWithFlow(candidate)
    const result = projectPageContentSchema.safeParse({ graph, flows })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.map(issue => issue.message)).toEqual(expect.arrayContaining([
        'Flow references an unknown field: missing-target',
        'Flow references an unknown field: missing-source',
      ]))
    }
  })

  it.each(['input', 'output'] as const)('rejects deletion atomically when a field is used by action %s', (key) => {
    const candidate = flow()
    candidate.nodes[1]!.config![key] = { message: { $field: 'name' } }
    const page = pageWithFlow(candidate)
    const document: ProjectDocument = {
      version: PROJECT_DOCUMENT_VERSION,
      id: 'project',
      name: 'Project',
      homePageId: page.id,
      pageOrder: [page.id],
      pagesById: { [page.id]: page },
      registryLock: { adapter: 'test', version: '1', fingerprint: 'test', components: {} },
      settings: {},
      resources: {},
    }
    const original = structuredClone(document)
    const result = applyProjectTransaction(document, {
      id: 'delete-field',
      label: 'Delete field',
      operations: [{ type: 'node.remove', pageId: page.id, nodeId: 'name-input' }],
    })
    expect(result.success).toBe(false)
    expect(result.document).toEqual(original)
    expect(document).toEqual(original)
    expect(result.diagnostics.some(diagnostic => diagnostic.message.includes('unknown field: name'))).toBe(true)
  })

  it('returns navigable path segments for malformed condition diagnostics', () => {
    const candidate = flow()
    candidate.nodes[1] = {
      id: 'confirm',
      type: 'condition',
      config: { condition: { kind: 'literal', value: 'invalid' } },
    }
    const { graph, flows } = pageWithFlow(candidate)
    const result = projectPageContentSchema.safeParse({ graph, flows })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some(issue =>
        JSON.stringify(issue.path.slice(0, 6)) === JSON.stringify(['flows', 0, 'nodes', 1, 'config', 'condition']))).toBe(true)
    }
  })
})
