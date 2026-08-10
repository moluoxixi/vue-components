import type { Options } from 'unplugin-auto-import/types'

export type AutoImportAddonOptions = Options

/**
 * 让 auto-import 配置获得插件原生类型提示，调用时仍只返回普通配置对象。
 */
export function defineAutoImportAddonOptions(options: AutoImportAddonOptions): AutoImportAddonOptions {
  return options
}
