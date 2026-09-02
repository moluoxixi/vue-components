import type {
  ConfigFormNamedModule,
  ConfigFormNamedModuleImport,
  ConfigFormNamedModuleMap,
  ConfigFormNamedModuleRegistry,
  ConfigFormNamedRegistryEntry,
} from '../types'

const CONFIG_FORM_MODULE_NAME_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/
const UNSAFE_MODULE_NAMES = new Set(['__proto__', 'constructor', 'prototype'])

export class ConfigFormModuleRegistryError<
  TContext extends Record<string, unknown> = Record<string, unknown>,
> extends Error {
  readonly code: string
  readonly context: TContext

  constructor(code: string, message: string, context: TContext = {} as TContext) {
    super(message)
    Object.setPrototypeOf(this, new.target.prototype)
    this.name = new.target.name
    this.code = code
    this.context = context
  }
}

export function defineConfigFormModule<TValue>(
  module: ConfigFormNamedModule<TValue>,
): ConfigFormNamedModule<TValue> {
  return module
}

export function createConfigFormModuleRegistry<TValue>(
  modules: ConfigFormNamedModuleMap<TValue>,
): ConfigFormNamedModuleRegistry<TValue> {
  const entries = Object.entries(modules)
    .map(([source, imported]) => normalizeModule(source, imported))
    .sort(compareEntries)
  const byName = new Map<string, ConfigFormNamedRegistryEntry<TValue>>()

  for (const entry of entries) {
    const existing = byName.get(entry.name)
    if (existing) {
      throw new ConfigFormModuleRegistryError(
        'CONFIG_FORM_MODULE_NAME_DUPLICATE',
        `Duplicate ConfigForm module name: ${entry.name}`,
        { name: entry.name, sources: [existing.source, entry.source] },
      )
    }
    byName.set(entry.name, entry)
  }

  return {
    get: name => byName.get(name)?.value,
    list: () => [...entries],
    toRecord: () => Object.fromEntries(entries.map(entry => [entry.name, entry.value])),
  }
}

function normalizeModule<TValue>(
  source: string,
  imported: ConfigFormNamedModuleImport<TValue>,
): ConfigFormNamedRegistryEntry<TValue> {
  const module = isDefaultModuleImport(imported) ? imported.default : imported
  if (!module || typeof module !== 'object') {
    throw new ConfigFormModuleRegistryError(
      'CONFIG_FORM_MODULE_INVALID',
      `ConfigForm module must export a named module definition: ${source}`,
      { source },
    )
  }

  const name = typeof module.name === 'string' ? module.name.trim() : ''
  if (!name) {
    throw new ConfigFormModuleRegistryError(
      'CONFIG_FORM_MODULE_NAME_REQUIRED',
      `ConfigForm module name is required: ${source}`,
      { source },
    )
  }
  if (UNSAFE_MODULE_NAMES.has(name) || !CONFIG_FORM_MODULE_NAME_RE.test(name)) {
    throw new ConfigFormModuleRegistryError(
      'CONFIG_FORM_MODULE_NAME_INVALID',
      `Invalid ConfigForm module name: ${name}`,
      { name, source },
    )
  }

  const expectedName = resolveSourceName(source)
  if (expectedName !== name) {
    throw new ConfigFormModuleRegistryError(
      'CONFIG_FORM_MODULE_NAME_MISMATCH',
      `ConfigForm module name ${name} does not match source ${source}`,
      { expectedName, name, source },
    )
  }

  const order = module.order
  if (order !== undefined && (!Number.isSafeInteger(order) || order < 0)) {
    throw new ConfigFormModuleRegistryError(
      'CONFIG_FORM_MODULE_ORDER_INVALID',
      `ConfigForm module order must be a non-negative safe integer: ${name}`,
      { name, order, source },
    )
  }

  return { name, value: module.value, ...(order === undefined ? {} : { order }), source }
}

function isDefaultModuleImport<TValue>(
  imported: ConfigFormNamedModuleImport<TValue>,
): imported is { default: ConfigFormNamedModule<TValue> } {
  return imported !== null
    && typeof imported === 'object'
    && !('name' in imported)
    && 'default' in imported
}

function resolveSourceName(source: string): string {
  const normalized = source.replaceAll('\\', '/')
  const fileName = normalized.slice(normalized.lastIndexOf('/') + 1)
  const segments = fileName.split('.')
  if (segments.length > 2 || !segments[0] || (segments.length === 2 && !segments[1])) {
    throw new ConfigFormModuleRegistryError(
      'CONFIG_FORM_MODULE_SOURCE_INVALID',
      `ConfigForm module source must use a single <name>.<extension> filename: ${source}`,
      { source },
    )
  }
  return segments[0]
}

function compareEntries<TValue>(
  left: ConfigFormNamedRegistryEntry<TValue>,
  right: ConfigFormNamedRegistryEntry<TValue>,
): number {
  const orderDifference = (left.order ?? Number.MAX_SAFE_INTEGER) - (right.order ?? Number.MAX_SAFE_INTEGER)
  if (orderDifference !== 0)
    return orderDifference

  return left.name.localeCompare(right.name) || left.source.localeCompare(right.source)
}
