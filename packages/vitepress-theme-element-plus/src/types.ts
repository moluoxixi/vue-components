import type { DefaultTheme, Theme, UserConfig } from 'vitepress'

export type DocsLocale = string

export interface DocsComponent {
  name: string
  slug?: string
  title?: string
  group?: string
  description?: string
}

export interface ElementPlusDocsLocaleConfig {
  label: string
  lang?: string
  pathPrefix?: string
  siteKey?: string
  description?: string
  themeConfig?: DefaultTheme.Config
}

export interface ElementPlusDocsRuntimeLocale {
  label: string
  lang: string
  pathPrefix: string
  siteKey: string
}

export interface ElementPlusDocsOptions {
  site: {
    title: string
    siteTitle?: string
    description?: string
    logo?: string
    base?: string
    locales?: Record<DocsLocale, ElementPlusDocsLocaleConfig>
    defaultLocale?: DocsLocale
  }
  repository?: {
    url: string
    owner?: string
    name?: string
    defaultBranch?: string
    editLinks?: boolean
  }
  components?: {
    styles?: string | string[]
    catalog?: DocsComponent[]
  }
  routes?: {
    guide?: string
    overview?: string
    components?: string
  }
  search?: UserConfig['themeConfig'] extends infer _ ? 'local' | { provider: 'algolia', options: Record<string, unknown> } : never
  vitepress?: Pick<UserConfig, 'head' | 'markdown' | 'rewrites' | 'themeConfig' | 'vite'>
}

export interface ElementPlusDocsThemeConfig {
  logo: string
  siteTitle: string
  version: string
  repository: string
  langs: DocsLocale[]
  locales: Record<DocsLocale, ElementPlusDocsRuntimeLocale>
  defaultLocale: DocsLocale
  search: DefaultTheme.Config['search']
  components: DocsComponent[]
  [key: string]: unknown
}

export interface ElementPlusDocsTheme extends Theme {
  Layout: NonNullable<Theme['Layout']>
}
