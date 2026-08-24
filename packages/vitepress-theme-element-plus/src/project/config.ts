import type {
  ElementPlusDocsComponentPackage,
  ElementPlusDocsComponentPackageInput,
  ElementPlusDocsDocumentation,
  ElementPlusDocsDocumentationInput,
  ElementPlusDocsPlaygroundManifest,
  ElementPlusDocsProject,
  ElementPlusDocsProjectComponent,
  ElementPlusDocsProjectComponentInput,
  ElementPlusDocsProjectInput,
  ElementPlusDocsRepositoryInput,
  ElementPlusDocsRepositoryProviderId,
  ElementPlusDocsResolvedRepository,
} from './types'
import { resolveGitlabWebBaseUrl } from '../content/repository/providers/gitlab'
import { elementPlusDocsRepositoryProviderIds } from './types'

const SAFE_PATH_SEGMENT = /^[\w.@-]+$/

function normalizeOptionalDirectory(value: string, field: string): string {
  const normalized = value.trim().replaceAll('\\', '/').replace(/^\.\//, '').replace(/^\/+|\/+$/g, '')
  if (normalized.split('/').includes('..'))
    throw new TypeError(`${field} must be a documentation-relative directory`)
  return normalized
}

function normalizePathPrefix(value: string | undefined, sourceDirectory: string): string {
  const normalized = (value ?? (sourceDirectory ? `/${sourceDirectory}` : ''))
    .trim()
    .replace(/^\/+|\/+$/g, '')
  return normalized ? `/${normalized}` : ''
}

function normalizeDocumentation(input: ElementPlusDocsDocumentationInput): ElementPlusDocsDocumentation {
  const localeEntries = Object.entries(input.locales)
  if (localeEntries.length === 0)
    throw new TypeError('Element Plus docs project requires at least one documentation locale')
  if (!input.locales[input.defaultLocale])
    throw new TypeError(`Unknown default documentation locale: ${input.defaultLocale}`)
  const componentsRoute = normalizeRelativePath(input.componentsRoute, 'documentation.componentsRoute')
  const locales = Object.freeze(Object.fromEntries(localeEntries.map(([locale, configured]) => {
    if (!configured.label.trim())
      throw new TypeError(`Documentation locale "${locale}" requires a label`)
    const sourceDirectory = normalizeOptionalDirectory(
      configured.sourceDirectory,
      `documentation.locales.${locale}.sourceDirectory`,
    )
    return [locale, Object.freeze({
      ...configured,
      label: configured.label.trim(),
      lang: configured.lang?.trim() || locale,
      pathPrefix: normalizePathPrefix(configured.pathPrefix, sourceDirectory),
      siteKey: configured.siteKey?.trim() || (locale === input.defaultLocale ? 'root' : sourceDirectory || locale),
      sourceDirectory,
      sourceDoc: normalizeRelativePath(configured.sourceDoc, `documentation.locales.${locale}.sourceDoc`),
    })]
  })))
  const siteKeys = Object.values(locales).map(locale => locale.siteKey)
  const pathPrefixes = Object.values(locales).map(locale => locale.pathPrefix)
  const sourceDirectories = Object.values(locales).map(locale => locale.sourceDirectory)
  if (new Set(siteKeys).size !== siteKeys.length)
    throw new TypeError('Documentation locale siteKey values must be unique')
  if (new Set(pathPrefixes).size !== pathPrefixes.length)
    throw new TypeError('Documentation locale pathPrefix values must be unique')
  if (new Set(sourceDirectories).size !== sourceDirectories.length)
    throw new TypeError('Documentation locale sourceDirectory values must be unique')
  return Object.freeze({ componentsRoute, defaultLocale: input.defaultLocale, locales })
}

export function resolveElementPlusDocsPlaygroundManifest(
  packageName: string,
  loaded: unknown,
): ElementPlusDocsPlaygroundManifest {
  const candidate = loaded && typeof loaded === 'object' && 'default' in loaded
    ? (loaded as { default: unknown }).default
    : loaded
  if (!candidate || typeof candidate !== 'object')
    throw new TypeError(`Playground manifest for ${packageName} must be an object`)
  const manifest = candidate as ElementPlusDocsPlaygroundManifest
  if (manifest.packageName !== packageName)
    throw new TypeError(`Playground manifest package mismatch: expected ${packageName}`)
  if (!manifest.imports || typeof manifest.imports !== 'object')
    throw new TypeError(`Playground manifest for ${packageName} requires imports`)
  const imports = Object.freeze(Object.fromEntries(Object.entries(manifest.imports).map(([specifier, entry]) => {
    if (packageNameFromSpecifier(specifier) !== packageName)
      throw new TypeError(`Playground manifest entry "${specifier}" is outside package ${packageName}`)
    if (!entry.exports.every(name => typeof name === 'string' && name))
      throw new TypeError(`Playground manifest entry "${specifier}" has invalid exports`)
    if (!entry.styleImports.every(style => typeof style === 'string' && style))
      throw new TypeError(`Playground manifest entry "${specifier}" has invalid style imports`)
    if (!Object.entries(entry.dependencies).every(([name, version]) => Boolean(name) && Boolean(version)))
      throw new TypeError(`Playground manifest entry "${specifier}" has invalid dependencies`)
    return [specifier, Object.freeze({
      dependencies: Object.freeze({ ...entry.dependencies }),
      exports: Object.freeze([...entry.exports]),
      styleImports: Object.freeze([...entry.styleImports]),
    })]
  })))
  return Object.freeze({ imports, packageName: manifest.packageName })
}

function packageNameFromSpecifier(specifier: string): string {
  const segments = specifier.split('/')
  return specifier.startsWith('@') ? segments.slice(0, 2).join('/') : segments[0]!
}

function normalizeRelativePath(value: string, field: string): string {
  const normalized = value.trim().replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/+$/, '')
  if (!normalized || normalized.startsWith('/') || normalized.split('/').includes('..'))
    throw new TypeError(`${field} must be a repository-relative path`)
  return normalized
}

function kebabCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .replaceAll('_', '-')
    .toLowerCase()
}

function assertComponentName(value: string): void {
  if (!/^[A-Z][A-Za-z0-9]*$/.test(value))
    throw new TypeError(`Invalid documented component name: ${value}`)
}

function normalizePackage(
  id: string,
  input: ElementPlusDocsComponentPackageInput,
): ElementPlusDocsComponentPackage {
  if (!SAFE_PATH_SEGMENT.test(id))
    throw new TypeError(`Invalid component package profile ID: ${id}`)
  if (!input.name.trim())
    throw new TypeError(`Component package profile "${id}" requires a package name`)
  const root = normalizeRelativePath(input.root, `packages.${id}.root`)
  return Object.freeze({
    ...input,
    apiEntry: normalizeRelativePath(input.apiEntry ?? `${root}/index.ts`, `packages.${id}.apiEntry`),
    root,
    styles: Object.freeze([...(input.styles ?? [])]),
  })
}

function normalizeComponent(
  input: ElementPlusDocsProjectComponentInput,
  packageId: string,
  profile: ElementPlusDocsComponentPackage,
): ElementPlusDocsProjectComponent {
  assertComponentName(input.name)
  const sourcePath = normalizeRelativePath(
    profile.componentSource(input.name),
    `components.${input.name}.sourcePath`,
  )
  return Object.freeze({
    ...input,
    apiEntry: normalizeRelativePath(input.apiEntry ?? profile.apiEntry, `components.${input.name}.apiEntry`),
    docsSourcePath: normalizeRelativePath(
      input.docsSourcePath ?? profile.docsSource?.(input.name) ?? sourcePath,
      `components.${input.name}.docsSourcePath`,
    ),
    packageId,
    packageName: profile.name,
    repositorySourcePath: normalizeRelativePath(
      input.repositorySourcePath ?? profile.repositorySource?.(input.name) ?? sourcePath,
      `components.${input.name}.repositorySourcePath`,
    ),
    slug: input.slug ?? kebabCase(input.name),
  })
}

export function defineComponentPackage<const T extends ElementPlusDocsComponentPackageInput>(
  input: T,
): T {
  return input
}

export function defineElementPlusDocsProject<const T extends ElementPlusDocsProjectInput>(
  input: T,
): T {
  return input
}

export function resolveElementPlusDocsProject(input: ElementPlusDocsProjectInput): ElementPlusDocsProject {
  const packageEntries = Object.entries(input.packages)
  if (packageEntries.length === 0)
    throw new TypeError('Element Plus docs project requires at least one component package profile')
  const packages = Object.freeze(Object.fromEntries(
    packageEntries.map(([id, profile]) => [id, normalizePackage(id, profile)]),
  ))
  const defaultPackage = input.defaultPackage ?? (packages.components ? 'components' : packageEntries[0]![0])
  if (!packages[defaultPackage])
    throw new TypeError(`Unknown default component package profile: ${defaultPackage}`)

  const componentNames = new Set<string>()
  const componentSlugs = new Set<string>()
  const components = input.components.map(group => Object.freeze({
    ...group,
    items: Object.freeze(group.items.map((component) => {
      const packageId = component.package ?? defaultPackage
      const profile = packages[packageId]
      if (!profile)
        throw new TypeError(`Unknown component package profile "${packageId}" for ${component.name}`)
      const normalized = normalizeComponent(component, packageId, profile)
      if (componentNames.has(normalized.name))
        throw new TypeError(`Duplicate documented component name: ${normalized.name}`)
      if (componentSlugs.has(normalized.slug))
        throw new TypeError(`Duplicate documented component slug: ${normalized.slug}`)
      componentNames.add(normalized.name)
      componentSlugs.add(normalized.slug)
      return normalized
    })),
  }))

  return Object.freeze({
    ...input,
    components: Object.freeze(components),
    defaultPackage,
    documentation: normalizeDocumentation(input.documentation),
    generatedDirectory: input.generatedDirectory ?? '.generated',
    packages,
  })
}

export function resolveElementPlusDocsRepositoryProvider(
  value: string | undefined,
  fallback: ElementPlusDocsRepositoryProviderId,
): ElementPlusDocsRepositoryProviderId {
  const providerId = value?.trim() || fallback
  if (!(elementPlusDocsRepositoryProviderIds as readonly string[]).includes(providerId))
    throw new TypeError(`Unsupported repository metadata provider: ${providerId}`)
  return providerId as ElementPlusDocsRepositoryProviderId
}

function requireRepositoryUrl(input: ElementPlusDocsRepositoryInput): URL {
  if (!input.url)
    throw new TypeError(`Repository provider "${input.provider}" requires a repository URL`)
  const url = new URL(input.url)
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash)
    throw new TypeError(`Repository provider "${input.provider}" requires a public HTTPS repository URL`)
  url.pathname = url.pathname.replace(/\.git\/?$/, '').replace(/\/+$/, '')
  return url
}

function repositoryCoordinates(url: URL, provider: 'gitee' | 'github'): [string, string] {
  const expectedHost = provider === 'github' ? 'github.com' : 'gitee.com'
  const parts = url.pathname.split('/').filter(Boolean)
  if (url.hostname !== expectedHost || parts.length !== 2)
    throw new TypeError(`${provider} repository URL must use https://${expectedHost}/<owner>/<repository>`)
  return [decodeURIComponent(parts[0]!), decodeURIComponent(parts[1]!)]
}

function defaultIssueTitlePrefix(componentName: string): string {
  return `[${componentName}]`
}

function commonRepository(input: ElementPlusDocsRepositoryInput) {
  return {
    defaultBranch: input.defaultBranch?.trim() || undefined,
    issueTitlePrefix: input.issueTitlePrefix ?? defaultIssueTitlePrefix,
    userAgent: input.userAgent?.trim() || 'element-plus-docs-metadata-sync',
  }
}

export function resolveElementPlusDocsRepository(
  input: ElementPlusDocsRepositoryInput,
): ElementPlusDocsResolvedRepository {
  const common = commonRepository(input)
  if (input.provider === 'local') {
    return Object.freeze({
      ...common,
      provider: 'local',
      repositoryRoot: input.repositoryRoot,
      url: input.url,
    })
  }

  const url = requireRepositoryUrl(input)
  const repositoryUrl = url.toString().replace(/\/$/, '')
  if (input.provider === 'github') {
    const [derivedOwner, derivedRepository] = repositoryCoordinates(url, 'github')
    return Object.freeze({
      ...common,
      excludeBotsFromContributors: input.excludeBotsFromContributors ?? true,
      owner: input.owner ?? derivedOwner,
      provider: 'github',
      repository: input.repository ?? derivedRepository,
      url: repositoryUrl,
    })
  }
  if (input.provider === 'gitee') {
    const [derivedOwner, derivedRepository] = repositoryCoordinates(url, 'gitee')
    const webBaseUrl = input.webBaseUrl?.replace(/\/+$/, '') ?? url.origin
    return Object.freeze({
      ...common,
      apiBaseUrl: input.apiBaseUrl?.replace(/\/+$/, '') ?? `${webBaseUrl}/api/v5`,
      owner: input.owner ?? derivedOwner,
      provider: 'gitee',
      repository: input.repository ?? derivedRepository,
      url: repositoryUrl,
      webBaseUrl,
    })
  }
  if (input.provider === 'gitlab') {
    const projectPath = input.projectPath ?? url.pathname.split('/').filter(Boolean).map(decodeURIComponent).join('/')
    const webBaseUrl = input.webBaseUrl?.replace(/\/+$/, '')
      ?? resolveGitlabWebBaseUrl(repositoryUrl, projectPath)
    return Object.freeze({
      ...common,
      apiBaseUrl: input.apiBaseUrl?.replace(/\/+$/, '') ?? `${webBaseUrl}/api/v4`,
      authentication: input.authentication ?? 'private-token',
      contributorProfiles: Object.freeze({ ...(input.contributorProfiles ?? {}) }),
      projectPath,
      provider: 'gitlab',
      url: repositoryUrl,
      webBaseUrl,
    })
  }

  const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent)
  const organizationId = input.organizationId ?? parts[0]
  const repositoryPath = input.repositoryPath ?? parts.join('/')
  if (!organizationId || parts.length < 2)
    throw new TypeError('Yunxiao repository URL must include the organization and repository path')
  return Object.freeze({
    ...common,
    apiBaseUrl: input.apiBaseUrl?.replace(/\/+$/, '') ?? 'https://openapi-rdc.aliyuncs.com',
    apiMode: input.apiMode ?? 'central',
    contributorAccounts: Object.freeze({ ...(input.contributorAccounts ?? {}) }),
    organizationId,
    provider: 'yunxiao',
    repositoryId: input.repositoryId,
    repositoryPath,
    url: repositoryUrl,
  })
}

export function resolveElementPlusDocsProjectRepository(
  project: ElementPlusDocsProjectInput,
  providerOverride?: string,
): ElementPlusDocsResolvedRepository {
  const providerId = resolveElementPlusDocsRepositoryProvider(providerOverride, project.repository.provider)
  const configured = providerId === project.repository.provider
    ? project.repository
    : project.repositoryProviders?.[providerId]
  if (!configured || configured.provider !== providerId)
    throw new TypeError(`Repository provider "${providerId}" is selected but not configured`)
  return resolveElementPlusDocsRepository(configured)
}
