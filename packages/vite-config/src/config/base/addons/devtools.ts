import type { DevtoolsAddonOptions } from '../../../addons'
import { defineFeature } from './runtime'
import { callDefaultFactory } from './shared'

type DevtoolsModule = typeof import('vite-plugin-vue-devtools')

export const devtoolsFeature = defineFeature<DevtoolsAddonOptions>({
  name: 'devtools',
  requires: ['vite-plugin-vue-devtools'],
  triggers: ['vite-plugin-vue-devtools'],
  async setup(ctx, options) {
    return {
      plugins: [
        await callDefaultFactory<DevtoolsAddonOptions, ReturnType<DevtoolsModule['default']>>(ctx, 'devtools', 'vite-plugin-vue-devtools', options),
      ],
    }
  },
})
