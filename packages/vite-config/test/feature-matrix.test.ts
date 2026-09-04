import type { ConfigEnv, UserConfig, UserConfigExport } from 'vite'
import os from 'node:os'
import path from 'node:path'
import { createAppConfig } from '@moluoxixi/vite-config'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getAddonsConfig } from '../src/config/base/addons'

let mockDeps: Record<string, string> = {}
let mockRuntimeDeps: Record<string, string> = {}

interface CapturedPluginOptions {
  dts?: string
  extensions?: string[]
  imports?: unknown[]
  include?: RegExp[]
  manifest?: unknown
  markdownItSetup?: (md: { use: (...args: unknown[]) => unknown }) => void | Promise<void>
  plugins?: {
    vue?: CapturedPlugin
  }
  registerType?: string
  resolvers?: unknown[]
  wrapperClasses?: string
  [key: string]: unknown
}

interface CapturedPlugin {
  name?: string
  options?: CapturedPluginOptions
}

interface ViteSsgUserConfig extends UserConfig {
  ssgOptions?: {
    onFinished?: () => void | Promise<void>
    script?: string
  }
}

interface PostcssPluginConfig {
  plugins: CapturedPlugin[]
}

const mockEnv: ConfigEnv = { command: 'build', mode: 'production' }

const mocks = vi.hoisted(() => {
  const pluginFactory = (name: string) => vi.fn((options?: CapturedPluginOptions) => ({ name, options }))

  return {
    autoImport: pluginFactory('auto-import'),
    autoprefixer: pluginFactory('autoprefixer'),
    components: pluginFactory('components'),
    devtools: pluginFactory('devtools'),
    i18n: pluginFactory('i18n'),
    linkAttributes: vi.fn((...args: unknown[]) => ({ name: 'link-attributes', args })),
    markdown: pluginFactory('markdown'),
    pwa: vi.fn((options?: CapturedPluginOptions) => ({ name: 'pwa', options })),
    pages: pluginFactory('pages'),
    react: pluginFactory('react'),
    shiki: vi.fn((options?: CapturedPluginOptions) => ({ name: 'shiki', options })),
    sitemap: vi.fn(() => ({ name: 'vite-ssg-sitemap' })),
    tailwindPostcss: pluginFactory('tailwind-postcss'),
    tailwindVite: pluginFactory('tailwind-vite'),
    tailwindcss: pluginFactory('tailwindcss'),
    unocss: pluginFactory('unocss'),
    unheadImports: [{ '@unhead/vue': ['useHead'] }],
    unpluginVueMacros: pluginFactory('vue-macros'),
    vue: pluginFactory('vue'),
    vueLayouts: pluginFactory('vue-layouts'),
    vueRouter: pluginFactory('vue-router'),
    vueRouterAutoImports: [{ 'vue-router/auto': ['useLink'] }],
    vueRouterResolver: vi.fn(() => 'vue-router-resolver'),
    elementPlusResolver: vi.fn(() => 'element-plus-resolver'),
    viteSsgSitemap: vi.fn(() => ({ name: 'vite-ssg-sitemap' })),
  }
})

vi.mock('@moluoxixi/utils/node', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as object),
    detectDependencies: () => ({
      dependencies: {},
      devDependencies: mockDeps,
      deps: {
        ...mockRuntimeDeps,
        ...mockDeps,
      },
      optionalDependencies: {},
      peerDependencies: {},
      addonDeps: {
        ...mockRuntimeDeps,
        ...mockDeps,
      },
      runtimeDeps: mockRuntimeDeps,
    }),
  }
})

vi.mock('../src/config/base/addons/adapters', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/config/base/addons/adapters')>()
  return {
    ...actual,
    createAddonContext(options: Parameters<typeof actual.createAddonContext>[0]) {
      const context = actual.createAddonContext(options)
      return {
        ...context,
        importRequired: (_owner: string, specifier: string) => import(specifier),
      }
    },
  }
})

vi.mock('@vitejs/plugin-vue', () => ({ default: mocks.vue }))
vi.mock('@vitejs/plugin-react', () => ({ default: mocks.react }))
vi.mock('unocss/vite', () => ({ default: mocks.unocss }))
vi.mock('@tailwindcss/vite', () => ({ default: mocks.tailwindVite }))
vi.mock('@tailwindcss/postcss', () => ({ default: mocks.tailwindPostcss }))
vi.mock('tailwindcss', () => ({ default: mocks.tailwindcss }))
vi.mock('autoprefixer', () => ({ default: mocks.autoprefixer }))
vi.mock('unplugin-vue-router', () => ({ VueRouterAutoImports: mocks.vueRouterAutoImports }))
vi.mock('unplugin-vue-router/vite', () => ({ default: mocks.vueRouter }))
vi.mock('unplugin-vue-components/vite', () => ({ default: mocks.components }))
vi.mock('unplugin-vue-components/resolvers', () => ({ ElementPlusResolver: mocks.elementPlusResolver }))
vi.mock('unplugin-auto-import/vite', () => ({ default: mocks.autoImport }))
vi.mock('@unhead/vue', () => ({ unheadVueComposablesImports: mocks.unheadImports }))
vi.mock('@intlify/unplugin-vue-i18n/vite', () => ({ default: mocks.i18n }))
vi.mock('vite-plugin-vue-devtools', () => ({ default: mocks.devtools }))
vi.mock('vite-plugin-pages', () => ({ default: mocks.pages }))
vi.mock('unplugin-vue-markdown/vite', () => ({ default: mocks.markdown }))
vi.mock('@shikijs/markdown-it', () => ({ default: mocks.shiki }))
vi.mock('markdown-it-link-attributes', () => ({ default: mocks.linkAttributes }))
vi.mock('unplugin-vue-macros/vite', () => ({ default: mocks.unpluginVueMacros }))
vi.mock('vite-plugin-vue-layouts', () => ({ default: mocks.vueLayouts }))
vi.mock('vite-plugin-pwa', () => ({ VitePWA: mocks.pwa }))
vi.mock('vite-ssg-sitemap', () => ({ default: mocks.viteSsgSitemap }))

function flattenPlugins(config: UserConfig): CapturedPlugin[] {
  return (Array.isArray(config.plugins) ? config.plugins.flat(10) : []).filter(Boolean) as CapturedPlugin[]
}

async function resolveConfig(config: UserConfigExport): Promise<UserConfig> {
  return typeof config === 'function' ? config(mockEnv) : config
}

beforeEach(() => {
  mockDeps = {}
  mockRuntimeDeps = {}
  Object.values(mocks).forEach((value) => {
    if (typeof value === 'function' && 'mockClear' in value) {
      ;(value as { mockClear: () => void }).mockClear()
    }
  })
})

describe('vite addon matrix', () => {
  it('dedupes caller arrays before appending addon defaults', async () => {
    const root = path.resolve(os.tmpdir(), 'moluoxixi-feature-array-overrides')
    mockRuntimeDeps = {
      '@vitejs/plugin-vue': '^6.0.0',
      'unplugin-vue-components': '^31.0.0',
      'vue': '^3.5.0',
    }

    const config = await getAddonsConfig({
      components: {
        extensions: ['tsx', 'vue'],
        include: [/\.tsx$/],
        resolvers: [],
      },
      viteConfig: { root },
    })
    const componentsPlugin = flattenPlugins(config).find(plugin => plugin.name === 'components')

    expect(componentsPlugin?.options?.extensions).toEqual(['tsx', 'vue'])
    expect(componentsPlugin?.options?.include?.map(String)).toEqual([
      '/\\.tsx$/',
      '/\\.[jt]sx?$/',
      '/\\.vue$/',
      '/\\.vue\\?vue/',
    ])
    expect(componentsPlugin?.options?.resolvers).toEqual([])
  })

  it('applies Vue page route defaults from the scaffold contract', async () => {
    const root = path.resolve(os.tmpdir(), 'moluoxixi-feature-pages-vue')
    mockRuntimeDeps = {
      '@vitejs/plugin-vue': '^6.0.0',
      'vite-plugin-pages': '^0.33.3',
      'vue': '^3.5.0',
    }

    const config = await getAddonsConfig({ viteConfig: { root }, pages: true })
    const pagesPlugin = flattenPlugins(config).find(plugin => plugin.name === 'pages')

    expect(pagesPlugin?.options).toMatchObject({
      dirs: 'src/pages',
      extensions: ['vue'],
      exclude: ['**/components/**', '**/__tests__/**'],
    })
    expect(pagesPlugin?.options?.resolver).toBeUndefined()
  })

  it('applies React page route defaults from the scaffold contract', async () => {
    const root = path.resolve(os.tmpdir(), 'moluoxixi-feature-pages-react')
    mockRuntimeDeps = {
      '@vitejs/plugin-react': '^4.0.0',
      'react': '^19.0.0',
      'vite-plugin-pages': '^0.33.3',
    }

    const config = await getAddonsConfig({ viteConfig: { root }, pages: true })
    const pagesPlugin = flattenPlugins(config).find(plugin => plugin.name === 'pages')

    expect(pagesPlugin?.options).toMatchObject({
      dirs: 'src/pages',
      extensions: ['tsx'],
      resolver: 'react',
      exclude: ['**/components/**', '**/__tests__/**'],
    })
  })

  it('keeps user plugins and removes generated plugins with the same name', async () => {
    const root = path.resolve(os.tmpdir(), 'moluoxixi-feature-plugin-dedupe')
    const keepPlugin = { name: 'keep-user-plugin' }
    const userUnoPlugin = { enforce: 'post' as const, name: 'unocss' }
    mockRuntimeDeps = { unocss: '^66.0.0' }

    const config = await resolveConfig(createAppConfig(({ mode }) => ({
      unocss: true,
      viteConfig: {
        define: { __MODE__: JSON.stringify(mode) },
        plugins: [[Promise.resolve(keepPlugin)], false, Promise.resolve([userUnoPlugin])],
        root,
      },
    })))
    const plugins = flattenPlugins(config)

    expect(config.define?.__MODE__).toBe('"production"')
    expect(plugins.map(plugin => plugin.name)).toEqual(['keep-user-plugin', 'unocss'])
    expect(plugins.find(plugin => plugin.name === 'unocss')).toBe(userUnoPlugin)
  })

  it('uses Vite merge semantics for nested postcss plugin arrays', async () => {
    const root = path.resolve(os.tmpdir(), 'moluoxixi-feature-postcss-overrides')
    const userPostcssPlugin = { name: 'user-postcss', postcssPlugin: 'user-postcss' }
    mockRuntimeDeps = {
      '@tailwindcss/postcss': '^4.0.0',
      'vite': '^7.0.0',
    }

    const config = await resolveConfig(createAppConfig({
      tailwindcss: true,
      viteConfig: {
        css: { postcss: { plugins: [userPostcssPlugin] } },
        root,
      },
    }))

    const postcssPlugins = (config.css?.postcss as PostcssPluginConfig).plugins
    expect(postcssPlugins).toHaveLength(2)
    expect(postcssPlugins[0]).toMatchObject({ name: 'tailwind-postcss' })
    expect(postcssPlugins[1]).toBe(userPostcssPlugin)
  })

  it('resolves the modern feature matrix with optional addons present', async () => {
    const root = path.resolve(os.tmpdir(), 'moluoxixi-feature-matrix')
    mockRuntimeDeps = {
      '@intlify/unplugin-vue-i18n': '^11.0.0',
      '@shikijs/markdown-it': '^3.0.0',
      '@tailwindcss/vite': '^4.0.0',
      '@unhead/vue': '^1.0.0',
      '@vitejs/plugin-react': '^4.0.0',
      '@vitejs/plugin-vue': '^6.0.0',
      '@vueuse/core': '^12.0.0',
      '@vueuse/head': '^1.0.0',
      '@vueuse/math': '^12.0.0',
      'autoprefixer': '^10.0.0',
      'element-plus': '^2.0.0',
      'markdown-it-link-attributes': '^4.0.0',
      'pinia': '^3.0.0',
      'preact': '^10.0.0',
      'quasar': '^2.0.0',
      'react': '^19.0.0',
      'react-router': '^7.0.0',
      'react-router-dom': '^7.0.0',
      'rxjs': '^7.0.0',
      'solid-js': '^1.0.0',
      'svelte': '^5.0.0',
      'tailwindcss': '^4.0.0',
      'unplugin-auto-import': '^21.0.0',
      'unplugin-vue-components': '^31.0.0',
      'unplugin-vue-markdown': '^29.0.0',
      'unplugin-vue-macros': '^2.14.5',
      'unplugin-vue-router': '^0.11.0',
      'vite-plugin-pwa': '^1.3.0',
      'vite-plugin-vue-devtools': '^8.0.0',
      'vite-plugin-vue-layouts': '^0.11.0',
      'vite-ssg': '^28.0.0',
      'vite-ssg-sitemap': '^0.10.0',
      'vitest': '^4.0.0',
      'vue-i18n': '^10.0.0',
      'vue-router': '^4.6.4',
      'vue': '^3.5.0',
      'unocss': '^66.0.0',
    }

    const config = await getAddonsConfig({ viteConfig: { root } })
    const ssgConfig = config as ViteSsgUserConfig
    const plugins = flattenPlugins(config)
    const names = plugins.map(plugin => plugin.name)

    expect(names).toEqual(expect.arrayContaining([
      'vue-macros',
      'react',
      'unocss',
      'tailwind-vite',
      'vue-router',
      'vue-layouts',
      'auto-import',
      'components',
      'i18n',
      'devtools',
      'pwa',
      'markdown',
    ]))

    const vuePlugin = plugins.find(plugin => plugin.name === 'vue-macros')
    expect(vuePlugin?.options?.plugins?.vue?.name).toBe('vue')
    expect(vuePlugin?.options?.plugins?.vue?.options?.include?.map(String)).toEqual(expect.arrayContaining([
      '/\\.vue$/',
      '/\\.md$/',
    ]))

    const routerPlugin = plugins.find(plugin => plugin.name === 'vue-router')
    expect(routerPlugin?.options?.extensions).toEqual(expect.arrayContaining(['.vue', '.md']))
    expect(routerPlugin?.options).toMatchObject({
      dts: path.resolve(root, 'src/typings/route-map.d.ts'),
      root,
      routesFolder: path.resolve(root, 'src/pages'),
    })

    const autoImportPlugin = plugins.find(plugin => plugin.name === 'auto-import')
    expect(autoImportPlugin?.options).toMatchObject({
      dts: path.resolve(root, 'src/typings/auto-imports.d.ts'),
    })
    expect(autoImportPlugin?.options?.imports).toEqual(expect.arrayContaining([
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
      mocks.vueRouterAutoImports,
      mocks.unheadImports,
    ]))
    expect(autoImportPlugin?.options?.resolvers).toEqual(['element-plus-resolver'])

    const componentsPlugin = plugins.find(plugin => plugin.name === 'components')
    expect(componentsPlugin?.options).toMatchObject({
      dts: path.resolve(root, 'src/typings/components.d.ts'),
    })
    expect(componentsPlugin?.options?.extensions).toEqual(expect.arrayContaining(['vue', 'svelte', 'md']))
    expect(componentsPlugin?.options?.resolvers).toEqual(['element-plus-resolver'])

    const markdownPlugin = plugins.find(plugin => plugin.name === 'markdown')
    const md = { use: vi.fn() }
    await markdownPlugin?.options?.markdownItSetup?.(md)
    expect(md.use).toHaveBeenCalledTimes(2)
    expect(md.use.mock.calls[0][0]).toBe(mocks.linkAttributes)
    expect(md.use.mock.calls[1][0]).toMatchObject({ name: 'shiki' })
    expect(markdownPlugin?.options?.wrapperClasses).toBe('prose prose-sm m-auto text-left')

    const noExternal = (
      Array.isArray(config.ssr?.noExternal)
        ? config.ssr.noExternal
        : [config.ssr?.noExternal]
    ) as Array<string | RegExp>
    expect(noExternal.some((entry: string | RegExp) => entry instanceof RegExp && entry.test('vue-i18n')))
      .toBe(true)
    expect(ssgConfig.ssgOptions?.script).toBe('async')
    expect(typeof ssgConfig.ssgOptions?.onFinished).toBe('function')

    await ssgConfig.ssgOptions?.onFinished?.()
    expect(mocks.viteSsgSitemap).toHaveBeenCalledTimes(1)

    const pwaPlugin = plugins.find(plugin => plugin.name === 'pwa')
    expect(pwaPlugin?.options).toMatchObject({ registerType: 'autoUpdate' })
    expect(pwaPlugin?.options?.manifest).toBeUndefined()
  })

  it('keeps vite-ssg usable without sitemap and avoids injecting app-specific pwa manifest defaults', async () => {
    const root = path.resolve(os.tmpdir(), 'moluoxixi-feature-ssg-without-sitemap')
    mockRuntimeDeps = {
      'vite-plugin-pwa': '^1.3.0',
      'vite-ssg': '^28.0.0',
      'vue-i18n': '^10.0.0',
    }

    const config = await getAddonsConfig({ viteConfig: { root } })
    const ssgConfig = config as ViteSsgUserConfig
    const pwaPlugin = flattenPlugins(config).find(plugin => plugin.name === 'pwa')
    const noExternal = (
      Array.isArray(config.ssr?.noExternal)
        ? config.ssr.noExternal
        : [config.ssr?.noExternal]
    ) as Array<string | RegExp>

    expect(ssgConfig.ssgOptions?.script).toBe('async')
    expect(ssgConfig.ssgOptions?.onFinished).toBeUndefined()
    expect(noExternal.some((entry: string | RegExp) => entry instanceof RegExp && entry.test('vue-i18n')))
      .toBe(true)
    expect(pwaPlugin?.options).toMatchObject({ registerType: 'autoUpdate' })
    expect(pwaPlugin?.options?.manifest).toBeUndefined()
  })

  it('uses vue-router fallback auto-imports when the router plugin is absent', async () => {
    const root = path.resolve(os.tmpdir(), 'moluoxixi-feature-fallback')
    mockRuntimeDeps = {
      '@vitejs/plugin-vue': '^6.0.0',
      'unplugin-auto-import': '^21.0.0',
      'vue-router': '^4.6.4',
      'vue': '^3.5.0',
    }

    const config = await getAddonsConfig({ viteConfig: { root } })
    const autoImportPlugin = flattenPlugins(config).find(plugin => plugin.name === 'auto-import')

    expect(autoImportPlugin?.options?.imports).toContain('vue-router')
  })

  it('keeps components resolvers empty when Element Plus is absent', async () => {
    const root = path.resolve(os.tmpdir(), 'moluoxixi-feature-components')
    mockRuntimeDeps = {
      '@vitejs/plugin-vue': '^6.0.0',
      'unplugin-vue-components': '^31.0.0',
      'vue': '^3.5.0',
    }

    const config = await getAddonsConfig({ viteConfig: { root } })
    const componentsPlugin = flattenPlugins(config).find(plugin => plugin.name === 'components')

    expect(componentsPlugin?.options?.extensions).toEqual(['vue'])
    expect(componentsPlugin?.options?.resolvers).toBeUndefined()
  })

  it('allows callers to override markdown wrapper classes', async () => {
    const root = path.resolve(os.tmpdir(), 'moluoxixi-feature-markdown-wrapper')
    mockRuntimeDeps = {
      '@shikijs/markdown-it': '^3.0.0',
      'markdown-it-link-attributes': '^4.0.0',
      'unplugin-vue-markdown': '^29.0.0',
    }

    const config = await getAddonsConfig({
      markdown: {
        wrapperClasses: 'markdown-body',
      },
      viteConfig: { root },
    })
    const markdownPlugin = flattenPlugins(config).find(plugin => plugin.name === 'markdown')

    expect(markdownPlugin?.options?.wrapperClasses).toBe('markdown-body')
  })

  it('switches to the tailwind postcss branch when the vite plugin is missing', async () => {
    const root = path.resolve(os.tmpdir(), 'moluoxixi-feature-tailwind')
    mockRuntimeDeps = {
      '@tailwindcss/postcss': '^4.0.0',
      'vite': '^7.0.0',
    }

    const config = await getAddonsConfig({ viteConfig: { root } })

    const postcss = config.css?.postcss as PostcssPluginConfig
    expect(postcss.plugins).toHaveLength(1)
    expect(postcss.plugins[0]).toMatchObject({ name: 'tailwind-postcss' })
  })

  it('detects UnoCSS config files with cjs and cts extensions', async () => {
    const root = path.resolve(os.tmpdir(), 'moluoxixi-feature-unocss-config')
    mockRuntimeDeps = {
      unocss: '^66.0.0',
    }

    const config = await getAddonsConfig({ viteConfig: { root } })
    const unocssPlugin = flattenPlugins(config).find(plugin => plugin.name === 'unocss')
    expect(unocssPlugin?.options?.configFile).toBe(false)
  })
})
