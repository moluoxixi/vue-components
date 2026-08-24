import type { DefaultTheme, UserConfig } from 'vitepress'
import type {
  DocsLocale,
  ElementPlusDocsOptions,
  ElementPlusDocsRuntimeLocale,
  ElementPlusDocsThemeConfig,
} from '../types'
import headersPlugin from '../upstream/plugins/headers'

const consumerStylesModuleId = 'virtual:moluoxixi-element-plus-docs-consumer-styles'
const resolvedConsumerStylesModuleId = `\0${consumerStylesModuleId}`
const repositorySnapshotModuleId = 'virtual:moluoxixi-repository-metadata-snapshot'

function validate(options: ElementPlusDocsOptions): void {
  const missing: string[] = []
  if (!options.site?.title)
    missing.push('site.title')
  if (options.site.defaultLocale && options.site.locales && !options.site.locales[options.site.defaultLocale]) {
    missing.push(`site.locales.${options.site.defaultLocale}`)
  }
  if (options.repository?.editLinks && !options.repository.defaultBranch)
    missing.push('repository.defaultBranch')
  if (missing.length) {
    throw new Error(`[vitepress-theme-element-plus] Missing required configuration: ${missing.join(', ')}`)
  }
}

function normalizePathPrefix(prefix: string | undefined, locale: DocsLocale, defaultLocale: DocsLocale): string {
  if (prefix === '' || prefix === '/' || (locale === defaultLocale && prefix === undefined))
    return ''
  const value = prefix ?? `/${locale}`
  return `/${value.replace(/^\/+|\/+$/g, '')}`
}

function normalizeRuntimeLocales(
  locales: NonNullable<ElementPlusDocsOptions['site']['locales']>,
  defaultLocale: DocsLocale,
): Record<DocsLocale, ElementPlusDocsRuntimeLocale> {
  const result: Record<DocsLocale, ElementPlusDocsRuntimeLocale> = {}
  const siteKeys: string[] = []
  const languageTags: string[] = []
  for (const [locale, config] of Object.entries(locales)) {
    const pathPrefix = normalizePathPrefix(config.pathPrefix, locale, defaultLocale)
    const siteKey = config.siteKey ?? (locale === defaultLocale ? 'root' : pathPrefix.slice(1) || locale)
    const lang = config.lang ?? locale
    result[locale] = {
      label: config.label,
      lang,
      pathPrefix,
      siteKey,
    }
    siteKeys.push(siteKey)
    languageTags.push(lang)
  }

  if (new Set(siteKeys).size !== siteKeys.length) {
    throw new Error('[vitepress-theme-element-plus] Locale siteKey values must be unique')
  }
  if (new Set(languageTags).size !== languageTags.length) {
    throw new Error('[vitepress-theme-element-plus] Locale lang values must be unique')
  }
  return result
}

function localeThemeConfig(
  options: ElementPlusDocsOptions,
  localeKey: DocsLocale,
  runtimeLocale: ElementPlusDocsRuntimeLocale,
  runtimeLocales: Record<DocsLocale, ElementPlusDocsRuntimeLocale>,
  defaultLang: string,
): DefaultTheme.Config & ElementPlusDocsThemeConfig {
  const localeConfig = options.site.locales?.[localeKey]
  const routePrefix = runtimeLocale.pathPrefix
  const route = (path: string) => `${routePrefix}${path.startsWith('/') ? path : `/${path}`}` || '/'
  const overrides = {
    ...options.vitepress?.themeConfig,
    ...localeConfig?.themeConfig,
  } as DefaultTheme.Config & Partial<ElementPlusDocsThemeConfig>

  return {
    logo: options.site.logo ?? '',
    siteTitle: options.site.siteTitle ?? options.site.title,
    version: '',
    repository: options.repository?.url ?? '',
    repo: options.repository?.url ?? '',
    docsRepo: options.repository?.url ?? '',
    docsBranch: options.repository?.defaultBranch,
    editLinks: options.repository?.editLinks ?? false,
    langs: Object.keys(runtimeLocales),
    locales: runtimeLocales,
    defaultLocale: defaultLang,
    components: options.components?.catalog ?? [],
    nav: [
      { text: 'Overview', link: route(options.routes?.overview ?? '/') },
      { text: 'Guide', link: route(options.routes?.guide ?? '/guide/'), activeMatch: route(options.routes?.guide ?? '/guide/') },
      { text: 'Components', link: route(options.routes?.components ?? '/components/'), activeMatch: route(options.routes?.components ?? '/components/') },
    ],
    sidebar: {},
    outline: { level: [2, 6], label: 'On this page' },
    docFooter: { prev: 'Previous page', next: 'Next page' },
    lastUpdated: { text: 'Last updated' },
    search: (options.search === undefined || options.search === 'local'
      ? { provider: 'local' }
      : options.search) as DefaultTheme.Config['search'],
    ...overrides,
  }
}

function indexRuntimeLocalesByLanguage(
  locales: Record<DocsLocale, ElementPlusDocsRuntimeLocale>,
): Record<string, ElementPlusDocsRuntimeLocale> {
  return Object.fromEntries(Object.values(locales).map(locale => [locale.lang, locale]))
}

function createConsumerStylesPlugin(styles: string | string[] | undefined) {
  const imports = styles === undefined ? [] : Array.isArray(styles) ? styles : [styles]
  return {
    name: 'moluoxixi-element-plus-docs-consumer-styles',
    enforce: 'pre' as const,
    resolveId(id: string) {
      return id === consumerStylesModuleId ? resolvedConsumerStylesModuleId : undefined
    },
    load(id: string) {
      if (id !== resolvedConsumerStylesModuleId)
        return undefined
      return imports.length
        ? `${imports.map(style => `import ${JSON.stringify(style)}`).join('\n')}\n`
        : 'export {}\n'
    },
  }
}

function createRepositorySnapshotPlugin() {
  const nodeProcess = Reflect.get(globalThis, 'process') as
    | { env?: Record<string, string | undefined> }
    | undefined
  const snapshotPath = nodeProcess?.env?.ELEMENT_PLUS_DOCS_REPOSITORY_SNAPSHOT_PATH
  return {
    name: 'moluoxixi-element-plus-docs-repository-snapshot',
    enforce: 'pre' as const,
    resolveId(id: string) {
      return id === repositorySnapshotModuleId && snapshotPath ? snapshotPath : undefined
    },
  }
}

function createMarkdownConfig(markdown: UserConfig['markdown'] | undefined): NonNullable<UserConfig['markdown']> {
  const configureConsumerMarkdown = markdown?.config
  const headers = markdown?.headers ?? { level: [2, 3, 4, 5, 6] }

  return {
    ...markdown,
    headers,
    config(md) {
      if (markdown?.headers !== false)
        md.use(headersPlugin)
      configureConsumerMarkdown?.(md)
    },
  }
}

export function defineElementPlusDocs(options: ElementPlusDocsOptions): UserConfig {
  validate(options)
  const configuredLocales = options.site.locales ?? {
    [options.site.defaultLocale ?? 'en-US']: { label: 'English', lang: 'en-US', pathPrefix: '' },
  }
  const defaultLocale = options.site.defaultLocale ?? Object.keys(configuredLocales)[0]
  const runtimeLocalesByKey = normalizeRuntimeLocales(configuredLocales, defaultLocale)
  const runtimeLocales = indexRuntimeLocalesByLanguage(runtimeLocalesByKey)
  const defaultLang = runtimeLocalesByKey[defaultLocale].lang
  const localeConfigs = Object.fromEntries(Object.entries(configuredLocales).map(([locale, localeConfig]) => {
    const runtimeLocale = runtimeLocalesByKey[locale]
    return [runtimeLocale.siteKey, {
      label: localeConfig.label,
      lang: runtimeLocale.lang,
      title: options.site.title,
      description: localeConfig.description ?? options.site.description,
      ...(locale === defaultLocale ? {} : { link: `${runtimeLocale.pathPrefix}/` }),
      themeConfig: localeThemeConfig(options, locale, runtimeLocale, runtimeLocales, defaultLang),
    }]
  }))
  const vite = options.vitepress?.vite ?? {}

  return {
    title: options.site.title,
    description: options.site.description,
    base: options.site.base ?? '/',
    lastUpdated: true,
    locales: localeConfigs,
    rewrites: options.vitepress?.rewrites,
    markdown: createMarkdownConfig(options.vitepress?.markdown),
    head: options.vitepress?.head ?? [],
    themeConfig: localeThemeConfig(
      options,
      defaultLocale,
      runtimeLocalesByKey[defaultLocale],
      runtimeLocales,
      defaultLang,
    ),
    vite: {
      ...vite,
      plugins: [
        createConsumerStylesPlugin(options.components?.styles),
        createRepositorySnapshotPlugin(),
        ...(vite.plugins ?? []),
      ] as NonNullable<UserConfig['vite']>['plugins'],
    },
  }
}
