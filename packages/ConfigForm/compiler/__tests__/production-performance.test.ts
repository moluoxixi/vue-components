import type { ProjectDocument } from '@moluoxixi/config-form-model'
import { createProjectSnapshot } from '@moluoxixi/config-form-model'
import { performance } from 'node:perf_hooks'
import { describe, expect, it } from 'vitest'
import { createCompileCoordinator } from '../index'
import { createCompilerFixture } from './fixtures'

const NODE_COUNT = 2_000
const describePerformance = process.env.CI && process.env.npm_lifecycle_event !== 'test:performance'
  ? describe.skip
  : describe
const performanceBudgetMultiplier = Number(process.env.CI_PERFORMANCE_BUDGET_MULTIPLIER ?? 1)

function fixture() {
  const input = createCompilerFixture()
  const document = structuredClone(input.snapshot.document) as ProjectDocument
  const surface = document.surfacesById.home!
  const nodesById: Record<string, {
    id: string
    component: string
    kind: 'field'
    field: string
    props: Record<string, unknown>
  }> = Object.create(null)
  const root = Array.from({ length: NODE_COUNT }, (_, index) => {
    const id = `field-${index}`
    nodesById[id] = {
      id,
      component: 'field.input',
      kind: 'field',
      field: id,
      props: { placeholder: `Field ${index}` },
    }
    return { nodeId: id, placement: { span: 6 } }
  })
  surface.graph = {
    ...surface.graph,
    root,
    nodesById,
  } as typeof surface.graph
  surface.interactions = []
  return {
    ...input,
    snapshot: createProjectSnapshot(document, 1),
  }
}

describePerformance('Surface compilation production budget', () => {
  it('compiles a 2000-node active Surface without assembling a project program', () => {
    const input = fixture()
    const coordinator = createCompileCoordinator({ registry: input.registry })
    coordinator.acceptSnapshot(input.snapshot)

    const startedAt = performance.now()
    const result = coordinator.compileSurface('home')
    const duration = performance.now() - startedAt

    expect(result.success).toBe(true)
    if (!result.success)
      return
    expect(Object.keys(result.compilation.surface.nodesById)).toHaveLength(NODE_COUNT)
    expect(duration).toBeLessThan(750 * performanceBudgetMultiplier)
  })

  it('keeps a single-node update incremental and preserves unrelated IR', () => {
    const input = fixture()
    const coordinator = createCompileCoordinator({ registry: input.registry })
    let snapshot = input.snapshot
    coordinator.acceptSnapshot(snapshot)
    let previous = coordinator.compileSurface('home')
    expect(previous.success).toBe(true)
    if (!previous.success)
      return
    const durations: number[] = []

    for (let index = 0; index < 10; index += 1) {
      const document = structuredClone(snapshot.document) as ProjectDocument
      document.surfacesById.home!.graph.nodesById['field-1000']!.props = { placeholder: `Iteration ${index}` }
      snapshot = createProjectSnapshot(document, snapshot.editVersion + 1)
      coordinator.acceptSnapshot(snapshot, {
        project: false,
        surfaceIds: [],
        datasetIds: [],
        resourceIds: [],
        nodeChanges: [{
          surfaceId: 'home',
          nodeId: 'field-1000',
          kind: 'content',
        }],
      })
      const startedAt = performance.now()
      const next = coordinator.compileSurface('home')
      durations.push(performance.now() - startedAt)
      expect(next.success).toBe(true)
      if (!next.success)
        return
      expect(next.compilation.surface.nodesById['field-0']).toBe(previous.compilation.surface.nodesById['field-0'])
      expect(next.compilation.surface.nodesById['field-1000']).not.toBe(previous.compilation.surface.nodesById['field-1000'])
      previous = next
    }

    durations.sort((left, right) => left - right)
    const p95 = durations[Math.floor(durations.length * 0.95) - 1]!
    expect(p95).toBeLessThan(16.7 * performanceBudgetMultiplier)
  })
})
