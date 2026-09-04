import type { UserConfig } from 'vite'
import type { BaseViteConfigOptions } from '../../../types'
import path from 'node:path'
import process from 'node:process'
import { mergeConfig } from 'vite'
import { getAddonsConfig } from '../addons'

/**
 * 获取全局通用基础配置
 */
export async function getBaseConfig(options: BaseViteConfigOptions = {}): Promise<UserConfig> {
  const root = typeof options.viteConfig?.root === 'string' ? options.viteConfig.root : process.cwd()
  // 基于插件目录(Addons)动态合并后的配置，将 options 字典透明下移
  const addonsConfig = await getAddonsConfig(options)

  // 兜底及固定写法的配置
  const rootConfig: UserConfig = {
    resolve: {
      alias: {
        '@': path.resolve(root, 'src'),
      },
    },
  }

  // 通过 mergeConfig 完美融合 Addons 中的诸如 PostCSS、Plugins、Server 等复杂字段
  return mergeConfig(rootConfig, addonsConfig)
}
