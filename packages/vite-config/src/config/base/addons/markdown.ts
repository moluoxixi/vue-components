import type linkAttributes from 'markdown-it-link-attributes'
import type { MarkdownAddonOptions } from '../../../addons'
import { defineFeature } from './runtime'
import { HTTP_URL_PATTERN, mergeAddonOptions } from './shared'

type MarkdownModule = typeof import('unplugin-vue-markdown/vite')
type ShikiModule = typeof import('@shikijs/markdown-it')
interface LinkAttributesModule {
  default: typeof linkAttributes
}
type MarkdownItSetup = NonNullable<MarkdownAddonOptions['markdownItSetup']>

export const markdownFeature = defineFeature<MarkdownAddonOptions>({
  name: 'markdown',
  requires: ['unplugin-vue-markdown', '@shikijs/markdown-it', 'markdown-it-link-attributes'],
  triggers: ['unplugin-vue-markdown', 'vite-plugin-vue-markdown', 'vite-plugin-md'],
  async setup(ctx, options) {
    const { default: Markdown } = await ctx.importRequired<MarkdownModule>('markdown', 'unplugin-vue-markdown/vite')
    const { default: Shiki } = await ctx.importRequired<ShikiModule>('markdown:shiki', '@shikijs/markdown-it')
    const { default: LinkAttributes } = await ctx.importRequired<LinkAttributesModule>('markdown:linkAttributes', 'markdown-it-link-attributes')
    const defaultOptions = {
      async markdownItSetup(md: Parameters<MarkdownItSetup>[0]) {
        md.use(LinkAttributes, {
          attrs: {
            rel: 'noopener',
            target: '_blank',
          },
          matcher: (link: string) => HTTP_URL_PATTERN.test(link),
        })
        md.use(await Shiki({
          defaultColor: false,
          themes: {
            dark: 'vitesse-dark',
            light: 'vitesse-light',
          },
        }))
      },
      headEnabled: true,
      wrapperClasses: 'prose prose-sm m-auto text-left',
    } satisfies MarkdownAddonOptions

    return {
      plugins: [
        Markdown(mergeAddonOptions(options, defaultOptions)),
      ],
    }
  },
})
