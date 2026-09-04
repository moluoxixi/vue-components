import type { Options } from '@vitejs/plugin-vue'

export type VueAddonOptions = Options

/**
 * 让 Vue addon 配置获得 @vitejs/plugin-vue 原生类型提示。
 */
export function defineVueAddonOptions(options: VueAddonOptions): VueAddonOptions {
  return options
}
