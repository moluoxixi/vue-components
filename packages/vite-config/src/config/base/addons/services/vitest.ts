import type { VitestAddonOptions } from '../../../../addons'
import { mergeAddonOptions } from '../utils'
import { defineFeature } from './runtime'

export const vitestFeature = defineFeature<VitestAddonOptions>({
  name: 'vitest',
  triggers: [],
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
