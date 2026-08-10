import type {
  AutoImportAddonOptions,
  ComponentsAddonOptions,
  PwaAddonOptions,
  ReactAddonOptions,
  TailwindCssAddonOptions,
  ViteConfigOptions,
  VitestAddonOptions,
  VueAddonOptions,
} from '@moluoxixi/vite-config'
import {
  createAppConfig,
  defineAutoImportAddonOptions,
  defineComponentsAddonOptions,
  definePwaAddonOptions,
  defineReactAddonOptions,
  defineTailwindCssAddonOptions,
  defineVitestAddonOptions,
  defineVueAddonOptions,
} from '@moluoxixi/vite-config'
import { expectTypeOf } from 'vitest'

const autoImportOptions = defineAutoImportAddonOptions({
  dts: 'src/typings/auto-imports.d.ts',
  imports: ['vue', { 'vue-router/auto': ['useLink'] }],
  vueTemplate: true,
})

const componentsOptions = defineComponentsAddonOptions({
  dts: 'src/typings/components.d.ts',
  extensions: ['vue', 'md'],
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
} satisfies ViteConfigOptions

createAppConfig(appOptions)

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

expectTypeOf(appOptions.autoImport).toMatchTypeOf<AutoImportAddonOptions | boolean | undefined>()
expectTypeOf(appOptions.components).toMatchTypeOf<ComponentsAddonOptions | boolean | undefined>()
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
