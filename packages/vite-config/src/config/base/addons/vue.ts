import type { PluginOption } from 'vite'
import type { VueAddonOptions } from '../../../addons'
import { defineFeature } from './runtime'
import { createVueIncludePatterns, mergeAddonOptions } from './shared'

type VueModule = typeof import('@vitejs/plugin-vue')
interface VueMacrosModule {
  default: (options: {
    plugins: {
      vue: PluginOption
    }
  }) => PluginOption
}

export const vueFeature = defineFeature<VueAddonOptions>({
  name: 'vue',
  order: 10,
  requires: ['@vitejs/plugin-vue'],
  triggers: ['vue', '@vitejs/plugin-vue'],
  async setup(ctx, options) {
    const { default: vue } = await ctx.importRequired<VueModule>('vue', '@vitejs/plugin-vue')
    const defaultOptions = {
      include: createVueIncludePatterns(ctx),
    } satisfies VueAddonOptions
    const vuePlugin = vue(mergeAddonOptions(options, defaultOptions))

    if (ctx.hasAddonDep('unplugin-vue-macros')) {
      const { default: VueMacros } = await ctx.importRequired<VueMacrosModule>('vue:macros', 'unplugin-vue-macros/vite')
      return {
        plugins: [
          VueMacros({
            plugins: {
              vue: vuePlugin,
            },
          }),
        ],
      }
    }

    return { plugins: [vuePlugin] }
  },
})
