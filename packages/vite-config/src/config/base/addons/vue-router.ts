import type { VueRouterAddonOptions } from '../../../addons'
import { defineFeature } from './runtime'
import { callDefaultFactory, hasMarkdownAddon, mergeAddonOptions } from './shared'

type VueRouterModule = typeof import('unplugin-vue-router/vite')

export const vueRouterFeature = defineFeature<VueRouterAddonOptions>({
  name: 'vueRouter',
  requires: ['unplugin-vue-router'],
  triggers: ['unplugin-vue-router'],
  async setup(ctx, options) {
    const extensions: string[] = []
    if (ctx.hasAddonDep('vue')) {
      extensions.push('.vue')
    }
    if (hasMarkdownAddon(ctx)) {
      extensions.push('.md')
    }

    const defaultOptions = {
      dts: ctx.resolvePath('src/typings/route-map.d.ts'),
      extensions,
      root: ctx.root,
      routesFolder: ctx.resolvePath('src/pages'),
    } satisfies VueRouterAddonOptions

    return {
      plugins: [
        await callDefaultFactory<VueRouterAddonOptions, ReturnType<VueRouterModule['default']>>(
          ctx,
          'vueRouter',
          'unplugin-vue-router/vite',
          mergeAddonOptions(options, defaultOptions),
        ),
      ],
    }
  },
})
