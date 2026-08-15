import type { UserOptions } from 'vite-plugin-pages'

export interface PagesAddonOptions extends UserOptions {}

/**
 * 让 vite-plugin-pages 配置获得原生类型提示。
 */
export function definePagesAddonOptions(options: PagesAddonOptions): PagesAddonOptions {
  return options
}
