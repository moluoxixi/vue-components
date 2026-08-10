import type { VitePWA } from 'vite-plugin-pwa'

export type PwaAddonOptions = NonNullable<Parameters<typeof VitePWA>[0]>

/**
 * 让 PWA addon 配置直接获得 vite-plugin-pwa 官方类型提示。
 */
export function definePwaAddonOptions<const T extends PwaAddonOptions>(options: T): T {
  return options
}
