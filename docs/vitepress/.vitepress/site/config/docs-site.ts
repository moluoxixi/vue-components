import type { ElementPlusDocsRepositoryProviderId } from '@moluoxixi/vitepress-theme-element-plus'
import {
  resolveElementPlusDocsProject,
  resolveElementPlusDocsProjectRepository,
  resolveElementPlusDocsRepositoryProvider,
} from '@moluoxixi/vitepress-theme-element-plus'
import projectConfig from '../../../element-plus-docs.config.ts'

export const docsLocales = projectConfig.documentation.locales

export type DocsLocale = keyof typeof docsLocales

export const defaultDocsLocale = projectConfig.documentation.defaultLocale as DocsLocale

export type DocsRepositoryMetadataProviderId = ElementPlusDocsRepositoryProviderId

export function resolveDocsRepositoryMetadataProvider(
  value: string | undefined,
): DocsRepositoryMetadataProviderId {
  return resolveElementPlusDocsRepositoryProvider(value, projectConfig.repository.provider)
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

const metadataProvider = resolveDocsRepositoryMetadataProvider(
  readRepositoryMetadataProviderEnvironment(),
)
const project = resolveElementPlusDocsProject(projectConfig)
const repository = resolveElementPlusDocsProjectRepository(project, metadataProvider)
const componentPackage = project.packages[project.defaultPackage]!

export const docsSite = {
  title: 'MoluoXixi Components',
  siteTitle: 'MX Components',
  logo: {
    src: '/logo.svg',
    alt: 'MX Components',
  },
  packageName: componentPackage.name,
  packageStylesImport: componentPackage.styles[0] ?? '',
  metadataProvider,
  repository,
  routes: {
    components: `/${project.documentation.componentsRoute}/`,
    guide: '/guide/',
    playground: '/playground',
    utilities: '/utils/',
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
