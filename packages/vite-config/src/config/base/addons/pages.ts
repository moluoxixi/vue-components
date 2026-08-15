import type { PagesAddonOptions } from '../../../addons'
import { defineFeature } from './runtime'
import { callDefaultFactory, mergeAddonOptions } from './shared'

type PagesModule = typeof import('vite-plugin-pages')

export const pagesFeature = defineFeature<PagesAddonOptions>({
  name: 'pages',
  requires: ['vite-plugin-pages'],
  triggers: ['vite-plugin-pages'],
  async setup(ctx, options) {
    const react = ctx.hasAnyAddonDep(['react', '@vitejs/plugin-react'])
    const vue = ctx.hasAnyAddonDep(['vue', '@vitejs/plugin-vue'])
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
