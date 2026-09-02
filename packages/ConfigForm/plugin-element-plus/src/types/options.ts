import type { ReadonlyAdapterRegistry } from '@moluoxixi/config-form/plugins'

/** Element Plus plugin configuration. */
export interface ElementPlusPluginOptions {
  name?: string
  readonlyAdapters?: ReadonlyAdapterRegistry
}
