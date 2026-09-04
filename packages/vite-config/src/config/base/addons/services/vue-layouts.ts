import type { VueLayoutsAddonOptions } from '../../../../addons'
import type { ViteFeature } from '../types'
import { callDefaultFactory } from './plugin-factory'
import { defineFeature } from './runtime'

type VueLayoutsModule = typeof import('vite-plugin-vue-layouts')

export const vueLayoutsFeature: ViteFeature<VueLayoutsAddonOptions> = defineFeature<VueLayoutsAddonOptions>({
  name: 'vueLayouts',
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
