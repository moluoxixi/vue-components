import type { PageCompilation } from '@moluoxixi/config-form-compiler'
import type { VueRuntimeCompileResult } from '@moluoxixi/config-form-vue-backend'
import { CANONICAL_PROJECT_IR_VERSION, CONFIG_FORM_COMPILER_VERSION } from '@moluoxixi/config-form-compiler'
import { describe, expect, it, vi } from 'vitest'
import { createPageRuntimeArtifactCache } from '..'

function compilation(
  pageId: string,
  key: PageCompilation['key'],
  source: 'committed' | 'draft' = 'committed',
): PageCompilation {
  return {
    snapshotIdentity: source === 'committed'
      ? {
          source,
          projectId: 'project',
          pageId,
          contentHash: 'fnv1a:project',
          editVersion: 1,
        }
      : {
          source,
          projectId: 'project',
          pageId,
          contentHash: 'fnv1a:draft',
          baseEditVersion: 1,
          draftId: 'candidate',
        },
    registryUsage: [],
    key,
    page: {} as PageCompilation['page'],
  }
}

function pageKey(pageId: string): PageCompilation['key'] {
  return {
    irVersion: CANONICAL_PROJECT_IR_VERSION,
    projectId: 'project',
    pageId,
    registryAdapter: 'element-plus',
    registryAdapterVersion: '1',
    registryUsageHash: 'fnv1a:usage',
    compilerVersion: CONFIG_FORM_COMPILER_VERSION,
    environmentHash: 'fnv1a:environment',
    semanticHash: `fnv1a:${pageId}`,
  }
}

function success(pageId: string): VueRuntimeCompileResult {
  return {
    success: true,
    artifact: {
      compilationKey: pageKey(pageId),
      pageId,
      plan: { renderer: { fields: [] } },
    },
    diagnostics: [],
  }
}

describe('page Runtime artifact cache', () => {
  it('reuses committed backend output by exact PageCompilation key identity', () => {
    const cache = createPageRuntimeArtifactCache()
    const key = pageKey('home')
    const compile = vi.fn(() => success('home'))

    const first = cache.resolve(compilation('home', key), compile)
    const second = cache.resolve(compilation('home', key), compile)

    expect(compile).toHaveBeenCalledTimes(1)
    expect(second).toBe(first)
  })

  it('does not let drafts or failures populate the committed cache', () => {
    const cache = createPageRuntimeArtifactCache()
    const key = pageKey('home')
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
