import type { I18nToolCliOverrides, ResolvedI18nToolConfig } from './types'
import { dirname, isAbsolute, resolve } from 'node:path'
import process from 'node:process'
import { z } from 'zod'

const relativePatternSchema = z.string().min(1).superRefine((value, context) => {
  const normalized = value.replaceAll('\\', '/')
  if (isAbsolute(value) || normalized.split('/').includes('..')) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Resource paths and globs must stay relative to the configured root.',
    })
  }
})

const WINDOWS_RESERVED_NAME = /^(?:AUX|COM[1-9]|CON|LPT[1-9]|NUL|PRN)(?:\.|$)/i
const resourceSegmentSchema = z.string().min(1).superRefine((value, context) => {
  if (
    value === '.'
    || value === '..'
    || /[<>:"|?*\\/]/.test(value)
    || [...value].some(character => character.charCodeAt(0) <= 31)
    || /[. ]$/.test(value)
    || WINDOWS_RESERVED_NAME.test(value)
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Locale and namespace values must be safe single path segments.',
    })
  }
})

const localePatternSchema = relativePatternSchema.superRefine((value, context) => {
  const placeholders = [...value.matchAll(/\{([^}]+)\}/g)].map(match => match[1])
  const unknown = placeholders.filter(placeholder => !['locale', 'namespace'].includes(placeholder))
  const duplicates = placeholders.filter((placeholder, index) => placeholders.indexOf(placeholder) !== index)
  if (unknown.length > 0 || duplicates.length > 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'localePattern may contain {locale} and {namespace} at most once each.',
    })
  }
})

const aiBaseUrlSchema = z.string().url().superRefine((value, context) => {
  const url = new URL(value)
  if (url.username || url.password || url.search || url.hash) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'AI baseUrl must not contain credentials, query parameters, or fragments.',
    })
  }
})

const adapterOptionsSchema = z.object({
  contexts: z.array(z.string().min(1)).optional(),
  pluralForms: z.array(z.string().min(1)).optional(),
  separator: z.string().min(1).optional(),
}).strict()

export const i18nToolConfigSchema = z.object({
  ai: z.object({
    apiKeyEnv: z.string().regex(/^[A-Z_][A-Z\d_]*$/).default('I18N_TOOL_AI_API_KEY'),
    baseUrl: aiBaseUrlSchema.default('https://coderelay.cn/v1'),
    model: z.string().min(1).default('gpt-4o-mini'),
  }).strict().default({}),
  limits: z.object({
    bodyBytes: z.number().int().min(1_024).max(10_000_000).default(1_000_000),
    concurrentApplies: z.number().int().min(1).max(8).default(1),
    concurrentTranslations: z.number().int().min(1).max(16).default(2),
    files: z.number().int().min(1).max(10_000).default(500),
    keys: z.number().int().min(1).max(1_000_000).default(50_000),
    totalBytes: z.number().int().min(1_024).max(500_000_000).default(20_000_000),
  }).strict().default({}),
  resources: z.object({
    adapter: z.enum(['generic-json', 'i18next-json', 'vue-i18n-json']),
    adapterOptions: adapterOptionsSchema.optional(),
    exclude: z.array(relativePatternSchema).default(['**/node_modules/**', '**/.git/**']),
    include: z.array(relativePatternSchema).min(1).default(['locales/**/*.json']),
    keyStyle: z.enum(['flat', 'nested']).default('nested'),
    layout: z.enum(['locale-first', 'locale-per-file']),
    localePattern: localePatternSchema,
    namespace: resourceSegmentSchema.optional(),
    sourceLocale: resourceSegmentSchema,
    targetLocales: z.array(resourceSegmentSchema).min(1),
  }).strict(),
  root: z.string().min(1).optional(),
  server: z.object({
    host: z.union([z.boolean(), z.string().min(1)]).default('127.0.0.1'),
    open: z.union([z.boolean(), z.string().min(1)]).default(true),
    port: z.number().int().min(1).max(65_535).default(5_174),
  }).strict().default({}),
}).strict().superRefine((config, context) => {
  const targets = new Set(config.resources.targetLocales)
  if (targets.size !== config.resources.targetLocales.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Target locales must be unique.',
      path: ['resources', 'targetLocales'],
    })
  }
  const normalizedSourceLocale = config.resources.sourceLocale.toLowerCase()
  if (config.resources.targetLocales.some(locale => locale.toLowerCase() === normalizedSourceLocale)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'The source locale cannot also be a target locale.',
      path: ['resources', 'targetLocales'],
    })
  }
  if (config.resources.layout === 'locale-per-file' && !config.resources.localePattern.includes('{locale}')) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Locale-per-file patterns must contain {locale}.',
      path: ['resources', 'localePattern'],
    })
  }
  if (config.resources.adapter !== 'generic-json' && config.resources.layout !== 'locale-per-file') {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: `${config.resources.adapter} supports locale-per-file resources only.`,
      path: ['resources', 'layout'],
    })
  }
  if (config.resources.localePattern.includes('{namespace}') && !config.resources.namespace) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Patterns containing {namespace} require an explicit namespace.',
      path: ['resources', 'namespace'],
    })
  }
  const localePaths = [config.resources.sourceLocale, ...config.resources.targetLocales]
    .map(locale => config.resources.localePattern
      .replaceAll('{locale}', locale)
      .replaceAll('{namespace}', config.resources.namespace ?? ''))
  const comparisonPaths = localePaths.map(path => process.platform === 'win32' ? path.toLowerCase() : path)
  if (config.resources.layout === 'locale-per-file' && new Set(comparisonPaths).size !== comparisonPaths.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Target locales resolve to colliding resource paths.',
      path: ['resources', 'targetLocales'],
    })
  }
})

export interface ResolveConfigOptions {
  cli?: I18nToolCliOverrides
  configPath: string
  cwd?: string
}

export function resolveI18nToolConfig(
  input: unknown,
  options: ResolveConfigOptions,
): ResolvedI18nToolConfig {
  const parsed = i18nToolConfigSchema.parse(input)
  if (
    (typeof options.cli?.host === 'string' && !options.cli.host.trim())
    || (typeof options.cli?.open === 'string' && !options.cli.open.trim())
    || (options.cli?.root !== undefined && !options.cli.root.trim())
  ) {
    throw new Error('CLI path, host, and open overrides must not be blank.')
  }
  const configDirectory = dirname(resolve(options.configPath))
  const cwd = resolve(options.cwd ?? process.cwd())
  const root = options.cli?.root
    ? resolve(cwd, options.cli.root)
    : resolve(configDirectory, parsed.root ?? '.')
  return {
    ...parsed,
    configPath: resolve(options.configPath),
    root,
    server: {
      host: options.cli?.host ?? parsed.server.host,
      open: options.cli?.open ?? parsed.server.open,
      port: options.cli?.port ?? parsed.server.port,
    },
  }
}
