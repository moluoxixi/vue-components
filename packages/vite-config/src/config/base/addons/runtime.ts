import type { UserConfig } from 'vite'
import type { VitestAddonOptions } from '../../../addons/vitest'
import type { AddonName, ViteConfigOptions } from '../../../types'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { detectDependencies } from '@moluoxixi/utils/node'

export interface AddonContext {
  addonDeps: Record<string, string>
  root: string
  deps: Record<string, string>
  runtimeDeps: Record<string, string>
  hasAddonDep: (name: string) => boolean
  hasDep: (name: string) => boolean
  hasRuntimeDep: (name: string) => boolean
  hasAnyAddonDep: (names: string[]) => boolean
  hasAnyDep: (names: string[]) => boolean
  hasAnyRuntimeDep: (names: string[]) => boolean
  importRequired: <T = unknown>(owner: string, specifier: string) => Promise<T>
  requireDeps: (owner: string, deps: string[]) => void
  resolvePath: (...segments: string[]) => string
}

export interface AddonUserConfig extends UserConfig {
  test?: VitestAddonOptions
}

export interface ViteFeature<TOptions = unknown, TState = unknown> {
  name: AddonName
  order: number
  triggers: string[]
  requires?: string[]
  createState?: (ctx: AddonContext, options?: TOptions) => TState
  setup: (ctx: AddonContext, options: TOptions | undefined, state: TState) => AddonUserConfig | Promise<AddonUserConfig>
}

export type ViteFeatureEnableReason
  = | 'dependency-detected'
    | 'explicit-disabled'
    | 'explicit-enabled'
    | 'dependency-missing'

export interface ViteFeatureInspection {
  name: AddonName
  enabled: boolean
  reason: ViteFeatureEnableReason
  triggers: string[]
  matchedTriggers: string[]
  requires: string[]
  missingRequires: string[]
}

export interface ViteFeatureInspectionResult {
  root: string
  features: ViteFeatureInspection[]
}

/**
 * 创建 feature 定义；保留泛型推导并避免 registry 中出现裸对象协议漂移。
 */
export function defineFeature<TOptions = unknown, TState = unknown>(feature: ViteFeature<TOptions, TState>): ViteFeature<TOptions, TState> {
  return feature
}

/**
 * 从导入 specifier 中还原 package 名称，用于运行时依赖校验。
 */
export function getPackageName(specifier: string): string {
  const parts = specifier.split('/')
  if (specifier.startsWith('@')) {
    return `${parts[0]}/${parts[1]}`
  }

  return parts[0]
}

/**
 * 判断 addon 配置是否是可透传载荷；布尔值只表达启用状态。
 */
export function isAddonPayload(option: unknown): option is object | string {
  return (typeof option === 'object' && option !== null && !Array.isArray(option)) || typeof option === 'string'
}

/**
 * 判断 addon 配置是否是可合并的对象选项；保留给需要对象语义的调用方。
 */
export function isObjectOption(option: unknown): option is object {
  return typeof option === 'object' && option !== null && !Array.isArray(option)
}

/**
 * 解释单个 feature 的启用状态；只读取依赖图，不触发任何插件动态导入。
 */
export function inspectFeature(
  ctx: AddonContext,
  feature: ViteFeature,
  option: unknown,
): ViteFeatureInspection {
  const requires = feature.requires || []
  const matchedTriggers = feature.triggers.filter(ctx.hasAddonDep)
  const missingRequires = requires.filter(dep => !ctx.hasAddonDep(dep))

  if (option === false) {
    return {
      enabled: false,
      matchedTriggers,
      missingRequires: [],
      name: feature.name,
      reason: 'explicit-disabled',
      requires,
      triggers: feature.triggers,
    }
  }

  if (option === true || isAddonPayload(option)) {
    return {
      enabled: true,
      matchedTriggers,
      missingRequires,
      name: feature.name,
      reason: 'explicit-enabled',
      requires,
      triggers: feature.triggers,
    }
  }

  if (matchedTriggers.length > 0) {
    return {
      enabled: true,
      matchedTriggers,
      missingRequires,
      name: feature.name,
      reason: 'dependency-detected',
      requires,
      triggers: feature.triggers,
    }
  }

  return {
    enabled: false,
    matchedTriggers,
    missingRequires: [],
    name: feature.name,
    reason: 'dependency-missing',
    requires,
    triggers: feature.triggers,
  }
}

/**
 * 根据 root 解析依赖上下文，并提供严格导入、路径解析和依赖断言能力。
 */
export function createAddonContext(options: ViteConfigOptions = {}): AddonContext {
  const rootValue = options.viteConfig?.root
  const root = path.resolve(typeof rootValue === 'string' ? rootValue : process.cwd())
  const { addonDeps, deps, runtimeDeps } = detectDependencies(root)
  const rootRequire = createRequire(path.resolve(root, 'package.json'))
  const resolveProjectModule = rootRequire.resolve as (specifier: string, options?: { conditions?: Set<string> }) => string
  const importCache = new Map<string, Promise<unknown>>()

  const hasAddonDep = (name: string) => Boolean(addonDeps[name])
  const hasDep = (name: string) => Boolean(deps[name])
  const hasRuntimeDep = (name: string) => Boolean(runtimeDeps[name])

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
    hasDep,
    hasRuntimeDep,
    importRequired,
    requireDeps,
    resolvePath: (...segments: string[]) => path.resolve(root, ...segments),
    root,
    runtimeDeps,
  }
}

/**
 * 执行单个 feature 的依赖校验、状态初始化和 Vite 配置片段生成。
 */
export async function resolveFeatureConfig(
  ctx: AddonContext,
  feature: ViteFeature,
  option: unknown,
): Promise<AddonUserConfig> {
  const options = isAddonPayload(option) ? option : undefined

  try {
    ctx.requireDeps(feature.name, feature.requires || [])
    const state = (feature.createState ? feature.createState(ctx, options) : undefined) as typeof feature extends ViteFeature<any, infer TState> ? TState : unknown

    return await feature.setup(ctx, options, state)
  }
  catch (cause) {
    if (cause instanceof Error && cause.message.startsWith('[ViteConfig]')) {
      throw cause
    }

    throw new Error(`[ViteConfig] failed to resolve addon ${feature.name}`, { cause })
  }
}
