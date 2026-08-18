import type { ElementPlusDocsPlaygroundAdapter } from './types'
import { utoa } from '../../upstream/vitepress/utils'

const defaultElementPlusPlaygroundUrl = 'https://element-plus.run/'
const mainFileName = 'App.vue'

export interface ElementPlusPlaygroundUrlOptions {
  dark?: boolean
  url?: string
}

export interface ElementPlusPlaygroundAdapterOptions extends ElementPlusPlaygroundUrlOptions {
  baseUrl?: () => string
  isDark?: () => boolean
  open: (url: string) => void
  path?: string
  resolvePath?: (path: string) => string
}

export function createElementPlusPlaygroundUrl(
  source: string,
  options: ElementPlusPlaygroundUrlOptions = {},
): string {
  const link = new URL(options.url ?? defaultElementPlusPlaygroundUrl)

  if (options.dark)
    link.searchParams.append('theme', 'dark')
  if (source.includes('@vueuse/core'))
    link.searchParams.append('extra_packages', '@vueuse/core')
  if (source)
    link.hash = utoa(JSON.stringify({ [mainFileName]: source }))

  return link.toString()
}

export function createElementPlusPlaygroundAdapter(
  options: ElementPlusPlaygroundAdapterOptions,
): ElementPlusDocsPlaygroundAdapter {
  return {
    kind: 'element-plus',
    createAction: () => ({
      kind: 'element-plus',
      open: ({ source }) => {
        const url = options.path
          ? new URL(
              options.resolvePath?.(options.path) ?? options.path,
              options.baseUrl?.() ?? defaultElementPlusPlaygroundUrl,
            ).toString()
          : options.url
        options.open(createElementPlusPlaygroundUrl(source, {
          dark: options.isDark?.(),
          url,
        }))
      },
    }),
  }
}
