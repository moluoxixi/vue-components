import type { AddonName } from '../../../../types'
import type {
  AddonContext,
  AddonUserConfig,
  ViteFeature,
  ViteFeatureInspection,
} from '../types'
import { isAddonPayload } from '../utils'

/**
 * 创建 feature 定义；保留泛型推导并避免 registry 中出现裸对象协议漂移。
 */
export function defineFeature<TOptions = unknown, TState = unknown>(feature: ViteFeature<TOptions, TState>): ViteFeature<TOptions, TState> {
  return feature
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
      dependsOn: feature.dependsOn || [],
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
      dependsOn: feature.dependsOn || [],
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
      dependsOn: feature.dependsOn || [],
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
    dependsOn: feature.dependsOn || [],
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
 * Resolve addon execution order from explicit addon dependencies while keeping
 * the registry declaration order for independent features.
 */
export function resolveFeatureOrder(features: readonly ViteFeature<any, any>[]): ViteFeature<any, any>[] {
  const featureByName = new Map<AddonName, ViteFeature<any, any>>()
  for (const feature of features) {
    if (featureByName.has(feature.name)) {
      throw new Error(`[ViteConfig] duplicate addon feature: ${feature.name}`)
    }
    featureByName.set(feature.name, feature)
  }

  const visiting = new Set<AddonName>()
  const visited = new Set<AddonName>()
  const ordered: ViteFeature<any, any>[] = []

  const visit = (feature: ViteFeature<any, any>): void => {
    if (visited.has(feature.name)) {
      return
    }
    if (visiting.has(feature.name)) {
      throw new Error(`[ViteConfig] circular addon dependency involving ${feature.name}`)
    }

    visiting.add(feature.name)
    for (const dependencyName of feature.dependsOn || []) {
      const dependency = featureByName.get(dependencyName)
      if (!dependency) {
        throw new Error(`[ViteConfig] addon ${feature.name} depends on unknown addon ${dependencyName}`)
      }
      visit(dependency)
    }
    visiting.delete(feature.name)
    visited.add(feature.name)
    ordered.push(feature)
  }

  for (const feature of features) {
    visit(feature)
  }

  return ordered
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
