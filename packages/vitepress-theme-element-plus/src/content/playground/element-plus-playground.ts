import { utoa } from '../../upstream/vitepress/utils'

const defaultElementPlusPlaygroundUrl = 'https://element-plus.run/'
const mainFileName = 'App.vue'

export interface ElementPlusPlaygroundUrlOptions {
  dark?: boolean
  url?: string
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
