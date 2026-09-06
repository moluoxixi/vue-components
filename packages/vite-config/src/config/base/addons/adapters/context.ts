import type { AddonName, BaseViteConfigOptions } from '../../../../types'
import type { AddonContext } from '../types'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { detectDependencies } from '@moluoxixi/utils/node'
import { getPackageName } from '../utils'

export function createAddonContext(
  options: BaseViteConfigOptions = {},
  featureStates: ReadonlyMap<AddonName, boolean> = new Map(),
): AddonContext {
  const rootValue = options.viteConfig?.root
  const root = path.resolve(typeof rootValue === 'string' ? rootValue : process.cwd())
  const { addonDeps, deps, runtimeDeps } = detectDependencies(root)
  const rootRequire = createRequire(path.resolve(root, 'package.json'))
  const resolveProjectModule = rootRequire.resolve as (specifier: string, options?: { conditions?: Set<string> }) => string
  const importCache = new Map<string, Promise<unknown>>()

  const hasAddonDep = (name: string) => Boolean(addonDeps[name])
  const hasDep = (name: string) => Boolean(deps[name])
  const hasRuntimeDep = (name: string) => Boolean(runtimeDeps[name])
  const isFeatureEnabled = (name: AddonName) => featureStates.has(name)
    ? featureStates.get(name) === true
    : hasAddonDep(name)

  const requireDeps = (owner: string, requiredDeps: string[]) => {
    const missing = requiredDeps.filter(dep => !hasAddonDep(dep))
    if (missing.length > 0) {
      throw new Error(`[ViteConfig] ${owner} requires missing package(s): ${missing.join(', ')}. Checked ${path.resolve(root, 'package.json')}`)
    }
  }

  const importRequired = async <T = unknown>(owner: string, specifier: string): Promise<T> => {
    const packageName = getPackageName(specifier)
    requireDeps(owner, [packageName])

    if (!importCache.has(specifier)) {
      importCache.set(
        specifier,
        Promise.resolve()
          .then(() => resolveProjectModule(specifier, { conditions: new Set(['node', 'import']) }))
          .then(resolvedPath => import(resolvedPath.startsWith('node:') ? resolvedPath : pathToFileURL(resolvedPath).href)),
      )
    }

    try {
      return await importCache.get(specifier) as T
    }
    catch (cause) {
      importCache.delete(specifier)
      throw new Error(`[ViteConfig] ${owner} failed to load ${specifier}. Install ${packageName} for project root ${root}.`, { cause })
    }
  }

  return {
    addonDeps,
    deps,
    hasAddonDep,
    hasAnyAddonDep: (names: string[]) => names.some(hasAddonDep),
    hasAnyDep: (names: string[]) => names.some(hasDep),
    hasAnyRuntimeDep: (names: string[]) => names.some(hasRuntimeDep),
    isFeatureEnabled,
    hasDep,
    hasRuntimeDep,
    importRequired,
    requireDeps,
    resolvePath: (...segments: string[]) => path.resolve(root, ...segments),
    root,
    runtimeDeps,
  }
}
