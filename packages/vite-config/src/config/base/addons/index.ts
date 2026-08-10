import type { UserConfig } from 'vite'
import type { ViteConfigOptions } from '../../../types'
import type { ViteFeatureInspectionResult } from './runtime'
import { mergeConfig } from 'vite'
import { viteFeatures } from './registry'
import { createAddonContext, inspectFeature, resolveFeatureConfig } from './runtime'

/**
 * 基于目标 root 输出 addon 决策报告；只做依赖图检查，不加载插件模块。
 */
export function inspectViteFeatures(options: ViteConfigOptions = {}): ViteFeatureInspectionResult {
  const ctx = createAddonContext(options)

  return {
    features: viteFeatures.map(feature => inspectFeature(ctx, feature, options[feature.name])),
    root: ctx.root,
  }
}

/**
 * 基于目标 root 的依赖图解析 Vite feature，并按固定顺序合并配置片段。
 */
export async function getAddonsConfig(options: ViteConfigOptions = {}): Promise<UserConfig> {
  const ctx = createAddonContext(options)
  let combinedConfig: UserConfig = {}

  for (const feature of viteFeatures) {
    const inspection = inspectFeature(ctx, feature, options[feature.name])
    if (!inspection.enabled) {
      continue
    }

    const option = options[feature.name]
    const configFragment = await resolveFeatureConfig(ctx, feature, option)
    combinedConfig = mergeConfig(combinedConfig, configFragment)
  }

  return combinedConfig
}
