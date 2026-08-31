import type {
  PageCompilation,
} from '@moluoxixi/config-form-compiler'
import type {
  VueRuntimeCompileResult,
  VueRuntimeCompileSuccess,
} from '@moluoxixi/config-form-vue-backend'

export interface PageRuntimeArtifactCache {
  clear: () => void
  resolve: (
    compilation: PageCompilation,
    compile: () => VueRuntimeCompileResult,
  ) => VueRuntimeCompileResult
}

export function createPageRuntimeArtifactCache(maxPages = 32): PageRuntimeArtifactCache {
  if (!Number.isInteger(maxPages) || maxPages < 1)
    throw new RangeError('PageRuntimeArtifactCache maxPages must be a positive integer.')

  const entries = new Map<string, {
    key: PageCompilation['key']
    result: VueRuntimeCompileSuccess
  }>()

  function touch(
    pageId: string,
    entry: { key: PageCompilation['key'], result: VueRuntimeCompileSuccess },
  ): void {
    entries.delete(pageId)
    entries.set(pageId, entry)
    while (entries.size > maxPages) {
      const oldest = entries.keys().next().value
      if (oldest === undefined)
        break
      entries.delete(oldest)
    }
  }

  return {
    clear() {
      entries.clear()
    },
    resolve(compilation, compile) {
      if (compilation.snapshotIdentity.source === 'committed') {
        const cached = entries.get(compilation.key.pageId)
        if (cached?.key === compilation.key) {
          touch(compilation.key.pageId, cached)
          return cached.result
        }
      }

      const result = compile()
      if (result.success && compilation.snapshotIdentity.source === 'committed') {
        touch(compilation.key.pageId, {
          key: compilation.key,
          result,
        })
      }
      return result
    },
  }
}
