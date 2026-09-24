import type {
  SurfaceCompilation,
} from '@moluoxixi/config-form-compiler'
import type {
  VueRuntimeCompileSuccess,
} from '@moluoxixi/config-form-vue-backend'
import type { SurfaceRuntimeArtifactCache } from '../types'

export function createSurfaceRuntimeArtifactCache(maxSurfaces = 32): SurfaceRuntimeArtifactCache {
  if (!Number.isInteger(maxSurfaces) || maxSurfaces < 1)
    throw new RangeError('SurfaceRuntimeArtifactCache maxSurfaces must be a positive integer.')

  const entries = new Map<string, {
    key: SurfaceCompilation['key']
    result: VueRuntimeCompileSuccess
  }>()

  function touch(
    surfaceId: string,
    entry: { key: SurfaceCompilation['key'], result: VueRuntimeCompileSuccess },
  ): void {
    entries.delete(surfaceId)
    entries.set(surfaceId, entry)
    while (entries.size > maxSurfaces) {
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
        const cached = entries.get(compilation.key.surfaceId)
        if (cached?.key === compilation.key) {
          touch(compilation.key.surfaceId, cached)
          return cached.result
        }
      }

      const result = compile()
      if (result.success && compilation.snapshotIdentity.source === 'committed') {
        touch(compilation.key.surfaceId, {
          key: compilation.key,
          result,
        })
      }
      return result
    },
  }
}
