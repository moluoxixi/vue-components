import type { InlineConfig } from 'vitest/node'

export type VitestAddonOptions = InlineConfig

/**
 * 让 Vitest 配置获得 Vitest 原生类型提示。
 */
export function defineVitestAddonOptions(options: VitestAddonOptions): VitestAddonOptions {
  return options
}
