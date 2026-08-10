import type { Plugin, PluginOption, UserConfig } from 'vite'
import { mergeConfig } from 'vite'

async function resolvePluginOption(option: PluginOption): Promise<Plugin[]> {
  const resolved = await option
  if (!resolved) {
    return []
  }

  if (Array.isArray(resolved)) {
    return (await Promise.all(resolved.map(resolvePluginOption))).flat()
  }

  return [resolved]
}

async function resolvePlugins(options: PluginOption[] | undefined): Promise<Plugin[]> {
  if (!options) {
    return []
  }

  return (await Promise.all(options.map(resolvePluginOption))).flat()
}

function getPluginKey(plugin: Plugin): Plugin | string {
  return typeof plugin.name === 'string' && plugin.name.length > 0 ? `name:${plugin.name}` : plugin
}

/**
 * 使用 Vite 原生规则合并配置，并让用户插件覆盖同名的自动生成插件。
 */
export async function mergeConfigWithUserPlugins(baseConfig: UserConfig, userConfig: UserConfig): Promise<UserConfig> {
  const merged = mergeConfig(baseConfig, userConfig)
  if (!baseConfig.plugins && !userConfig.plugins) {
    return merged
  }

  const [basePlugins, userPlugins] = await Promise.all([
    resolvePlugins(baseConfig.plugins),
    resolvePlugins(userConfig.plugins),
  ])
  const userKeys = new Set(userPlugins.map(getPluginKey))
  merged.plugins = basePlugins.filter(plugin => !userKeys.has(getPluginKey(plugin))).concat(userPlugins)

  return merged
}
