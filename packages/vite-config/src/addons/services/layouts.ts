import type { UserOptions } from 'vite-plugin-vue-layouts'

export type VueLayoutsAddonOptions = UserOptions

/**
 * 让 vue-layouts 配置获得插件原生类型提示。
 */
export function defineVueLayoutsAddonOptions(options: VueLayoutsAddonOptions): VueLayoutsAddonOptions {
  return options
}
