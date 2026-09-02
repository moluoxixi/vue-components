import type { VueRuntimeCompileResult } from '@moluoxixi/config-form-vue-backend'
import type { PageProjectionInput } from '..'
import { describe, expect, it } from 'vitest'
import { createPageProjectionCoordinator } from '..'

function input(overrides: Partial<PageProjectionInput> = {}): PageProjectionInput {
  return {
    adapter: 'element-plus',
    editVersion: 0,
    pageId: 'home',
    projectId: 'projection-project',
    repositoryRevision: 4,
    ...overrides,
  }
}

function success(snapshot: PageProjectionInput): VueRuntimeCompileResult {
  return {
    success: true,
    artifact: {
      compilationKey: {
        irVersion: 3,
        projectId: snapshot.projectId,
        pageId: snapshot.pageId,
        registryAdapter: snapshot.adapter,
        registryAdapterVersion: '1',
        registryUsageHash: 'fnv1a:registry',
        compilerVersion: '1.0.0',
        environmentHash: 'fnv1a:environment',
        semanticHash: `fnv1a:${snapshot.editVersion}`,
      },
      pageId: snapshot.pageId,
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

describe('page projection coordinator', () => {
  it('publishes one revision identity and aborts work from the previous revision', () => {
    const coordinator = createPageProjectionCoordinator()
    const first = coordinator.publish(input(), snapshot => success(snapshot))
    const second = coordinator.publish(input({ editVersion: 1 }), snapshot => success(snapshot))

    expect(first.signal.aborted).toBe(true)
    expect(second.signal.aborted).toBe(false)
    expect(second.current.runtimeSessionKey).toBe(first.current.runtimeSessionKey)
    expect(second.current.runtimeSessionKey).toBe('projection-project:element-plus:home')
    expect(second.current.revisionKey).toBe('projection-project:4:home:1')
    expect(coordinator.isCurrent(first.current.revisionKey)).toBe(false)
    expect(coordinator.isCurrent(second.current.revisionKey)).toBe(true)
  })

  it('marks the last valid projection stale after a compile failure on the same page', () => {
    const coordinator = createPageProjectionCoordinator()
    const valid = coordinator.publish(input(), snapshot => success(snapshot))
    const failed = coordinator.publish(input({ editVersion: 2 }), () => failure)

    expect(failed.status).toBe('stale')
    expect(failed.display?.stale).toBe(true)
    expect(failed.display?.result).toBe(valid.compileResult)
    expect(failed.display?.snapshot.editVersion).toBe(0)
  })

  it('never shows the last valid projection for another page', () => {
    const coordinator = createPageProjectionCoordinator()
    coordinator.publish(input(), snapshot => success(snapshot))

    const failed = coordinator.publish(input({ pageId: 'other-page', editVersion: 1 }), () => failure)

    expect(failed.status).toBe('blocked')
    expect(failed.display).toBeUndefined()
    expect(failed.current.runtimeSessionKey).toBe('projection-project:element-plus:other-page')
  })

  it('captures only immutable page projection identity', () => {
    const coordinator = createPageProjectionCoordinator()
    coordinator.publish(input(), snapshot => success(snapshot))

    expect(coordinator.capture()).toEqual({
      ...input(),
      runtimeSessionKey: 'projection-project:element-plus:home',
      revisionKey: 'projection-project:4:home:0',
    })
  })
})
