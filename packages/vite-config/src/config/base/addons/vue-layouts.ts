import type { VueLayoutsAddonOptions } from '../../../addons'
import type { ViteFeature } from './runtime'
import { defineFeature } from './runtime'
import { callDefaultFactory } from './shared'

type VueLayoutsModule = typeof import('vite-plugin-vue-layouts')

export const vueLayoutsFeature: ViteFeature<VueLayoutsAddonOptions> = defineFeature<VueLayoutsAddonOptions>({
  name: 'vueLayouts',
  order: 45,
  requires: ['vite-plugin-vue-layouts'],
  triggers: ['vite-plugin-vue-layouts'],
  async setup(ctx, options) {
    return {
      plugins: [
        await callDefaultFactory<VueLayoutsAddonOptions, ReturnType<VueLayoutsModule['default']>>(ctx, 'vueLayouts', 'vite-plugin-vue-layouts', options),
      ],
    }
  },
})
