import type { PluginOptions } from '@intlify/unplugin-vue-i18n'

export type I18nAddonOptions = PluginOptions

/**
 * 让 vue-i18n unplugin 配置获得插件原生类型提示。
 */
export function defineI18nAddonOptions(options: I18nAddonOptions): I18nAddonOptions {
  return options
}
