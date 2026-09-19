import type { ComponentContract, ProjectDocument } from '../index'
import { describe, expect, it } from 'vitest'
import {
  applyProjectDraftTransaction,
  createComponentContractRegistry,
  createProjectSnapshot,
  PROJECT_DOCUMENT_VERSION,
  PROJECT_THEME_VERSION,
  SURFACE_GRAPH_VERSION,
} from '../index'

const inputContract: ComponentContract = {
  key: 'test.input',
  version: '1',
  kind: 'field',
  props: [{ key: 'placeholder', path: ['props', 'placeholder'] }],
  bindings: [],
  slots: [],
  allowedParents: [],
  defaults: { placeholder: '' },
  semanticTriggers: [],
  stateProjectionProperties: [],
  datasetBindings: [],
  resourceBindings: [],
}

function largeProject(nodeCount: number): {
  document: ProjectDocument
  registry: ReturnType<typeof createComponentContractRegistry>
} {
  const registry = createComponentContractRegistry([inputContract], {
    adapter: 'test-adapter',
    version: '1.0.0',
  })
  const nodeIds = Array.from({ length: nodeCount }, (_, index) => `field-${index}`)
  const nodesById = Object.fromEntries(nodeIds.map((id, index) => [id, {
    id,
    component: 'test.input',
    kind: 'field' as const,
    field: `field_${index}`,
    props: { placeholder: `Field ${index}` },
  }]))
  const document: ProjectDocument = {
    version: PROJECT_DOCUMENT_VERSION,
    id: 'large-project',
    name: 'Large project',
    homeSurfaceId: 'home',
    surfaceOrder: ['home'],
    surfacesById: {
      home: {
        id: 'home',
        kind: 'page',
        name: 'Home',
        route: '/',
        parameters: [],
        outputs: [],
        interactions: [],
        graph: {
          version: SURFACE_GRAPH_VERSION,
          props: {},
          form: {},
          root: nodeIds.map(nodeId => ({ nodeId, placement: {} })),
          nodesById,
        },
      },
    },
    datasetOrder: [],
    datasetsById: {},
    resources: {},
    theme: { version: PROJECT_THEME_VERSION },
    registryLock: registry.lock,
    settings: {},
  }
  return {
    registry,
    document: createProjectSnapshot(document).document as ProjectDocument,
  }
}

function p95(durations: number[]): number {
  durations.sort((left, right) => left - right)
  return durations[Math.floor(durations.length * 0.95) - 1]!
}

const describePerformance = process.env.CI && process.env.npm_lifecycle_event !== 'test:performance'
  ? describe.skip
  : describe
const performanceBudgetMultiplier = Number(process.env.CI_PERFORMANCE_BUDGET_MULTIPLIER ?? 1)

describePerformance('project model production performance budgets', () => {
  it('keeps a 2000-node drag draft below the 16ms p95 frame budget', () => {
    const { document, registry } = largeProject(2000)
    const durations: number[] = []
    for (let index = 0; index < 5; index += 1) {
      applyProjectDraftTransaction(document, {
        id: `warmup-move-${index}`,
        label: 'Warm up drag candidate',
        operations: [{
          type: 'node.move',
          surfaceId: 'home',
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
          surfaceId: 'home',
          nodeId: 'field-1000',
          target: { parentId: null, index: 1001 + (index % 2) },
        }],
      }, { registry })
      durations.push(performance.now() - startedAt)
      expect(result.success).toBe(true)
    }
    expect(p95(durations)).toBeLessThan(16 * performanceBudgetMultiplier)
    expect(document.surfacesById.home?.graph.root[1000]?.nodeId).toBe('field-1000')
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
          surfaceId: 'home',
          target: { parentId: null, index: 1000 },
          subgraph: {
            root: [{ nodeId: `warmup-candidate-${index}`, placement: {} }],
            nodesById: {
              [`warmup-candidate-${index}`]: {
                id: `warmup-candidate-${index}`,
                component: 'test.input',
                kind: 'field',
                field: `warmup_candidate_${index}`,
                props: { placeholder: 'Warmup' },
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
          surfaceId: 'home',
          target: { parentId: null, index: 1000 },
          subgraph: {
            root: [{ nodeId: `candidate-${index}`, placement: {} }],
            nodesById: {
              [`candidate-${index}`]: {
                id: `candidate-${index}`,
                component: 'test.input',
                kind: 'field',
                field: `candidate_${index}`,
                props: { placeholder: 'Candidate' },
              },
            },
          },
        }],
      }, { registry })
      durations.push(performance.now() - startedAt)
      expect(result.success).toBe(true)
    }
    expect(p95(durations)).toBeLessThan(16 * performanceBudgetMultiplier)
    expect(document.surfacesById.home?.graph.nodesById).not.toHaveProperty('candidate-0')
  })
})
