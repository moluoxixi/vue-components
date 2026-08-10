import type { Options } from 'unplugin-vue-markdown/types'

export type MarkdownAddonOptions = Options

/**
 * 让 Markdown addon 配置获得插件原生类型提示。
 */
export function defineMarkdownAddonOptions(options: MarkdownAddonOptions): MarkdownAddonOptions {
  return options
}
