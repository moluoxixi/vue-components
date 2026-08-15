import type { UserConfig } from 'vite'
import type { BaseViteConfigOptions } from '../../../types'
import type { ViteFeatureInspectionResult } from './runtime'
import { mergeConfig } from 'vite'
import { viteFeatures } from './registry'
import { createAddonContext, inspectFeature, resolveFeatureConfig } from './runtime'

/**
 * 基于目标 root 输出 addon 决策报告；只做依赖图检查，不加载插件模块。
 */
export function inspectViteFeatures(options: BaseViteConfigOptions = {}): ViteFeatureInspectionResult {
  const ctx = createAddonContext(options)

  return {
    features: viteFeatures.map(feature => inspectFeature(ctx, feature, options[feature.name])),
    root: ctx.root,
  }
}

/**
 * 基于目标 root 的依赖图解析 Vite feature，并按 addon 依赖顺序合并配置片段。
 */
export async function getAddonsConfig(options: BaseViteConfigOptions = {}): Promise<UserConfig> {
  const ctx = createAddonContext(options)
  const inspections = viteFeatures.map(feature => inspectFeature(ctx, feature, options[feature.name]))
  const enabledFeatures = new Set(
    inspections.filter(inspection => inspection.enabled).map(inspection => inspection.name),
  )
  let combinedConfig: UserConfig = {}

  for (const [index, feature] of viteFeatures.entries()) {
    const inspection = inspections[index]
    if (!inspection.enabled) {
      continue
    }

    const missingDependencies = (feature.dependsOn || []).filter(dependency => !enabledFeatures.has(dependency))
    if (missingDependencies.length > 0) {
      throw new Error(`[ViteConfig] addon ${feature.name} requires enabled addon(s): ${missingDependencies.join(', ')}`)
    }

    const option = options[feature.name]
    const configFragment = await resolveFeatureConfig(ctx, feature, option)
    combinedConfig = mergeConfig(combinedConfig, configFragment)
  }

  return combinedConfig
}
