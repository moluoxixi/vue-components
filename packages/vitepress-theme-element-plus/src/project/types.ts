export const elementPlusDocsRepositoryProviderIds = [
  'github',
  'gitlab',
  'gitee',
  'yunxiao',
  'local',
] as const

export type ElementPlusDocsRepositoryProviderId = typeof elementPlusDocsRepositoryProviderIds[number]

export interface ElementPlusDocsPlaygroundManifestEntry {
  dependencies: Readonly<Record<string, string>>
  exports: readonly string[]
  styleImports: readonly string[]
}

export interface ElementPlusDocsPlaygroundManifest {
  imports: Readonly<Record<string, ElementPlusDocsPlaygroundManifestEntry>>
  packageName: string
}

export interface ElementPlusDocsDocumentationLocaleInput {
  label: string
  lang?: string
  pathPrefix?: string
  siteKey?: string
  sourceDirectory: string
  sourceDoc: string
}

export interface ElementPlusDocsDocumentationLocale extends ElementPlusDocsDocumentationLocaleInput {
  lang: string
  pathPrefix: string
  siteKey: string
  sourceDirectory: string
}

export interface ElementPlusDocsDocumentationInput {
  componentsRoute: string
  defaultLocale: string
  locales: Readonly<Record<string, ElementPlusDocsDocumentationLocaleInput>>
}

export interface ElementPlusDocsDocumentation extends Omit<ElementPlusDocsDocumentationInput, 'locales'> {
  componentsRoute: string
  locales: Readonly<Record<string, ElementPlusDocsDocumentationLocale>>
}

export interface ElementPlusDocsComponentPackageInput {
  apiEntry?: string
  componentSource: (componentName: string) => string
  docsSource?: (componentName: string) => string
  load: () => Promise<unknown>
  name: string
  loadPlaygroundManifest?: () => Promise<ElementPlusDocsPlaygroundManifest | { default: ElementPlusDocsPlaygroundManifest }>
  repositorySource?: (componentName: string) => string
  root: string
  styles?: readonly string[]
}

export interface ElementPlusDocsComponentPackage extends ElementPlusDocsComponentPackageInput {
  apiEntry: string
  styles: readonly string[]
}

export interface ElementPlusDocsProjectComponentInput {
  apiEntry?: string
  description: string
  docsSourcePath?: string
  icon: string
  name: string
  package?: string
  repositorySourcePath?: string
  searchAliases?: readonly string[]
  sidebarText: string
  slug?: string
}

export interface ElementPlusDocsProjectComponent extends Omit<ElementPlusDocsProjectComponentInput, 'package'> {
  apiEntry: string
  docsSourcePath: string
  packageId: string
  packageName: string
  repositorySourcePath: string
  slug: string
}

export interface ElementPlusDocsProjectComponentGroupInput {
  description: string
  id: string
  items: readonly ElementPlusDocsProjectComponentInput[]
  title: string
}

export interface ElementPlusDocsProjectComponentGroup extends Omit<ElementPlusDocsProjectComponentGroupInput, 'items'> {
  items: readonly ElementPlusDocsProjectComponent[]
}

export interface ElementPlusDocsPrepareCommand {
  args?: readonly string[]
  command: string
  cwd?: string
  name: string
}

interface ElementPlusDocsRepositoryBaseInput {
  defaultBranch?: string
  issueTitlePrefix?: (componentName: string) => string
  url?: string
  userAgent?: string
}

export interface ElementPlusDocsGithubRepositoryInput extends ElementPlusDocsRepositoryBaseInput {
  excludeBotsFromContributors?: boolean
  owner?: string
  provider: 'github'
  repository?: string
}

export interface ElementPlusDocsGiteeRepositoryInput extends ElementPlusDocsRepositoryBaseInput {
  apiBaseUrl?: string
  owner?: string
  provider: 'gitee'
  repository?: string
  webBaseUrl?: string
}

export interface ElementPlusDocsGitlabRepositoryInput extends ElementPlusDocsRepositoryBaseInput {
  apiBaseUrl?: string
  authentication?: 'bearer' | 'private-token'
  contributorProfiles?: Readonly<Record<string, string>>
  projectPath?: string
  provider: 'gitlab'
  webBaseUrl?: string
}

export interface ElementPlusDocsYunxiaoRepositoryInput extends ElementPlusDocsRepositoryBaseInput {
  apiBaseUrl?: string
  apiMode?: 'central' | 'region'
  contributorAccounts?: Readonly<Record<string, string>>
  organizationId?: string
  provider: 'yunxiao'
  repositoryId: string
  repositoryPath?: string
}

export interface ElementPlusDocsLocalRepositoryInput extends ElementPlusDocsRepositoryBaseInput {
  provider: 'local'
  repositoryRoot?: string
}

export type ElementPlusDocsRepositoryInput
  = | ElementPlusDocsGiteeRepositoryInput
    | ElementPlusDocsGithubRepositoryInput
    | ElementPlusDocsGitlabRepositoryInput
    | ElementPlusDocsLocalRepositoryInput
    | ElementPlusDocsYunxiaoRepositoryInput

export interface ElementPlusDocsResolvedRepositoryBase {
  defaultBranch?: string
  issueTitlePrefix: (componentName: string) => string
  provider: ElementPlusDocsRepositoryProviderId
  url?: string
  userAgent: string
}

export interface ElementPlusDocsResolvedGithubRepository extends ElementPlusDocsResolvedRepositoryBase {
  excludeBotsFromContributors: boolean
  owner: string
  provider: 'github'
  repository: string
  url: string
}

export interface ElementPlusDocsResolvedGiteeRepository extends ElementPlusDocsResolvedRepositoryBase {
  apiBaseUrl: string
  owner: string
  provider: 'gitee'
  repository: string
  url: string
  webBaseUrl: string
}

export interface ElementPlusDocsResolvedGitlabRepository extends ElementPlusDocsResolvedRepositoryBase {
  apiBaseUrl: string
  authentication: 'bearer' | 'private-token'
  contributorProfiles: Readonly<Record<string, string>>
  projectPath: string
  provider: 'gitlab'
  url: string
  webBaseUrl: string
}

export interface ElementPlusDocsResolvedYunxiaoRepository extends ElementPlusDocsResolvedRepositoryBase {
  apiBaseUrl: string
  apiMode: 'central' | 'region'
  contributorAccounts: Readonly<Record<string, string>>
  organizationId: string
  provider: 'yunxiao'
  repositoryId: string
  repositoryPath: string
  url: string
}

export interface ElementPlusDocsResolvedLocalRepository extends ElementPlusDocsResolvedRepositoryBase {
  provider: 'local'
  repositoryRoot?: string
}

export type ElementPlusDocsResolvedRepository
  = | ElementPlusDocsResolvedGiteeRepository
    | ElementPlusDocsResolvedGithubRepository
    | ElementPlusDocsResolvedGitlabRepository
    | ElementPlusDocsResolvedLocalRepository
    | ElementPlusDocsResolvedYunxiaoRepository

export interface ElementPlusDocsProjectInput {
  components: readonly ElementPlusDocsProjectComponentGroupInput[]
  defaultPackage?: string
  documentation: ElementPlusDocsDocumentationInput
  generatedDirectory?: string
  packages: Readonly<Record<string, ElementPlusDocsComponentPackageInput>>
  prepare?: {
    commands?: readonly ElementPlusDocsPrepareCommand[]
  }
  repository: ElementPlusDocsRepositoryInput
  repositoryProviders?: Partial<Record<ElementPlusDocsRepositoryProviderId, ElementPlusDocsRepositoryInput>>
  rootDirectory?: string
}

export interface ElementPlusDocsProject extends Omit<ElementPlusDocsProjectInput, 'components' | 'documentation' | 'packages'> {
  components: readonly ElementPlusDocsProjectComponentGroup[]
  defaultPackage: string
  documentation: ElementPlusDocsDocumentation
  packages: Readonly<Record<string, ElementPlusDocsComponentPackage>>
}
