import type { ReactAddonOptions } from '../../../addons'
import { defineFeature } from './runtime'
import { callDefaultFactory } from './shared'

type ReactModule = typeof import('@vitejs/plugin-react')

export const reactFeature = defineFeature<ReactAddonOptions>({
  name: 'react',
  requires: ['@vitejs/plugin-react'],
  triggers: ['react', '@vitejs/plugin-react'],
  async setup(ctx, options) {
    return {
      plugins: [
        await callDefaultFactory<ReactAddonOptions, ReturnType<ReactModule['default']>>(ctx, 'react', '@vitejs/plugin-react', options),
      ],
    }
  },
})
