import type { AutoImportAddonOptions } from '../../../../addons'
import type { AddonContext } from '../types'
import { createSourceIncludePatterns } from '../defaults'
import { mergeAddonOptions } from '../utils'
import { defineFeature } from './runtime'

type AutoImportModule = typeof import('unplugin-auto-import/vite')
type ElementPlusResolverModule = typeof import('unplugin-vue-components/resolvers')
type UnheadVueModule = typeof import('@unhead/vue')
type VueRouterAutoImportsModule = typeof import('unplugin-vue-router')
type ArrayableItem<T> = T extends readonly (infer TItem)[] ? TItem : T
type AutoImportImport = ArrayableItem<NonNullable<AutoImportAddonOptions['imports']>>
type AutoImportResolver = ArrayableItem<NonNullable<AutoImportAddonOptions['resolvers']>>
type AutoImportPreset = Extract<AutoImportImport, string>
type AutoImportDefaultOptions = AutoImportAddonOptions

interface AutoImportState {
  imports: AutoImportImport[]
  include: RegExp[]
  resolvers: AutoImportResolver[]
}

/**
 * 根据项目依赖追加内置 imports preset。
 */
function applyPresetImports(ctx: AddonContext, state: AutoImportState): void {
  const presets = [
    'vue',
    'react',
    'vue-i18n',
    '@vueuse/core',
    '@vueuse/math',
    '@vueuse/head',
    'vitest',
    'pinia',
    'preact',
    'quasar',
    'react-router',
    'react-router-dom',
    'rxjs',
    'solid-js',
    'svelte',
  ] as const satisfies readonly AutoImportPreset[]

  for (const preset of presets) {
    if (ctx.hasAddonDep(preset)) {
      state.imports.push(preset)
    }
  }

  if (!ctx.hasAddonDep('unplugin-vue-router') && ctx.hasAddonDep('vue-router')) {
    state.imports.push('vue-router')
  }
}

/**
 * 将 unplugin-vue-router 的自动导入能力接入 auto-import。
 */
async function applyVueRouterAutoImports(ctx: AddonContext, state: AutoImportState): Promise<void> {
  if (!ctx.hasAddonDep('unplugin-vue-router')) {
    return
  }

  const { VueRouterAutoImports } = await ctx.importRequired<VueRouterAutoImportsModule>('autoImport:vueRouterAutoImports', 'unplugin-vue-router')
  state.imports.push(VueRouterAutoImports)
  state.imports.push({ 'vue-router/auto': ['useLink'] })
}

/**
 * 将 Unhead composables 接入 auto-import。
 */
async function applyUnheadAutoImports(ctx: AddonContext, state: AutoImportState): Promise<void> {
  if (!ctx.hasAddonDep('@unhead/vue')) {
    return
  }

  const { unheadVueComposablesImports } = await ctx.importRequired<UnheadVueModule>('autoImport:unheadAutoImports', '@unhead/vue')
  state.imports.push(unheadVueComposablesImports)
}

/**
 * 将 Element Plus resolver 接入 auto-import。
 */
async function applyElementPlusResolver(ctx: AddonContext, state: AutoImportState): Promise<void> {
  if (!ctx.hasAddonDep('element-plus')) {
    return
  }

  ctx.requireDeps('autoImport:elementPlusResolver', ['unplugin-vue-components'])
  const { ElementPlusResolver } = await ctx.importRequired<ElementPlusResolverModule>('autoImport:elementPlusResolver', 'unplugin-vue-components/resolvers')
  state.resolvers.push(ElementPlusResolver())
}

export const autoImportFeature = defineFeature<AutoImportAddonOptions, AutoImportState>({
  name: 'autoImport',
  requires: ['unplugin-auto-import'],
  triggers: ['unplugin-auto-import'],
  createState(ctx) {
    const state = {
      imports: [],
      include: createSourceIncludePatterns(ctx),
      resolvers: [],
    }

    applyPresetImports(ctx, state)
    return state
  },
  async setup(ctx, options, state) {
    await applyVueRouterAutoImports(ctx, state)
    await applyUnheadAutoImports(ctx, state)
    await applyElementPlusResolver(ctx, state)

    const { default: AutoImport } = await ctx.importRequired<AutoImportModule>('autoImport', 'unplugin-auto-import/vite')
    const defaultOptions = {
      dirs: ['src/composables', 'src/stores', 'src/utils'],
      dts: ctx.resolvePath('src/typings/auto-imports.d.ts'),
      imports: state.imports,
      include: state.include,
      ...(state.resolvers.length > 0 ? { resolvers: state.resolvers } : {}),
      vueTemplate: ctx.hasAddonDep('vue'),
    } satisfies AutoImportDefaultOptions
    const autoImportOptions = mergeAddonOptions(options, defaultOptions)

    return {
      plugins: [
        AutoImport(autoImportOptions),
      ],
    }
  },
})
