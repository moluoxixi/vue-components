import type {
  AppViteConfigOptions,
  AutoImportAddonOptions,
  ComponentsAddonOptions,
  LibViteConfigOptions,
  PagesAddonOptions,
  PwaAddonOptions,
  ReactAddonOptions,
  TailwindCssAddonOptions,
  ViteConfigOptions,
  VitestAddonOptions,
  VueAddonOptions,
} from '@moluoxixi/vite-config'
import {
  createAppConfig,
  createLibConfig,
  defineAutoImportAddonOptions,
  defineComponentsAddonOptions,
  definePagesAddonOptions,
  definePwaAddonOptions,
  defineReactAddonOptions,
  defineTailwindCssAddonOptions,
  defineVitestAddonOptions,
  defineVueAddonOptions,
  getBaseConfig,
} from '@moluoxixi/vite-config'
import { expectTypeOf } from 'vitest'

declare module '@moluoxixi/vite-config' {
  interface ViteConfigOptions {
    legacyExtension?: boolean
  }
}

const autoImportOptions = defineAutoImportAddonOptions({
  dts: 'src/typings/auto-imports.d.ts',
  imports: ['vue', { 'vue-router/auto': ['useLink'] }],
  vueTemplate: true,
})

const componentsOptions = defineComponentsAddonOptions({
  dts: 'src/typings/components.d.ts',
  extensions: ['vue', 'md'],
})

const pagesOptions = definePagesAddonOptions({
  dirs: 'src/pages',
  exclude: ['**/components/**'],
  extensions: ['vue'],
})

const vueOptions = defineVueAddonOptions({
  include: /\.vue$/,
  script: {
    propsDestructure: true,
  },
})

const reactOptions = defineReactAddonOptions({
  jsxRuntime: 'automatic',
  reactRefreshHost: 'http://localhost:3000',
})

const pwaOptions = definePwaAddonOptions({
  manifest: {
    name: 'Demo App',
  },
  registerType: 'autoUpdate',
})

const tailwindOptions = defineTailwindCssAddonOptions({
  optimize: {
    minify: true,
  },
})

const vitestOptions = defineVitestAddonOptions({
  environment: 'jsdom',
  include: ['test/**/*.test.ts'],
})

createAppConfig({
  autoImport: autoImportOptions,
  components: componentsOptions,
  pwa: pwaOptions,
  pages: pagesOptions,
  react: reactOptions,
  tailwindcss: tailwindOptions,
  unocss: 'uno.config.ts',
  vitest: vitestOptions,
  vue: vueOptions,
})

const appOptions = {
  autoImport: {
    imports: ['vue'],
    vueTemplate: true,
  },
  components: {
    extensions: ['vue'],
  },
  pages: pagesOptions,
  pwa: {
    manifest: {
      name: 'Demo App',
    },
    registerType: 'autoUpdate',
  },
  react: {
    jsxRuntime: 'automatic',
  },
  tailwindcss: {
    optimize: {
      minify: true,
    },
  },
  unocss: 'uno.config.ts',
  vitest: {
    environment: 'jsdom',
  },
  vue: {
    include: /\.vue$/,
    script: {
      propsDestructure: true,
    },
  },
} satisfies AppViteConfigOptions

createAppConfig(appOptions)

const libOptions = {
  entry: 'src/index.ts',
  vue: false,
} satisfies LibViteConfigOptions

createLibConfig(libOptions)

const legacyLibOptions: ViteConfigOptions = {
  ...libOptions,
  legacyExtension: true,
}
createLibConfig(legacyLibOptions)

// @ts-expect-error Library entries are not valid application options.
createAppConfig({ entry: 'src/index.ts' })

// @ts-expect-error Base addon resolution does not accept library entries.
getBaseConfig({ entry: 'src/index.ts' })

// @ts-expect-error auto-import 配置必须使用 unplugin-auto-import 的真实类型。
createAppConfig({ autoImport: { vueTemplate: 'yes' } })

// @ts-expect-error components 配置必须使用 unplugin-vue-components 的真实类型。
createAppConfig({ components: { extensions: [1] } })

// @ts-expect-error React 配置必须使用 @vitejs/plugin-react 的真实类型。
createAppConfig({ react: { jsxRuntime: 'invalid' } })

// @ts-expect-error Tailwind CSS 配置必须使用 @tailwindcss/vite 的真实类型。
createAppConfig({ tailwindcss: { optimize: { minify: 'yes' } } })

// @ts-expect-error Vitest 配置必须使用 Vitest 的真实类型。
createAppConfig({ vitest: { environment: 1 } })

// @ts-expect-error Vue 配置必须使用 @vitejs/plugin-vue 的真实类型。
createAppConfig({ vue: { script: { propsDestructure: 'yes' } } })

// @ts-expect-error pages 配置必须使用 vite-plugin-pages 的真实类型。
createAppConfig({ pages: { extensions: [1] } })

expectTypeOf(appOptions.autoImport).toMatchTypeOf<AutoImportAddonOptions | boolean | undefined>()
expectTypeOf(appOptions.components).toMatchTypeOf<ComponentsAddonOptions | boolean | undefined>()
expectTypeOf(appOptions.pages).toMatchTypeOf<PagesAddonOptions | boolean | undefined>()
expectTypeOf(appOptions.pwa).toMatchTypeOf<PwaAddonOptions | boolean | undefined>()
expectTypeOf(appOptions.react).toMatchTypeOf<ReactAddonOptions | boolean | undefined>()
expectTypeOf(appOptions.tailwindcss).toMatchTypeOf<TailwindCssAddonOptions | boolean | undefined>()
expectTypeOf(appOptions.vitest).toMatchTypeOf<VitestAddonOptions | boolean | undefined>()
expectTypeOf(appOptions.vue).toMatchTypeOf<VueAddonOptions | boolean | undefined>()
expectTypeOf(autoImportOptions.vueTemplate).toEqualTypeOf<boolean | undefined>()
expectTypeOf(componentsOptions.extensions).toEqualTypeOf<string | string[] | undefined>()
expectTypeOf(vueOptions.script?.propsDestructure).toEqualTypeOf<boolean | undefined>()
expectTypeOf(reactOptions.jsxRuntime).toEqualTypeOf<'classic' | 'automatic' | undefined>()
expectTypeOf(pwaOptions.registerType).toEqualTypeOf<'autoUpdate'>()
expectTypeOf(tailwindOptions.optimize).toEqualTypeOf<boolean | { minify?: boolean } | undefined>()
expectTypeOf(vitestOptions.environment).toExtend<string | undefined>()
expectTypeOf(pagesOptions.extensions).toEqualTypeOf<string[] | undefined>()
