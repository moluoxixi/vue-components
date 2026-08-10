import type { ViteSsgAddonOptions } from '../../../addons'
import { defineFeature } from './runtime'
import { mergeAddonOptions, VUE_I18N_PATTERN } from './shared'

type ViteSsgResolvedConfig = ViteSsgAddonOptions & {
  ssgOptions?: {
    beastiesOptions?: {
      reduceInlineStyles?: boolean
    }
    formatting?: string
    onFinished?: () => void | Promise<void>
    script?: string
  }
}

export const viteSsgFeature = defineFeature<ViteSsgAddonOptions>({
  name: 'viteSsg',
  order: 110,
  requires: ['vite-ssg'],
  triggers: ['vite-ssg'],
  async setup(ctx, options) {
    const noExternal: Array<string | RegExp> = []
    if (ctx.hasAddonDep('vue-i18n')) {
      noExternal.push(VUE_I18N_PATTERN)
    }

    const defaultOptions = {
      ssgOptions: {
        beastiesOptions: {
          reduceInlineStyles: false,
        },
        formatting: 'minify',
        script: 'async',
      },
    } satisfies ViteSsgAddonOptions
    const resolvedOptions = mergeAddonOptions(options, defaultOptions) as ViteSsgResolvedConfig

    if (!ctx.hasAddonDep('vite-ssg-sitemap')) {
      return noExternal.length > 0 && resolvedOptions.ssr?.noExternal === undefined
        ? { ...resolvedOptions, ssr: { ...resolvedOptions.ssr, noExternal } }
        : resolvedOptions
    }

    const { default: generateSitemap } = await ctx.importRequired<{ default: () => void | Promise<void> }>('viteSsg:sitemap', 'vite-ssg-sitemap')
    const ssgOptions = resolvedOptions.ssgOptions
    const userOnFinished = ssgOptions?.onFinished

    return {
      ...resolvedOptions,
      ssgOptions: {
        ...ssgOptions,
        async onFinished() {
          await userOnFinished?.()
          await generateSitemap()
        },
      },
      ...(noExternal.length > 0 && resolvedOptions.ssr?.noExternal === undefined
        ? { ssr: { ...resolvedOptions.ssr, noExternal } }
        : {}),
    }
  },
})
