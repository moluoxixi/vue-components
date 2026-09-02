import type { ReadonlyAdapterRegistry } from '@moluoxixi/config-form/plugins'
import type { AntdVueFieldBinding } from './binding.js'

/** Ant Design Vue plugin configuration. */
export interface AntdVuePluginOptions {
  name?: string
  bindings?: Record<string, AntdVueFieldBinding>
  readonlyAdapters?: ReadonlyAdapterRegistry
  strict?: boolean
}
