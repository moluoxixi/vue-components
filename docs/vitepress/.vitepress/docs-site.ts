export const docsLocales = {
  'zh-CN': {
    siteKey: 'root',
    label: '简体中文',
    lang: 'zh-CN',
    pathPrefix: '',
    sourceDirectory: '',
    sourceDoc: 'docs/index.md',
    sourceDocIncludePrefix: '../../../',
  },
  'en-US': {
    siteKey: 'en',
    label: 'English',
    lang: 'en-US',
    pathPrefix: '/en',
    sourceDirectory: 'en/',
    sourceDoc: 'docs/index.en.md',
    sourceDocIncludePrefix: '../../../../',
  },
} as const

export type DocsLocale = keyof typeof docsLocales

export const defaultDocsLocale: DocsLocale = 'zh-CN'

export const docsSite = {
  title: 'MoluoXixi Components',
  siteTitle: 'MX Components',
  logo: {
    src: '/logo.svg',
    alt: 'MX Components',
  },
  packageName: '@moluoxixi/components',
  componentEntry: 'packages/components/index.ts',
  apiComponentEntries: [
    'packages/components/index.ts',
    'packages/rich-text-editor/index.ts',
  ],
  packageStylesImport: '@moluoxixi/components/styles',
  repository: {
    owner: 'moluoxixi',
    name: 'vue-components',
    defaultBranch: 'main',
    url: 'https://github.com/moluoxixi/vue-components',
  },
  source: {
    componentRoot: 'packages/components/src',
  },
  routes: {
    components: '/components/',
    guide: '/guide/',
    playground: '/playground',
    utilities: '/utils/',
  },
  github: {
    issueTitlePrefix: (componentName: string) => `[${componentName}]`,
    excludeBotsFromContributors: true,
    userAgent: 'moluoxixi-docs-metadata-sync',
  },
} as const

export type DocsRouteName = keyof typeof docsSite.routes

export function getDocsLocaleConfig(locale: DocsLocale) {
  return docsLocales[locale]
}

export function docsRoutePath(route: DocsRouteName, suffix = ''): string {
  return `${docsSite.routes[route]}${suffix.replace(/^\/+/, '')}`
}

export function localePath(locale: DocsLocale, path: string): string {
  return `${getDocsLocaleConfig(locale).pathPrefix}${path}`
}

export function componentSourcePath(componentName: string): string {
  return `${docsSite.source.componentRoot}/${componentName}`
}
