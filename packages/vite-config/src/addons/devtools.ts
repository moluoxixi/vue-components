import type { VitePluginVueDevToolsOptions } from 'vite-plugin-vue-devtools'

export type DevtoolsAddonOptions = VitePluginVueDevToolsOptions

/**
 * 让 Vue DevTools 配置获得插件原生类型提示。
 */
export function defineDevtoolsAddonOptions(options: DevtoolsAddonOptions): DevtoolsAddonOptions {
  return options
}
