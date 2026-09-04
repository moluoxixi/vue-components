import type { ComponentsAddonOptions } from '../../../../addons'
import type { AddonContext } from '../types'
import { createSourceIncludePatterns, hasMarkdownAddon } from '../defaults'
import { mergeAddonOptions } from '../utils'
import { defineFeature } from './runtime'

type ComponentsModule = typeof import('unplugin-vue-components/vite')
type ElementPlusResolverModule = typeof import('unplugin-vue-components/resolvers')
type ComponentResolver = NonNullable<ComponentsAddonOptions['resolvers']>[number]
type ComponentsDefaultOptions = ComponentsAddonOptions

interface ComponentsState {
  extensions: string[]
  include: RegExp[]
  resolvers: ComponentResolver[]
}

/**
 * 将 Element Plus 组件解析器接入 components 插件。
 */
async function applyElementPlusResolver(ctx: AddonContext, state: ComponentsState): Promise<void> {
  if (!ctx.hasAddonDep('element-plus')) {
    return
  }

  ctx.requireDeps('components:elementPlusResolver', ['unplugin-vue-components'])
  const { ElementPlusResolver } = await ctx.importRequired<ElementPlusResolverModule>('components:elementPlusResolver', 'unplugin-vue-components/resolvers')
  state.resolvers.push(ElementPlusResolver())
}

export const componentsFeature = defineFeature<ComponentsAddonOptions, ComponentsState>({
  name: 'components',
  requires: ['unplugin-vue-components'],
  triggers: ['unplugin-vue-components'],
  createState(ctx) {
    const extensions: string[] = []
    if (ctx.hasAddonDep('vue')) {
      extensions.push('vue')
    }
    if (ctx.hasAddonDep('svelte')) {
      extensions.push('svelte')
    }
    if (hasMarkdownAddon(ctx)) {
      extensions.push('md')
    }

    return {
      extensions,
      include: createSourceIncludePatterns(ctx),
      resolvers: [],
    }
  },
  async setup(ctx, options, state) {
    await applyElementPlusResolver(ctx, state)

    const { default: Components } = await ctx.importRequired<ComponentsModule>('components', 'unplugin-vue-components/vite')
    const defaultOptions = {
      dts: ctx.resolvePath('src/typings/components.d.ts'),
      extensions: state.extensions,
      include: state.include,
      ...(state.resolvers.length > 0 ? { resolvers: state.resolvers } : {}),
    } satisfies ComponentsDefaultOptions
    const componentOptions = mergeAddonOptions(options, defaultOptions)

    return {
      plugins: [
        Components(componentOptions),
      ],
    }
  },
})
