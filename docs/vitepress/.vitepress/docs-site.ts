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

export type DocsRepositoryMetadataProviderId = 'gitee' | 'github' | 'gitlab' | 'local' | 'yunxiao'

const issueTitlePrefix = (componentName: string) => `[${componentName}]`
const githubRepository = {
  owner: 'moluoxixi',
  name: 'vue-components',
  defaultBranch: 'main',
  url: 'https://github.com/moluoxixi/vue-components',
  issueTitlePrefix,
}
const gitlabProjectPath = 'gitlab-org/cli'
const gitlabWebBaseUrl = 'https://gitlab.com'
const gitlabRepository = {
  apiBaseUrl: 'https://gitlab.com/api/v4',
  defaultBranch: 'main',
  issueTitlePrefix,
  projectPath: gitlabProjectPath,
  url: `${gitlabWebBaseUrl}/${gitlabProjectPath}`,
  userAgent: 'moluoxixi-docs-gitlab-metadata-sync',
  webBaseUrl: gitlabWebBaseUrl,
}
const giteeRepository = {
  apiBaseUrl: 'https://gitee.com/api/v5',
  defaultBranch: 'main',
  issueTitlePrefix,
  name: 'vue',
  owner: 'mirrors',
  url: 'https://gitee.com/mirrors/vue',
  userAgent: 'moluoxixi-docs-gitee-metadata-sync',
  webBaseUrl: 'https://gitee.com',
}
const yunxiaoRepository = {
  apiBaseUrl: 'https://openapi-rdc.aliyuncs.com',
  apiMode: 'central' as const,
  defaultBranch: 'main',
  organizationId: 'configure-yunxiao-organization-id',
  repositoryId: 'configure-yunxiao-repository-id',
  repositoryPath: 'configure-yunxiao/repository',
  url: 'https://codeup.aliyun.com/configure-yunxiao/repository',
  userAgent: 'moluoxixi-docs-yunxiao-metadata-sync',
}

const metadataProvider: DocsRepositoryMetadataProviderId = 'github'
const repositories = {
  gitee: giteeRepository,
  github: githubRepository,
  gitlab: gitlabRepository,
  local: githubRepository,
  yunxiao: yunxiaoRepository,
}

export const docsSite = {
  title: 'MoluoXixi Components',
  siteTitle: 'MX Components',
  logo: {
    src: '/logo.svg',
    alt: 'MX Components',
  },
  packageName: '@moluoxixi/components',
  richTextEditorPackageName: '@moluoxixi/rich-text-editor',
  componentEntry: 'packages/components/index.ts',
  apiComponentEntries: [
    'packages/components/index.ts',
    'packages/rich-text-editor/index.ts',
  ],
  packageStylesImport: '@moluoxixi/components/styles',
  metadataProvider,
  repositories,
  repository: repositories[metadataProvider],
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

/** Returns the package path containing a component's authoring documentation. */
export function componentDocsSourcePath(componentName: string): string {
  if (componentName === 'RichTextEditor')
    return 'packages/rich-text-editor'
  return componentSourcePath(componentName)
}
