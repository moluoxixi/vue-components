import type { Options } from 'unplugin-vue-components/types'

export type ComponentsAddonOptions = Options

/**
 * 让 components 配置获得插件原生类型提示，避免调用方只能翻源码确认参数。
 */
export function defineComponentsAddonOptions(options: ComponentsAddonOptions): ComponentsAddonOptions {
  return options
}
