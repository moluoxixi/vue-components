import type { SurfaceCompilation } from '@moluoxixi/config-form-compiler'
import type { VueRuntimeCompileResult } from '@moluoxixi/config-form-vue-backend'
import { CANONICAL_PROJECT_IR_VERSION, CONFIG_FORM_COMPILER_VERSION } from '@moluoxixi/config-form-compiler'
import { describe, expect, it, vi } from 'vitest'
import { createSurfaceRuntimeArtifactCache } from '..'

function compilation(
  surfaceId: string,
  key: SurfaceCompilation['key'],
  source: 'committed' | 'draft' = 'committed',
): SurfaceCompilation {
  return {
    snapshotIdentity: source === 'committed'
      ? {
          source,
          projectId: 'project',
          surfaceId,
          contentHash: 'fnv1a:project',
          editVersion: 1,
        }
      : {
          source,
          projectId: 'project',
          surfaceId,
          contentHash: 'fnv1a:draft',
          baseEditVersion: 1,
          draftId: 'candidate',
        },
    registryUsage: [],
    key,
    surface: {} as SurfaceCompilation['surface'],
  }
}

function surfaceKey(surfaceId: string): SurfaceCompilation['key'] {
  return {
    irVersion: CANONICAL_PROJECT_IR_VERSION,
    projectId: 'project',
    surfaceId,
    registryAdapter: 'element-plus',
    registryAdapterVersion: '1',
    registryUsageHash: 'fnv1a:usage',
    compilerVersion: CONFIG_FORM_COMPILER_VERSION,
    environmentHash: 'fnv1a:environment',
    semanticHash: `fnv1a:${surfaceId}`,
  }
}

function success(surfaceId: string): VueRuntimeCompileResult {
  return {
    success: true,
    artifact: {
      compilationKey: surfaceKey(surfaceId),
      surfaceId,
      kind: 'page',
      renderer: {
        fields: [],
        plan: {
          valueSchema: { valueScopes: [], scopedFields: [] },
          runtime: { variables: [], dataSources: [] },
          optionBindings: [],
        },
      },
    },
    diagnostics: [],
  }
}

describe('surface Runtime artifact cache', () => {
  it('reuses committed backend output by exact SurfaceCompilation key identity', () => {
    const cache = createSurfaceRuntimeArtifactCache()
    const key = surfaceKey('home')
    const compile = vi.fn(() => success('home'))

    const first = cache.resolve(compilation('home', key), compile)
    const second = cache.resolve(compilation('home', key), compile)

    expect(compile).toHaveBeenCalledTimes(1)
    expect(second).toBe(first)
  })

  it('does not let drafts or failures populate the committed cache', () => {
    const cache = createSurfaceRuntimeArtifactCache()
    const key = surfaceKey('home')
    const compile = vi.fn<() => VueRuntimeCompileResult>()
      .mockReturnValueOnce(success('home'))
      .mockReturnValueOnce({
        success: false,
        diagnostics: [{ code: 'TEST', message: 'failed', path: [], severity: 'error' }],
      })
      .mockReturnValueOnce(success('home'))

    cache.resolve(compilation('home', key, 'draft'), compile)
    cache.resolve(compilation('home', key), compile)
    cache.resolve(compilation('home', key), compile)

    expect(compile).toHaveBeenCalledTimes(3)
  })
})
