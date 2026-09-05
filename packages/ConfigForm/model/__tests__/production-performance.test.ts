import type { ComponentContract, ProjectDocument } from '../index'
import { describe, expect, it } from 'vitest'
import {
  applyProjectDraftTransaction,
  applyProjectTransaction,
  createComponentContractRegistry,
  PROJECT_DOCUMENT_VERSION,
} from '../index'

const inputContract: ComponentContract = {
  key: 'element.input',
  version: '1',
  kind: 'field',
  props: [{ key: 'placeholder', path: ['props', 'placeholder'] }],
  events: [],
  bindings: [],
  slots: [],
  allowedParents: [],
  defaults: { placeholder: '' },
}

function largeProject(nodeCount: number): { document: ProjectDocument, registry: ReturnType<typeof createComponentContractRegistry> } {
  const registry = createComponentContractRegistry([inputContract], {
    adapter: 'element-plus',
    version: '2.9.1',
  })
  const nodeIds = Array.from({ length: nodeCount }, (_, index) => `field-${index}`)
  const nodesById = Object.fromEntries(nodeIds.map((id, index) => [id, {
    id,
    component: 'element.input',
    kind: 'field' as const,
    field: `field_${index}`,
    props: { placeholder: `Field ${index}` },
    events: {},
    bindings: {},
  }]))
  return {
    registry,
    document: {
      version: PROJECT_DOCUMENT_VERSION,
      id: 'large-project',
      name: 'Large project',
      homePageId: 'home',
      pageOrder: ['home'],
      pagesById: {
        home: {
          id: 'home',
          name: 'Home',
          route: '/',
          graph: {
            version: 2,
            props: {},
            form: {},
            root: nodeIds.map(nodeId => ({ nodeId, placement: {} })),
            nodesById,
          },
        },
      },
      registryLock: registry.lock,
      settings: {},
      resources: {},
    },
  }
}

const describePerformance = process.env.CI && process.env.npm_lifecycle_event !== 'test:performance'
  ? describe.skip
  : describe
const performanceBudgetMultiplier = Number(process.env.CI_PERFORMANCE_BUDGET_MULTIPLIER ?? 1)

describePerformance('project model production performance budgets', () => {
  it.each([
    { nodeCount: 100, p95BudgetMs: 4 },
    { nodeCount: 500, p95BudgetMs: 8 },
    { nodeCount: 2000, p95BudgetMs: 16 },
  ])('keeps a $nodeCount-node committed transaction below $p95BudgetMs ms p95', ({ nodeCount, p95BudgetMs }) => {
    const { document, registry } = largeProject(nodeCount)
    const durations: number[] = []
    let current = document
    for (let index = 0; index < 5; index += 1) {
      applyProjectTransaction(current, {
        id: `warmup-${index}`,
        label: 'Warm up transaction',
        operations: [{
          type: 'node.props',
          pageId: 'home',
          nodeId: `field-${Math.floor(nodeCount / 2)}`,
          props: { placeholder: `Warmup ${index}` },
        }],
      }, { registry })
    }
    for (let index = 0; index < 20; index += 1) {
      const startedAt = performance.now()
      const result = applyProjectTransaction(current, {
        id: `edit-${index}`,
        label: 'Edit field',
        operations: [{
          type: 'node.props',
          pageId: 'home',
          nodeId: `field-${Math.floor(nodeCount / 2)}`,
          props: { placeholder: `Iteration ${index}` },
        }],
      }, { registry })
      durations.push(performance.now() - startedAt)
      expect(result.success).toBe(true)
      if (!result.success)
        return
      current = result.document
    }
    durations.sort((left, right) => left - right)
    const p95 = durations[Math.floor(durations.length * 0.95) - 1]!
    expect(p95).toBeLessThan(p95BudgetMs * performanceBudgetMultiplier)
    expect(document.pagesById.home?.graph.nodesById[`field-${Math.floor(nodeCount / 2)}`]).toMatchObject({
      props: { placeholder: `Field ${Math.floor(nodeCount / 2)}` },
    })
  })

  it('keeps a 2000-node drag draft below the 16ms p95 frame budget', () => {
    const { document, registry } = largeProject(2000)
    const durations: number[] = []
    for (let index = 0; index < 5; index += 1) {
      applyProjectDraftTransaction(document, {
        id: `warmup-move-${index}`,
        label: 'Warm up drag candidate',
        operations: [{
          type: 'node.move',
          pageId: 'home',
          nodeId: 'field-1000',
          target: { parentId: null, index: 1001 + (index % 2) },
        }],
      }, { registry })
    }
    for (let index = 0; index < 20; index += 1) {
      const startedAt = performance.now()
      const result = applyProjectDraftTransaction(document, {
        id: `move-${index}`,
        label: 'Move field candidate',
        operations: [{
          type: 'node.move',
          pageId: 'home',
          nodeId: 'field-1000',
          target: { parentId: null, index: 1001 + (index % 2) },
        }],
      }, { registry })
      durations.push(performance.now() - startedAt)
      expect(result.success).toBe(true)
    }
    durations.sort((left, right) => left - right)
    const p95 = durations[Math.floor(durations.length * 0.95) - 1]!
    expect(p95).toBeLessThan(16 * performanceBudgetMultiplier)
    expect(document.pagesById.home?.graph.root[1000]?.nodeId).toBe('field-1000')
  })

  it('keeps a 2000-node palette insertion draft below the 16ms p95 frame budget', () => {
    const { document, registry } = largeProject(2000)
    const durations: number[] = []
    for (let index = 0; index < 5; index += 1) {
      applyProjectDraftTransaction(document, {
        id: `warmup-insert-${index}`,
        label: 'Warm up palette candidate',
        operations: [{
          type: 'node.insert',
          pageId: 'home',
          target: { parentId: null, index: 1000 },
          subgraph: {
            root: [{ nodeId: `warmup-candidate-${index}`, placement: {} }],
            nodesById: {
              [`warmup-candidate-${index}`]: {
                id: `warmup-candidate-${index}`,
                component: 'element.input',
                kind: 'field',
                field: `warmup_candidate_${index}`,
                props: { placeholder: 'Warmup' },
                events: {},
                bindings: {},
              },
            },
          },
        }],
      }, { registry })
    }
    for (let index = 0; index < 20; index += 1) {
      const startedAt = performance.now()
      const result = applyProjectDraftTransaction(document, {
        id: `insert-${index}`,
        label: 'Insert field candidate',
        operations: [{
          type: 'node.insert',
          pageId: 'home',
          target: { parentId: null, index: 1000 },
          subgraph: {
            root: [{ nodeId: `candidate-${index}`, placement: {} }],
            nodesById: {
              [`candidate-${index}`]: {
                id: `candidate-${index}`,
                component: 'element.input',
                kind: 'field',
                field: `candidate_${index}`,
                props: { placeholder: 'Candidate' },
                events: {},
                bindings: {},
              },
            },
          },
        }],
      }, { registry })
      durations.push(performance.now() - startedAt)
      expect(result.success).toBe(true)
    }
    durations.sort((left, right) => left - right)
    const p95 = durations[Math.floor(durations.length * 0.95) - 1]!
    expect(p95).toBeLessThan(16 * performanceBudgetMultiplier)
    expect(document.pagesById.home?.graph.nodesById).not.toHaveProperty('candidate-0')
  })
})
