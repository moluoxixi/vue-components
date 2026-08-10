import type { Options } from 'unplugin-vue-router/types'

export type VueRouterAddonOptions = Options

/**
 * 让 vue-router 文件路由插件配置获得原生类型提示。
 */
export function defineVueRouterAddonOptions(options: VueRouterAddonOptions): VueRouterAddonOptions {
  return options
}
