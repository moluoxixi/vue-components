import type { ProjectPage, RegistryContractSnapshot, RegistryLock } from '@moluoxixi/config-form-model'
import type {
  ProjectTemplateCatalogEntry,
  ProjectTemplateCategory,
  ProjectTemplateManifest,
  ProjectTemplateSeed,
  TemplateCatalogDiagnostic,
  TemplateCatalogLoadResult,
  TemplateCatalogProvider,
  TemplateCompatibilityInput,
  TemplateCompatibilityResult,
} from './types'
import { parseProjectDocument, PROJECT_DOCUMENT_VERSION } from '@moluoxixi/config-form-model'
import { remapTemplatePageIdentity } from '../identity-remap'

const ID_PATTERN = /^[a-z][a-z0-9-]*$/
const COMPONENT_KEY_PATTERN = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype'])
const ADAPTERS = new Set(['antd-vue', 'element-plus'])
const CATEGORIES = new Set<ProjectTemplateCategory>(['blank', 'starter'])
const VIEWPORTS = new Set(['desktop', 'mobile', 'tablet'])
const MAX_PROVIDER_TEMPLATE_COUNT = 256
const MAX_TEMPLATE_ARRAY_LENGTH = 4096

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function findUnsafeOrNonJsonValue(value: unknown, path = '$', ancestors = new WeakSet<object>()): string | undefined {
  if (value === null || typeof value === 'string' || typeof value === 'boolean')
    return undefined
  if (typeof value === 'number')
    return Number.isFinite(value) ? undefined : path
  if (typeof value !== 'object')
    return path
  if (ancestors.has(value))
    return path
  ancestors.add(value)
  const entries = Array.isArray(value)
    ? value.map((item, index) => [String(index), item] as const)
    : Object.entries(value)
  for (const [key, child] of entries) {
    if (UNSAFE_KEYS.has(key))
      return `${path}.${key}`
    const invalid = findUnsafeOrNonJsonValue(child, `${path}.${key}`, ancestors)
    if (invalid)
      return invalid
  }
  ancestors.delete(value)
  return undefined
}

function findOversizedArray(
  value: unknown,
  path = '$',
  ancestors = new WeakSet<object>(),
): string | undefined {
  if (!value || typeof value !== 'object')
    return undefined
  if (Array.isArray(value) && value.length > MAX_TEMPLATE_ARRAY_LENGTH)
    return path
  if (ancestors.has(value))
    return undefined
  ancestors.add(value)
  for (const [key, child] of Object.entries(value)) {
    const invalid = findOversizedArray(child, `${path}.${key}`, ancestors)
    if (invalid)
      return invalid
  }
  ancestors.delete(value)
  return undefined
}

function requireString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function hasOnlyKeys(record: Record<string, unknown>, allowed: readonly string[]): boolean {
  const keys = new Set(allowed)
  return Object.keys(record).every(key => keys.has(key))
}

function parseManifest(input: unknown, providerId: string): ProjectTemplateManifest | TemplateCatalogDiagnostic {
  if (!isRecord(input)) {
    return { code: 'TEMPLATE_INVALID', message: 'Template manifest must be an object.', providerId, path: 'manifest' }
  }
  const id = requireString(input, 'id')
  if (!id || !ID_PATTERN.test(id)) {
    return { code: 'TEMPLATE_INVALID', message: `Template id is invalid: ${String(input.id)}`, providerId, path: 'manifest.id' }
  }
  const version = input.version
  if (!Number.isInteger(version) || Number(version) < 1) {
    return { code: 'TEMPLATE_VERSION_INVALID', message: `Template "${id}" requires a positive integer version.`, providerId, templateId: id, path: 'manifest.version' }
  }
  const adapter = requireString(input, 'adapter')
  if (!adapter || !ADAPTERS.has(adapter)) {
    return { code: 'TEMPLATE_ADAPTER_INVALID', message: `Template "${id}" has unsupported adapter "${String(input.adapter)}".`, providerId, templateId: id, path: 'manifest.adapter' }
  }
  const category = requireString(input, 'category')
  if (!category || !CATEGORIES.has(category as ProjectTemplateCategory)) {
    return { code: 'TEMPLATE_CATEGORY_INVALID', message: `Template "${id}" has unsupported category "${String(input.category)}".`, providerId, templateId: id, path: 'manifest.category' }
  }
  const displayName = requireString(input, 'displayName')
  const description = requireString(input, 'description')
  if (!displayName || !description || !Number.isInteger(input.order) || Number(input.order) < 0) {
    return { code: 'TEMPLATE_INVALID', message: `Template "${id}" requires displayName, description, and a non-negative integer order.`, providerId, templateId: id, path: 'manifest' }
  }
  if (!Array.isArray(input.tags) || input.tags.some(tag => typeof tag !== 'string' || !tag.trim())) {
    return { code: 'TEMPLATE_INVALID', message: `Template "${id}" tags must be non-empty strings.`, providerId, templateId: id, path: 'manifest.tags' }
  }
  if (
    !isRecord(input.registry)
    || !hasOnlyKeys(input.registry, ['adapter', 'components'])
    || requireString(input.registry, 'adapter') !== adapter
    || !Array.isArray(input.registry.components)
  ) {
    return { code: 'TEMPLATE_INVALID', message: `Template "${id}" Registry requirements are invalid.`, providerId, templateId: id, path: 'manifest.registry' }
  }
  const components = input.registry.components.map((requirement) => {
    if (!isRecord(requirement) || !hasOnlyKeys(requirement, ['contractVersion', 'fingerprint', 'key']))
      return undefined
    const key = requireString(requirement, 'key')
    const contractVersion = requirement.contractVersion === undefined ? undefined : requireString(requirement, 'contractVersion')
    const fingerprint = requirement.fingerprint === undefined ? undefined : requireString(requirement, 'fingerprint')
    if (
      !key
      || !COMPONENT_KEY_PATTERN.test(key)
      || (requirement.contractVersion !== undefined && !contractVersion)
      || (requirement.fingerprint !== undefined && !fingerprint)
    ) {
      return undefined
    }
    return { key, ...(contractVersion ? { contractVersion } : {}), ...(fingerprint ? { fingerprint } : {}) }
  })
  if (components.some(component => !component) || new Set(components.map(component => component!.key)).size !== components.length) {
    return { code: 'TEMPLATE_INVALID', message: `Template "${id}" Registry component requirements are invalid or duplicated.`, providerId, templateId: id, path: 'manifest.registry.components' }
  }
  if (
    !isRecord(input.preview)
    || !hasOnlyKeys(input.preview, ['pageId', 'preferredViewport'])
    || !VIEWPORTS.has(String(input.preview.preferredViewport))
    || !requireString(input.preview, 'pageId')
  ) {
    return { code: 'TEMPLATE_INVALID', message: `Template "${id}" preview metadata is invalid.`, providerId, templateId: id, path: 'manifest.preview' }
  }
  const allowed = new Set(['adapter', 'category', 'description', 'displayName', 'id', 'order', 'preview', 'registry', 'tags', 'version'])
  if (Object.keys(input).some(key => !allowed.has(key))) {
    return { code: 'TEMPLATE_INVALID', message: `Template "${id}" manifest contains unsupported fields.`, providerId, templateId: id, path: 'manifest' }
  }
  return {
    id,
    version: version as number,
    displayName,
    description,
    adapter: adapter as ProjectTemplateManifest['adapter'],
    category: category as ProjectTemplateCategory,
    order: input.order as number,
    tags: (input.tags as string[]).map(tag => tag.trim()),
    registry: { adapter: adapter as ProjectTemplateManifest['adapter'], components: components as ProjectTemplateManifest['registry']['components'] },
    preview: {
      preferredViewport: input.preview.preferredViewport as ProjectTemplateManifest['preview']['preferredViewport'],
      pageId: requireString(input.preview, 'pageId')!,
    },
  }
}

function parseSeedPage(page: unknown, manifest: ProjectTemplateManifest): ProjectPage | TemplateCatalogDiagnostic {
  if (!isRecord(page))
    return { code: 'TEMPLATE_SEED_INVALID', message: `Template "${manifest.id}" page seed must be an object.`, templateId: manifest.id, path: 'page' }
  const pageId = typeof page.id === 'string' ? page.id : 'template-page'
  const parsed = parseProjectDocument({
    schemaVersion: PROJECT_DOCUMENT_VERSION,
    id: 'template-seed-validation',
    name: 'Template seed validation',
    homePageId: pageId,
    pageOrder: [pageId],
    pagesById: { [pageId]: page },
    registryLock: { adapter: manifest.adapter, version: '1', fingerprint: 'template-seed', components: {} },
    settings: {},
    resources: {},
  })
  if (!parsed.success) {
    const first = parsed.diagnostics[0]
    return {
      code: 'TEMPLATE_SEED_INVALID',
      message: `Template "${manifest.id}" page seed is invalid: ${first?.message ?? 'unknown schema error'}`,
      path: first?.path?.join('.') ?? 'page',
      templateId: manifest.id,
    }
  }
  const parsedPage = parsed.data.pagesById[pageId]!
  if (manifest.preview.pageId !== parsedPage.id) {
    return { code: 'TEMPLATE_SEED_INVALID', message: `Template "${manifest.id}" preview pageId does not match its seed page.`, templateId: manifest.id, path: 'manifest.preview.pageId' }
  }
  const required = new Set(manifest.registry.components.map(component => component.key))
  const used = new Set(Object.values(parsedPage.graph.nodesById).map(node => node.component))
  for (const component of used) {
    if (!required.has(component)) {
      return { code: 'TEMPLATE_SEED_INVALID', message: `Template "${manifest.id}" does not declare Registry component "${component}".`, templateId: manifest.id, path: 'manifest.registry.components' }
    }
  }
  return parsedPage
}

function validateIdentityReferences(page: ProjectPage, manifest: ProjectTemplateManifest): TemplateCatalogDiagnostic | undefined {
  let sequence = 0
  try {
    remapTemplatePageIdentity(page, 'template-validation-page', {
      create: kind => `template-validation-${kind}-${++sequence}`,
    })
  }
  catch (error) {
    return {
      code: 'TEMPLATE_IDENTITY_REFERENCE_UNSUPPORTED',
      message: `Template "${manifest.id}" contains an unsupported identity reference: ${error instanceof Error ? error.message : String(error)}`,
      path: 'page',
      templateId: manifest.id,
    }
  }
  return undefined
}

export function parseProjectTemplateSeed(input: unknown, providerId: string): ProjectTemplateSeed | TemplateCatalogDiagnostic {
  const oversizedPath = findOversizedArray(input)
  if (oversizedPath) {
    return {
      code: 'TEMPLATE_INVALID',
      message: `Template provider data exceeds the ${MAX_TEMPLATE_ARRAY_LENGTH}-item array limit at ${oversizedPath}.`,
      providerId,
      path: oversizedPath,
    }
  }
  const unsafePath = findUnsafeOrNonJsonValue(input)
  if (unsafePath) {
    return { code: 'TEMPLATE_UNSAFE_KEY', message: `Template provider data is not JSON-safe at ${unsafePath}.`, providerId, path: unsafePath }
  }
  if (!isRecord(input) || Object.keys(input).some(key => key !== 'manifest' && key !== 'page')) {
    return { code: 'TEMPLATE_INVALID', message: 'Template seed must contain only manifest and page.', providerId }
  }
  const manifest = parseManifest(input.manifest, providerId)
  if ('code' in manifest)
    return manifest
  const page = parseSeedPage(input.page, manifest)
  if ('code' in page)
    return { ...page, providerId }
  const identityDiagnostic = validateIdentityReferences(page, manifest)
  if (identityDiagnostic)
    return { ...identityDiagnostic, providerId }
  return { manifest, page }
}

function cloneEntry(entry: ProjectTemplateCatalogEntry): ProjectTemplateCatalogEntry {
  return structuredClone(entry)
}

export function createTemplateCatalogService(providers: readonly TemplateCatalogProvider[]) {
  async function load(): Promise<TemplateCatalogLoadResult> {
    const diagnostics: TemplateCatalogDiagnostic[] = []
    const templates: ProjectTemplateCatalogEntry[] = []
    const providerIds = new Set<string>()
    const validProviders = providers.filter((provider) => {
      if (!ID_PATTERN.test(provider.id)) {
        diagnostics.push({ code: 'TEMPLATE_PROVIDER_INVALID', message: `Template provider id is invalid: ${provider.id}`, providerId: provider.id })
        return false
      }
      if (providerIds.has(provider.id)) {
        diagnostics.push({ code: 'TEMPLATE_PROVIDER_DUPLICATE', message: `Template provider "${provider.id}" is registered more than once.`, providerId: provider.id })
        return false
      }
      providerIds.add(provider.id)
      return true
    })
    const results = await Promise.all(validProviders.map(async (provider) => {
      try {
        const seeds = await provider.list()
        if (!Array.isArray(seeds))
          throw new TypeError('Provider list() must resolve to an array of template seeds.')
        if (seeds.length > MAX_PROVIDER_TEMPLATE_COUNT)
          throw new TypeError(`Provider list() exceeds the ${MAX_PROVIDER_TEMPLATE_COUNT}-template limit.`)
        return { provider, seeds }
      }
      catch (error) {
        diagnostics.push({
          code: 'TEMPLATE_PROVIDER_FAILED',
          message: `Template provider "${provider.id}" failed: ${error instanceof Error ? error.message : String(error)}`,
          providerId: provider.id,
        })
        return undefined
      }
    }))
    const templateIds = new Set<string>()
    results.forEach((result) => {
      result?.seeds.forEach((input) => {
        const seed = parseProjectTemplateSeed(input, result.provider.id)
        if ('code' in seed) {
          diagnostics.push(seed)
          return
        }
        if (templateIds.has(seed.manifest.id)) {
          diagnostics.push({ code: 'TEMPLATE_DUPLICATE', message: `Template "${seed.manifest.id}" is registered more than once.`, providerId: result.provider.id, templateId: seed.manifest.id })
          return
        }
        templateIds.add(seed.manifest.id)
        templates.push({ providerId: result.provider.id, ...seed })
      })
    })
    templates.sort((left, right) => left.manifest.order - right.manifest.order
      || left.manifest.displayName.localeCompare(right.manifest.displayName)
      || left.manifest.id.localeCompare(right.manifest.id))
    return { templates: templates.map(cloneEntry), diagnostics: structuredClone(diagnostics) }
  }
  return { load }
}

export interface TemplateCatalogFilter {
  category?: ProjectTemplateCategory | 'all'
  providerId?: string | 'all'
  query?: string
}

export function filterTemplateCatalog(
  templates: readonly ProjectTemplateCatalogEntry[],
  filter: TemplateCatalogFilter,
): ProjectTemplateCatalogEntry[] {
  const query = filter.query?.trim().toLocaleLowerCase() ?? ''
  return templates.filter((entry) => {
    if (filter.category && filter.category !== 'all' && entry.manifest.category !== filter.category)
      return false
    if (filter.providerId && filter.providerId !== 'all' && entry.providerId !== filter.providerId)
      return false
    return !query || [entry.manifest.displayName, entry.manifest.description, entry.providerId, ...entry.manifest.tags]
      .join(' ')
      .toLocaleLowerCase()
      .includes(query)
  }).map(cloneEntry)
}

function componentMap(registry: RegistryContractSnapshot) {
  return new Map(registry.components.map(component => [component.key, component]))
}

export function analyzeTemplateCompatibility(
  template: ProjectTemplateCatalogEntry,
  input: TemplateCompatibilityInput,
): TemplateCompatibilityResult {
  const diagnostics: TemplateCatalogDiagnostic[] = []
  const manifest = template.manifest
  const add = (diagnostic: Omit<TemplateCatalogDiagnostic, 'templateId'>) => diagnostics.push({ ...diagnostic, templateId: manifest.id })
  if (manifest.adapter !== input.registry.adapter || manifest.registry.adapter !== input.registry.adapter) {
    add({ code: 'TEMPLATE_REGISTRY_ADAPTER_MISMATCH', message: `Template requires ${manifest.adapter}; selected Registry is ${input.registry.adapter}.` })
  }
  if (input.targetLock) {
    if (input.targetLock.adapter !== manifest.adapter)
      add({ code: 'TEMPLATE_REGISTRY_ADAPTER_MISMATCH', message: `Current project uses ${input.targetLock.adapter}; template requires ${manifest.adapter}.` })
    if (input.targetLock.version !== input.registry.adapterVersion)
      add({ code: 'TEMPLATE_REGISTRY_VERSION_MISMATCH', message: `Current project Registry version ${input.targetLock.version} differs from available version ${input.registry.adapterVersion}.` })
    if (input.targetLock.fingerprint !== input.registry.fingerprint)
      add({ code: 'TEMPLATE_REGISTRY_FINGERPRINT_MISMATCH', message: 'Current project Registry fingerprint differs from the available adapter Registry.' })
  }
  const available = componentMap(input.registry)
  manifest.registry.components.forEach((requirement) => {
    const component = available.get(requirement.key)
    const locked = input.targetLock?.components[requirement.key]
    if (!component || (input.targetLock && !locked)) {
      add({ code: 'TEMPLATE_REGISTRY_COMPONENT_MISSING', message: `Registry component is missing: ${requirement.key}`, path: requirement.key })
      return
    }
    if (requirement.contractVersion && component.contractVersion !== requirement.contractVersion)
      add({ code: 'TEMPLATE_REGISTRY_COMPONENT_VERSION_MISMATCH', message: `${requirement.key} requires contract ${requirement.contractVersion}; available contract is ${component.contractVersion}.`, path: requirement.key })
    if (requirement.fingerprint && component.fingerprint !== requirement.fingerprint)
      add({ code: 'TEMPLATE_REGISTRY_COMPONENT_FINGERPRINT_MISMATCH', message: `${requirement.key} Registry fingerprint does not match the template requirement.`, path: requirement.key })
    if (locked && (locked.contractVersion !== component.contractVersion))
      add({ code: 'TEMPLATE_REGISTRY_COMPONENT_VERSION_MISMATCH', message: `${requirement.key} is locked at contract ${locked.contractVersion}; available contract is ${component.contractVersion}.`, path: requirement.key })
    if (locked && locked.fingerprint !== component.fingerprint)
      add({ code: 'TEMPLATE_REGISTRY_COMPONENT_FINGERPRINT_MISMATCH', message: `${requirement.key} locked fingerprint differs from the available component contract.`, path: requirement.key })
  })
  return { compatible: diagnostics.length === 0, diagnostics }
}

export function registryLockFromSnapshot(registry: RegistryContractSnapshot): RegistryLock {
  return {
    adapter: registry.adapter,
    version: registry.adapterVersion,
    fingerprint: registry.fingerprint,
    components: Object.fromEntries(registry.components.map(component => [component.key, {
      contractVersion: component.contractVersion,
      fingerprint: component.fingerprint,
    }])),
  }
}
