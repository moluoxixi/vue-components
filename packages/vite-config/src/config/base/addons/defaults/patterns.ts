import type { AddonContext } from '../types'

export const HTTP_URL_PATTERN = /^https?:\/\//
export const MARKDOWN_PATTERN = /\.md$/
export const VUE_I18N_PATTERN = /vue-i18n/
export const VUE_PATTERN = /\.vue$/

const JS_TS_PATTERN = /\.[jt]sx?$/
const MARKDOWN_PLUGIN_NAMES = ['unplugin-vue-markdown', 'vite-plugin-md', 'vite-plugin-vue-markdown']
const SVELTE_PATTERN = /\.svelte$/
const VUE_QUERY_PATTERN = /\.vue\?vue/

export function hasMarkdownAddon(ctx: AddonContext): boolean {
  return ctx.hasAnyAddonDep(MARKDOWN_PLUGIN_NAMES)
}

export function createVueIncludePatterns(ctx: AddonContext): RegExp[] {
  const include: RegExp[] = []

  if (ctx.hasAddonDep('vue'))
    include.push(VUE_PATTERN)

  if (hasMarkdownAddon(ctx))
    include.push(MARKDOWN_PATTERN)

  return include
}

export function createSourceIncludePatterns(ctx: AddonContext): RegExp[] {
  const include = [JS_TS_PATTERN]

  if (ctx.hasAddonDep('vue'))
    include.push(VUE_PATTERN, VUE_QUERY_PATTERN)

  if (ctx.hasAddonDep('svelte'))
    include.push(SVELTE_PATTERN)

  if (hasMarkdownAddon(ctx))
    include.push(MARKDOWN_PATTERN)

  return include
}
