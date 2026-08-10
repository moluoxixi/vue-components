import type { PluginOptions as VitePluginOptions } from '@tailwindcss/vite'

export type TailwindCssAddonOptions = VitePluginOptions

/**
 * 让 Tailwind CSS Vite 插件配置获得原生类型提示。
 */
export function defineTailwindCssAddonOptions(options: TailwindCssAddonOptions): TailwindCssAddonOptions {
  return options
}
