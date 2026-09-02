import type { FormRuntimePlugin } from '@moluoxixi/config-form/plugins'
import type { ElementPlusPluginOptions } from '../types/index.js'
import { ELEMENT_PLUS_READONLY_ADAPTERS } from '../readonly/index.js'

/**
 * 创建 Element Plus 字段只读适配插件。
 *
 * 这个插件只提供 runtime 级只读展示映射，不介入 core 字段语义。
 */
export function createElementPlusPlugin(config: ElementPlusPluginOptions = {}): FormRuntimePlugin {
  return {
    name: config.name ?? 'element-plus',
    readonlyAdapters: {
      ...ELEMENT_PLUS_READONLY_ADAPTERS,
      ...(config.readonlyAdapters ?? {}),
    },
  }
}
