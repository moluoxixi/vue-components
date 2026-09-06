import type { PagesAddonOptions } from '../../../../addons'
import { mergeAddonOptions } from '../utils'
import { callDefaultFactory } from './plugin-factory'
import { defineFeature } from './runtime'

type PagesModule = typeof import('vite-plugin-pages')

export const pagesFeature = defineFeature<PagesAddonOptions>({
  name: 'pages',
  requires: ['vite-plugin-pages'],
  triggers: ['vite-plugin-pages'],
  async setup(ctx, options) {
    const react = ctx.isFeatureEnabled('react')
    const vue = ctx.isFeatureEnabled('vue')
    const defaultOptions: PagesAddonOptions = {
      dirs: 'src/pages',
      exclude: ['**/components/**', '**/__tests__/**'],
      ...(react && !vue ? { extensions: ['tsx'], resolver: 'react' as const } : {}),
      ...(vue || !react ? { extensions: ['vue'] } : {}),
    }
    return {
      plugins: [
        await callDefaultFactory<PagesAddonOptions, ReturnType<PagesModule['default']>>(
          ctx,
          'pages',
          'vite-plugin-pages',
          mergeAddonOptions(options, defaultOptions),
        ),
      ],
    }
  },
})
