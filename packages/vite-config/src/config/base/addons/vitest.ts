import type { VitestAddonOptions } from '../../../addons'
import { defineFeature } from './runtime'
import { mergeAddonOptions } from './shared'

export const vitestFeature = defineFeature<VitestAddonOptions>({
  name: 'vitest',
  order: 100,
  triggers: ['vitest'],
  setup(_ctx, options) {
    const defaultOptions = {
      environment: 'jsdom',
      include: ['test/**/*.test.ts'],
    } satisfies VitestAddonOptions

    return {
      test: mergeAddonOptions(options, defaultOptions),
    }
  },
})
