import type tailwindPostcssFactory from '@tailwindcss/postcss'
import type tailwindViteFactory from '@tailwindcss/vite'
import type { TailwindCssAddonOptions } from '../../../addons'
import { defineFeature } from './runtime'
import { callDefaultFactory } from './shared'

interface TailwindViteModule {
  default: typeof tailwindViteFactory
}

interface TailwindPostcssModule {
  default: typeof tailwindPostcssFactory
}

export const tailwindcssFeature = defineFeature<TailwindCssAddonOptions>({
  name: 'tailwindcss',
  order: 35,
  triggers: ['@tailwindcss/vite', '@tailwindcss/postcss'],
  async setup(ctx, options) {
    if (ctx.hasAddonDep('@tailwindcss/vite')) {
      const plugins = await callDefaultFactory<TailwindCssAddonOptions, ReturnType<TailwindViteModule['default']>>(ctx, 'tailwindcss', '@tailwindcss/vite', options)
      return {
        plugins,
      }
    }

    if (ctx.hasAddonDep('@tailwindcss/postcss')) {
      const { default: tailwindPostcss } = await ctx.importRequired<TailwindPostcssModule>('tailwindcss:postcss', '@tailwindcss/postcss')
      return {
        css: {
          postcss: {
            plugins: [tailwindPostcss(options)],
          },
        },
      }
    }

    throw new Error('[ViteConfig] tailwindcss requires @tailwindcss/vite or @tailwindcss/postcss. Install one Tailwind CSS integration package for the target project.')
  },
})
