import type { FormRuntimePlugin, ReadonlyAdapterRegistry } from '@moluoxixi/config-form/plugins'
import { ELEMENT_PLUS_READONLY_ADAPTERS } from './readonly'

/** Element Plus 插件配置。 */
export interface ElementPlusPluginOptions {
  /** runtime 插件名称，默认 "element-plus"。 */
  name?: string
  /** 额外只读适配器或内置适配器覆盖项。 */
  readonlyAdapters?: ReadonlyAdapterRegistry
}

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

export { ELEMENT_PLUS_READONLY_ADAPTERS } from './readonly'
