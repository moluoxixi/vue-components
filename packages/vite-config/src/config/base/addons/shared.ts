import type { AddonContext } from './runtime'
import { createDefu } from 'defu'

export const HTTP_URL_PATTERN = /^https?:\/\//
export const MARKDOWN_PATTERN = /\.md$/
export const VUE_I18N_PATTERN = /vue-i18n/
export const VUE_PATTERN = /\.vue$/

const JS_TS_PATTERN = /\.[jt]sx?$/
const MARKDOWN_PLUGIN_NAMES = ['unplugin-vue-markdown', 'vite-plugin-md', 'vite-plugin-vue-markdown']
const SVELTE_PATTERN = /\.svelte$/
const VUE_QUERY_PATTERN = /\.vue\?vue/

const mergeDefaults = createDefu((object, key, value) => {
  const target = object as Record<PropertyKey, unknown>
  const defaultValue = target[key]
  if (Array.isArray(value) && Array.isArray(defaultValue)) {
    target[key] = [...new Set([...value, ...defaultValue])]
    return true
  }
})

/**
 * 使用调用方传入的插件原生 options 类型合并默认值，避免在 addon 内部把配置擦成裸对象协议。
 */
export function mergeAddonOptions<TOptions extends object>(
  options: TOptions | undefined,
  defaultOptions: TOptions,
): TOptions {
  return mergeDefaults<TOptions, [TOptions]>((options ?? {}) as TOptions, defaultOptions)
}

/**
 * 调用默认导出的插件工厂；模块缺失和导出错误都会保持失败可见。
 */
export async function callDefaultFactory<TOptions, TResult>(
  ctx: AddonContext,
  owner: string,
  specifier: string,
  options?: TOptions,
): Promise<TResult> {
  const mod = await ctx.importRequired<{ default?: (options?: TOptions) => TResult }>(owner, specifier)
  if (typeof mod.default !== 'function') {
    throw new TypeError(`[ViteConfig] ${owner} expected ${specifier} to expose a default plugin factory`)
  }

  return mod.default(options)
}

/**
 * 判断目标项目是否启用了 Markdown 作为 Vue 生态输入源。
 */
export function hasMarkdownAddon(ctx: AddonContext): boolean {
  return ctx.hasAnyAddonDep(MARKDOWN_PLUGIN_NAMES)
}

/**
 * 构造 Vue 插件需要处理的文件匹配规则。
 */
export function createVueIncludePatterns(ctx: AddonContext): RegExp[] {
  const include: RegExp[] = []

  if (ctx.hasAddonDep('vue')) {
    include.push(VUE_PATTERN)
  }

  if (hasMarkdownAddon(ctx)) {
    include.push(MARKDOWN_PATTERN)
  }

  return include
}

/**
 * 构造源码扫描类插件共享的 include 规则。
 */
export function createSourceIncludePatterns(ctx: AddonContext): RegExp[] {
  const include = [JS_TS_PATTERN]

  if (ctx.hasAddonDep('vue')) {
    include.push(VUE_PATTERN, VUE_QUERY_PATTERN)
  }

  if (ctx.hasAddonDep('svelte')) {
    include.push(SVELTE_PATTERN)
  }

  if (hasMarkdownAddon(ctx)) {
    include.push(MARKDOWN_PATTERN)
  }

  return include
}
