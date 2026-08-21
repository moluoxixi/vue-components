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

export const docsRepositoryMetadataProviderIds = [
  'gitee',
  'github',
  'gitlab',
  'local',
  'yunxiao',
] as const

export type DocsRepositoryMetadataProviderId = typeof docsRepositoryMetadataProviderIds[number]

export function resolveDocsRepositoryMetadataProvider(
  value: string | undefined,
): DocsRepositoryMetadataProviderId {
  const providerId = value?.trim() || 'github'
  if (!(docsRepositoryMetadataProviderIds as readonly string[]).includes(providerId)) {
    throw new TypeError(
      `Unsupported VITE_DOCS_REPOSITORY_METADATA_PROVIDER: ${providerId}`,
    )
  }
  return providerId as DocsRepositoryMetadataProviderId
}

function readRepositoryMetadataProviderEnvironment(): string | undefined {
  const viteEnvironment = import.meta.env?.VITE_DOCS_REPOSITORY_METADATA_PROVIDER
  if (viteEnvironment !== undefined)
    return viteEnvironment

  const nodeProcess = Reflect.get(globalThis, 'process') as
    | { env?: Record<string, string | undefined> }
    | undefined
  return nodeProcess?.env?.VITE_DOCS_REPOSITORY_METADATA_PROVIDER
}

const issueTitlePrefix = (componentName: string) => `[${componentName}]`
const githubRepository = {
  owner: 'moluoxixi',
  name: 'vue-components',
  defaultBranch: 'main',
  url: 'https://github.com/moluoxixi/vue-components',
  issueTitlePrefix,
}
const gitlabProjectPath = 'moluoxixi/vue-components-provider-fixture'
const gitlabWebBaseUrl = 'https://jihulab.com'
const gitlabRepository = {
  apiBaseUrl: `${gitlabWebBaseUrl}/api/v4`,
  authentication: 'private-token' as const,
  contributorProfiles: {
    'gitlab:c5bd8c158c76d1ee0e04dfc5460fa34092caf55172fe6154706c94ce08ddc31b': 'moluoxixi',
  },
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
  name: 'vue-components-provider-fixture',
  owner: 'moluoxixi',
  url: 'https://gitee.com/moluoxixi/vue-components-provider-fixture',
  userAgent: 'moluoxixi-docs-gitee-metadata-sync',
  webBaseUrl: 'https://gitee.com',
}
const yunxiaoRepository = {
  apiBaseUrl: 'https://openapi-rdc.aliyuncs.com',
  apiMode: 'central' as const,
  contributorProfiles: {
    'yunxiao:c5bd8c158c76d1ee0e04dfc5460fa34092caf55172fe6154706c94ce08ddc31b': {
      avatarUrl: 'https://tcs-devops.aliyuncs.com/thumbnail/113xe4725d597a98a28aeb536f60ee47c986/w/200/h/200',
      login: 'aliyun1879222502',
    },
    'yunxiao:d5b8d2b82909bab605c5eb4e0761ac30e81a9da6d907c4fa4c44b38d54546036': {
      avatarUrl: 'https://tcs-devops.aliyuncs.com/thumbnail/113xe4725d597a98a28aeb536f60ee47c986/w/200/h/200',
      login: 'aliyun1879222502',
    },
  },
  defaultBranch: 'master',
  organizationId: '64bac376132d10ed34af0a23',
  repositoryId: '7356176',
  repositoryPath: '64bac376132d10ed34af0a23/vue-components-provider-fixture',
  url: 'https://codeup.aliyun.com/64bac376132d10ed34af0a23/vue-components-provider-fixture',
  userAgent: 'moluoxixi-docs-yunxiao-metadata-sync',
}

const metadataProvider = resolveDocsRepositoryMetadataProvider(
  readRepositoryMetadataProviderEnvironment(),
)
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
