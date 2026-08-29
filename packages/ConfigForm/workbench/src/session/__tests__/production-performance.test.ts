import type { WorkspaceSessionSnapshot } from '../workspace-session'
import {
  compileDesignerDocument,
  configModelToDesignerDocument,
  createLowCodeComponentRegistry,
} from '@moluoxixi/config-form-designer'
import { createElementPlusDesignerRegistry } from '@moluoxixi/config-form-designer-element-plus'
import { describe, expect, it } from 'vitest'
import { createBuiltInWorkspaceApplication } from '../../project'
import { createWorkspaceProjectionCoordinator } from '../projection-coordinator'

const designerRegistry = createElementPlusDesignerRegistry()
const registry = createLowCodeComponentRegistry(designerRegistry)

function percentile95(samples: number[]): number {
  const sorted = [...samples].sort((left, right) => left - right)
  return sorted[Math.ceil(sorted.length * 0.95) - 1] ?? 0
}

function productionSnapshot(): WorkspaceSessionSnapshot {
  const application = createBuiltInWorkspaceApplication('element-profile', {
    createdAt: '2026-08-30T00:00:00.000Z',
    id: 'performance-app',
    name: 'Performance app',
  })
  const currentPage = application.pages.find(page => page.id === application.homePageId)!
  currentPage.model.nodes = Array.from({ length: 200 }, (_, index) => registry.createNode('element.input', {
    id: `field-${index}`,
    field: `field_${index}`,
  }))
  return {
    application,
    applicationRevision: application.revision,
    canRedo: false,
    canUndo: false,
    currentPage,
    currentPageId: currentPage.id,
    dirty: false,
    modelRevision: 0,
    persistence: 'durable',
    saving: false,
  }
}

describe('workspace production performance budgets', () => {
  it('publishes and compiles a 200-node preview below the 100ms p95 budget', () => {
    const coordinator = createWorkspaceProjectionCoordinator()
    const snapshot = productionSnapshot()
    const publish = (revision: number): void => {
      const current = { ...snapshot, modelRevision: revision }
      const projection = coordinator.publish(current, (captured) => {
        const document = configModelToDesignerDocument(captured.currentPage.model)
        return compileDesignerDocument(document, designerRegistry)
      })
      expect(projection.status).toBe('live')
    }
    Array.from({ length: 5 }, (_, index) => publish(index))
    const samples = Array.from({ length: 30 }, (_, index) => {
      const startedAt = performance.now()
      publish(index + 10)
      return performance.now() - startedAt
    })

    expect(percentile95(samples)).toBeLessThanOrEqual(100)
  })
})
