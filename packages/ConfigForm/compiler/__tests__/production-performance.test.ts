import type {
  ComponentContract,
  FieldNode,
  ProjectDocument,
} from '@moluoxixi/config-form-model'
import { performance } from 'node:perf_hooks'
import {
  applyProjectTransaction,
  createComponentContractRegistry,
  createProjectDraftSnapshotFromTransaction,
  createProjectSnapshot,
  createRegistryContractSnapshot,
  PROJECT_DOCUMENT_VERSION,
} from '@moluoxixi/config-form-model'
import { describe, expect, it } from 'vitest'
import { createCompileCoordinator } from '../index'

const NODE_COUNT = 2_000
const describePerformance = process.env.CI && process.env.npm_lifecycle_event !== 'test:performance'
  ? describe.skip
  : describe
const performanceBudgetMultiplier = Number(process.env.CI_PERFORMANCE_BUDGET_MULTIPLIER ?? 1)

function fixture() {
  const contract: ComponentContract = {
    key: 'element.input',
    version: '1',
    kind: 'field',
    props: [{ key: 'placeholder', path: ['props', 'placeholder'] }],
    events: [],
    bindings: [{ name: 'model', valueProp: 'modelValue', trigger: 'update:modelValue' }],
    slots: [],
    allowedParents: [],
    defaults: {},
  }
  const registry = createComponentContractRegistry([contract], {
    adapter: 'element-plus',
    version: '2.9.1',
  })
  const nodesById: Record<string, FieldNode> = Object.create(null)
  const root = Array.from({ length: NODE_COUNT }, (_, index) => {
    const id = `field-${index}`
    nodesById[id] = {
      id,
      component: 'element.input',
      kind: 'field',
      field: id,
      props: { placeholder: `Field ${index}` },
      events: {},
      bindings: {},
    }
    return { nodeId: id, placement: { span: 6 } }
  })
  const document: ProjectDocument = {
    version: PROJECT_DOCUMENT_VERSION,
    id: 'performance-project',
    name: 'Performance project',
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
          form: { columns: 24 },
          root,
          nodesById,
        },
      },
    },
    registryLock: structuredClone(registry.lock),
    settings: {},
    resources: {},
  }
  return {
    contractRegistry: registry,
    registry: createRegistryContractSnapshot(registry),
    snapshot: createProjectSnapshot(document, 1),
  }
}

describePerformance('page compilation production budget', () => {
  it('compiles a 2000-node active page without assembling a project program', () => {
    const input = fixture()
    const coordinator = createCompileCoordinator({ registry: input.registry })
    coordinator.acceptSnapshot(input.snapshot)

    const startedAt = performance.now()
    const result = coordinator.compilePage('home')
    const duration = performance.now() - startedAt

    expect(result.success).toBe(true)
    if (!result.success)
      return
    expect(Object.keys(result.compilation.page.nodesById)).toHaveLength(NODE_COUNT)
    expect(duration).toBeLessThan(750 * performanceBudgetMultiplier)
  })

  it('keeps a single-node 2000-node page update within one frame and preserves unrelated IR', () => {
    const input = fixture()
    const coordinator = createCompileCoordinator({ registry: input.registry })
    let snapshot = input.snapshot
    coordinator.acceptSnapshot(snapshot)
    let previous = coordinator.compilePage('home')
    expect(previous.success).toBe(true)
    if (!previous.success)
      return
    const durations: number[] = []

    for (let index = 0; index < 20; index += 1) {
      const applied = applyProjectTransaction(snapshot.document as ProjectDocument, {
        id: `incremental-${index}`,
        label: 'Edit one field',
        operations: [{
          type: 'node.props',
          pageId: 'home',
          nodeId: 'field-1000',
          props: { placeholder: `Iteration ${index}` },
        }],
      }, { registry: input.contractRegistry })
      expect(applied.success && applied.changed).toBe(true)
      if (!applied.success || !applied.changed)
        return
      snapshot = createProjectSnapshot(applied.document, snapshot.editVersion + 1)
      coordinator.acceptSnapshot(snapshot, {
        project: applied.changedProject,
        pageIds: applied.changedPageIds,
        nodeIds: applied.changedNodeIds,
        nodeChanges: applied.changedNodeChanges,
      })
      const startedAt = performance.now()
      const next = coordinator.compilePage('home')
      durations.push(performance.now() - startedAt)
      expect(next.success).toBe(true)
      if (!next.success)
        return
      expect(next.compilation.page.nodesById['field-0']).toBe(previous.compilation.page.nodesById['field-0'])
      expect(next.compilation.page.nodesById['field-1000']).not.toBe(previous.compilation.page.nodesById['field-1000'])
      previous = next
    }

    durations.sort((left, right) => left - right)
    const p95 = durations[Math.floor(durations.length * 0.95) - 1]!
    expect(p95).toBeLessThan(16.7 * performanceBudgetMultiplier)
  })

  it('keeps a 2000-node drag candidate transaction, snapshot, and compile within one frame', () => {
    const input = fixture()
    const coordinator = createCompileCoordinator({ registry: input.registry })
    coordinator.acceptSnapshot(input.snapshot)
    expect(coordinator.compilePage('home').success).toBe(true)
    const durations: number[] = []

    for (let index = 0; index < 20; index += 1) {
      const startedAt = performance.now()
      const applied = applyProjectTransaction(input.snapshot.document as ProjectDocument, {
        id: `candidate-move-${index}`,
        label: 'Move candidate',
        operations: [{
          type: 'node.move',
          pageId: 'home',
          nodeId: 'field-1000',
          target: { parentId: null, index: 1001 + index },
        }],
      }, { registry: input.contractRegistry })
      expect(applied.success && applied.changed).toBe(true)
      if (!applied.success || !applied.changed)
        return
      const draft = createProjectDraftSnapshotFromTransaction(
        input.snapshot,
        applied,
        `candidate-${index}`,
      )
      const compiled = coordinator.compileDraftPage(draft, 'home', {
        project: applied.changedProject,
        pageIds: applied.changedPageIds,
        nodeIds: applied.changedNodeIds,
        nodeChanges: applied.changedNodeChanges,
      })
      durations.push(performance.now() - startedAt)
      expect(compiled.success).toBe(true)
    }

    durations.sort((left, right) => left - right)
    const p95 = durations[Math.floor(durations.length * 0.95) - 1]!
    expect(p95).toBeLessThan(16.7 * performanceBudgetMultiplier)
  })
})
