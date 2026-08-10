import type { ConfigEnv, LibraryOptions, UserConfig } from 'vite'
import type {
  AutoImportAddonOptions,
  ComponentsAddonOptions,
  DevtoolsAddonOptions,
  I18nAddonOptions,
  MarkdownAddonOptions,
  PwaAddonOptions,
  ReactAddonOptions,
  TailwindCssAddonOptions,
  UnoCssAddonOptions,
  ViteSsgAddonOptions,
  VitestAddonOptions,
  VueAddonOptions,
  VueLayoutsAddonOptions,
  VueRouterAddonOptions,
} from './addons'

/**
 * All supported addon identifiers (camelCase, matches ViteConfigOptions keys)
 */
export type AddonName
  = | 'vue'
    | 'react'
    | 'unocss'
    | 'tailwindcss'
    | 'vueRouter'
    | 'vueLayouts'
    | 'autoImport'
    | 'components'
    | 'i18n'
    | 'devtools'
    | 'pwa'
    | 'markdown'
    | 'vitest'
    | 'viteSsg'

type AddonConfig<TOptions> = TOptions | boolean

/**
 * Addon 配置映射。
 * 对象使用对应 addon 的真实配置类型，`true` 表示显式启用，`false` 表示显式关闭。
 */
export interface ViteConfigOptions {
  /** Library mode entry used by createLibConfig; relative paths resolve from viteConfig.root. */
  entry?: LibraryOptions['entry']
  viteConfig?: UserConfig
  vue?: AddonConfig<VueAddonOptions>
  react?: AddonConfig<ReactAddonOptions>
  unocss?: AddonConfig<UnoCssAddonOptions>
  /** Tailwind CSS 只自动接入官方 Vite/PostCSS 集成包，不把裸 tailwindcss 包当作插件入口。 */
  tailwindcss?: AddonConfig<TailwindCssAddonOptions>
  vueRouter?: AddonConfig<VueRouterAddonOptions>
  /** Layouts 插件保持 optional peer，不在本仓库绑定其过期 Vite peer 范围。 */
  vueLayouts?: AddonConfig<VueLayoutsAddonOptions>
  autoImport?: AddonConfig<AutoImportAddonOptions>
  components?: AddonConfig<ComponentsAddonOptions>
  i18n?: AddonConfig<I18nAddonOptions>
  devtools?: AddonConfig<DevtoolsAddonOptions>
  /** PWA 运行时仍由调用方项目安装；本包 devDependency 只服务源码类型检查和声明文件构建。 */
  pwa?: AddonConfig<PwaAddonOptions>
  markdown?: AddonConfig<MarkdownAddonOptions>
  vitest?: AddonConfig<VitestAddonOptions>
  viteSsg?: AddonConfig<ViteSsgAddonOptions>
}

/**
 * 与 defineConfig 对齐的配置导出类型
 * - 对象形式：直接传入 ViteConfigOptions
 * - 函数形式：接收 Vite 的 ConfigEnv，返回 ViteConfigOptions
 */
export type ViteConfigExport
  = | ViteConfigOptions
    | ((env: ConfigEnv) => ViteConfigOptions | Promise<ViteConfigOptions>)
