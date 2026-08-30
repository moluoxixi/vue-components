import type { VueRuntimeCompileResult } from '@moluoxixi/config-form-vue-backend'
import type { WorkspaceSessionSnapshot } from '../workspace-session'
import { describe, expect, it } from 'vitest'
import { createBuiltInWorkspaceApplication } from '../../project'
import { createWorkspaceProjectionCoordinator } from '../projection-coordinator'

function sessionSnapshot(): WorkspaceSessionSnapshot {
  const application = createBuiltInWorkspaceApplication('element-profile', {
    createdAt: '2026-08-30T00:00:00.000Z',
    id: 'projection-app',
    name: 'Projection app',
  })
  const currentPage = application.pages.find(page => page.id === application.homePageId)!
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

function success(snapshot: WorkspaceSessionSnapshot): VueRuntimeCompileResult {
  return {
    success: true,
    artifact: {
      compilationKey: {
        projectId: snapshot.application.id,
        contentHash: `fnv1a:${snapshot.modelRevision}`,
        registryAdapter: snapshot.application.manifest.adapter,
        registryAdapterVersion: '1',
        registryFingerprint: 'fnv1a:registry',
        compilerVersion: '1.0.0',
        environmentHash: 'fnv1a:environment',
        irHash: `fnv1a:ir-${snapshot.modelRevision}`,
      },
      pageId: snapshot.currentPageId,
      plan: {
        renderer: {
          columns: 1,
          components: {},
          fieldSpan: 1,
          fields: [],
          gap: '0px',
          inline: false,
          labelPosition: 'top',
          readonly: false,
        },
      },
    },
    diagnostics: [],
  }
}

const failure: VueRuntimeCompileResult = {
  success: false,
  diagnostics: [{ code: 'TEST', message: 'compile failed', path: [], severity: 'error' }],
}

describe('workspace projection coordinator', () => {
  it('publishes one revision identity and aborts work from the previous revision', () => {
    const coordinator = createWorkspaceProjectionCoordinator()
    const first = sessionSnapshot()
    const firstProjection = coordinator.publish(first, () => success(first))

    const second = { ...first, modelRevision: first.modelRevision + 1 }
    const secondProjection = coordinator.publish(second, () => success(second))

    expect(firstProjection.signal.aborted).toBe(true)
    expect(secondProjection.signal.aborted).toBe(false)
    expect(secondProjection.current.revisionKey).toBe(`projection-app:${first.applicationRevision}:${first.currentPageId}:1`)
    expect(coordinator.isCurrent(firstProjection.current.revisionKey)).toBe(false)
    expect(coordinator.isCurrent(secondProjection.current.revisionKey)).toBe(true)
  })

  it('marks the last valid projection stale after a compile failure on the same page', () => {
    const coordinator = createWorkspaceProjectionCoordinator()
    const first = sessionSnapshot()
    const valid = success(first)
    coordinator.publish(first, () => valid)

    const failed = coordinator.publish({ ...first, modelRevision: 2 }, () => failure)

    expect(failed.status).toBe('stale')
    expect(failed.display?.stale).toBe(true)
    expect(failed.display?.result).toBe(valid)
    expect(failed.display?.snapshot.modelRevision).toBe(0)
  })

  it('never shows a last-valid page as the fallback for another page', () => {
    const coordinator = createWorkspaceProjectionCoordinator()
    const first = sessionSnapshot()
    coordinator.publish(first, () => success(first))
    const otherPage = {
      ...first.currentPage,
      id: 'other-page',
      model: { ...first.currentPage.model, id: 'other-model' },
      name: 'Other page',
      route: '/other',
    }
    const application = {
      ...first.application,
      pages: [...first.application.pages, otherPage],
    }

    const failed = coordinator.publish({
      ...first,
      application,
      currentPageId: otherPage.id,
      modelRevision: 1,
    }, () => failure)

    expect(failed.status).toBe('blocked')
    expect(failed.display).toBeUndefined()
  })

  it('captures an isolated application snapshot for export features', () => {
    const coordinator = createWorkspaceProjectionCoordinator()
    const session = sessionSnapshot()
    coordinator.publish(session, () => success(session))

    const captured = coordinator.capture()!
    captured.application.name = 'mutated export copy'

    expect(coordinator.capture()?.application.name).toBe('Projection app')
  })
})
