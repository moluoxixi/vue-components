import type { VitePluginConfig } from 'unocss/vite'

export type UnoCssAddonOptions<Theme extends object = object> = VitePluginConfig<Theme> | string

/**
 * 让 UnoCSS 配置获得 Vite 插件原生类型提示。
 */
export function defineUnoCssAddonOptions<Theme extends object = object>(
  options: UnoCssAddonOptions<Theme>,
): UnoCssAddonOptions<Theme> {
  return options
}
