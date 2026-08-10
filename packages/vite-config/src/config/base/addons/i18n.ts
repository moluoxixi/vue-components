import type { I18nAddonOptions } from '../../../addons'
import { defineFeature } from './runtime'
import { mergeAddonOptions } from './shared'

type I18nModule = typeof import('@intlify/unplugin-vue-i18n/vite')

export const i18nFeature = defineFeature<I18nAddonOptions>({
  name: 'i18n',
  order: 60,
  requires: ['@intlify/unplugin-vue-i18n'],
  triggers: ['@intlify/unplugin-vue-i18n'],
  async setup(ctx, options) {
    const { default: VueI18n } = await ctx.importRequired<I18nModule>('i18n', '@intlify/unplugin-vue-i18n/vite')
    const defaultOptions = {
      compositionOnly: true,
      fullInstall: true,
      include: [ctx.resolvePath('locales/**')],
      runtimeOnly: true,
    } satisfies I18nAddonOptions

    return {
      plugins: [
        VueI18n(mergeAddonOptions(options, defaultOptions)),
      ],
    }
  },
})
