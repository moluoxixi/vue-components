import type { UserConfig } from 'vite'
import type { PwaAddonOptions } from '../../../addons'
import { defineFeature } from './runtime'
import { mergeAddonOptions } from './shared'

interface VitePwaModule {
  VitePWA: (options?: PwaAddonOptions) => unknown
}

const defaultPwaOptions = {
  registerType: 'autoUpdate',
} satisfies PwaAddonOptions

export const pwaFeature = defineFeature<PwaAddonOptions>({
  name: 'pwa',
  order: 80,
  requires: ['vite-plugin-pwa'],
  triggers: ['vite-plugin-pwa'],
  async setup(ctx, options) {
    const { VitePWA } = await ctx.importRequired<VitePwaModule>('pwa', 'vite-plugin-pwa')
    return {
      plugins: [
        VitePWA(mergeAddonOptions(options, defaultPwaOptions)) as NonNullable<UserConfig['plugins']>[number],
      ],
    } satisfies UserConfig
  },
})
