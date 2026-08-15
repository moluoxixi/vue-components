import type { UserConfigExport } from 'vite'
import type { AppViteConfigExport } from '../types'
import { defineConfig } from 'vite'
import { getBaseConfig } from './base'
import { mergeConfigWithUserPlugins } from './merge'

/**
 * 构建 Web App 应用专用的 Vite 配置文件
 *
 * @example
 * // 对象形式
 * export default createAppConfig({ vue: true })
 *
 * export default createAppConfig(({ mode }) => ({
 *   vue: true,
 *   viteConfig: {
 *     base: mode === 'development' ? '/' : '/app/',
 *   }
 * }))
 */
export function createAppConfig(config: AppViteConfigExport = {}): UserConfigExport {
  return defineConfig(async (env) => {
    const userOptions = typeof config === 'function' ? await config(env) : config
    const baseConfig = await getBaseConfig(userOptions)
    const viteConfigExt = userOptions.viteConfig || {}

    return mergeConfigWithUserPlugins(baseConfig, viteConfigExt)
  })
}
