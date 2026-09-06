import type { PluginOption } from 'vite'
import type { VueAddonOptions } from '../../../../addons'
import { createVueIncludePatterns } from '../defaults'
import { mergeAddonOptions } from '../utils'
import { defineFeature } from './runtime'

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
  requires: ['@vitejs/plugin-vue'],
  triggers: ['@vitejs/plugin-vue'],
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
