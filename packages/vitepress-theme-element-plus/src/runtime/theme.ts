import type { Theme } from 'vitepress'
import type { ElementPlusDocsTheme } from '../types'
import { isClient } from '@vueuse/core'
import ElementPlus, { ID_INJECTION_KEY, ZINDEX_INJECTION_KEY } from 'element-plus'
import { defineAsyncComponent } from 'vue'

const ElementPlusDocsLayout = defineAsyncComponent(() => import('./element-plus-docs-layout'))
const VPNotFound = defineAsyncComponent(() => import('../upstream/vitepress/components/vp-not-found.vue'))
const loadBuiltThemeStyles = () => Promise.resolve('__MOLUOXIXI_THEME_STYLES__')

function enhanceApp({ app, router }: Parameters<NonNullable<Theme['enhanceApp']>>[0]) {
  app.use(ElementPlus)
  app.provide(ID_INJECTION_KEY, { prefix: 1024, current: 0 })
  app.provide(ZINDEX_INJECTION_KEY, { current: 0 })
  void Promise.all([
    import('normalize.css'),
    import('element-plus/dist/index.css'),
    import('element-plus/theme-chalk/dark/css-vars.css'),
    import('virtual:moluoxixi-element-plus-docs-consumer-styles'),
    import('../upstream/vitepress/styles/css-vars.scss'),
    import('../upstream/vitepress/styles/app.scss'),
    loadBuiltThemeStyles(),
  ])
  if (isClient) {
    void import('nprogress').then(({ default: nprogress }) => {
      router.onBeforeRouteChange = () => {
        nprogress.start()
      }
      router.onAfterRouteChange = () => {
        nprogress.done()
      }
    })
  }
}

export function createElementPlusDocsTheme(extension: Partial<Theme> = {}): ElementPlusDocsTheme {
  const { enhanceApp: extendApp, ...themeExtension } = extension
  return {
    Layout: ElementPlusDocsLayout,
    NotFound: VPNotFound,
    ...themeExtension,
    async enhanceApp(context) {
      await enhanceApp(context)
      await extendApp?.(context)
    },
  }
}

export const elementPlusDocsTheme = createElementPlusDocsTheme()
