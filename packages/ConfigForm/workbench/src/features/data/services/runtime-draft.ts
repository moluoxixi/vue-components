import type {
  ConfigFormDataSourceDefinition,
  ConfigFormJsonValue,
  ConfigFormPageRuntimeConfiguration,
  ConfigFormValueInput,
  ConfigFormVariableDefinition,
} from '@moluoxixi/config-form-core'
import type { DataCommandDiagnostic } from '../types'
import {
  getConfigFormJsonSemanticHash,
} from '@moluoxixi/config-form-core'
import {
  configFormDataSourceDefinitionSchema,
  configFormPageRuntimeConfigurationSchema,
} from '@moluoxixi/config-form-model'
import { cloneWorkbenchJson } from '../../../utils'

const HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
const RESPONSE_TYPES = new Set(['json', 'text'])
export const DATA_SOURCE_EDITOR_MAX_DURATION_MS = 2_147_483_647
let fallbackIdentitySequence = 0

export function createEmptyRuntimeDraft(): ConfigFormPageRuntimeConfiguration {
  return { dataSources: [], variables: [] }
}

export function cloneRuntimeDraft(
  runtime?: ConfigFormPageRuntimeConfiguration,
): ConfigFormPageRuntimeConfiguration {
  return cloneWorkbenchJson(runtime ?? createEmptyRuntimeDraft())
}

export function runtimeDraftHash(runtime?: ConfigFormPageRuntimeConfiguration): string {
  return getConfigFormJsonSemanticHash(
    (runtime ?? createEmptyRuntimeDraft()) as unknown as ConfigFormJsonValue,
  )
}

export function createVariableDraft(
  runtime: ConfigFormPageRuntimeConfiguration,
): ConfigFormVariableDefinition {
  return {
    id: createIdentity('variable', runtime),
    initialValue: null,
    name: nextName('Variable', runtime.variables.map(item => item.name)),
  }
}

export function createDataSourceDraft(
  runtime: ConfigFormPageRuntimeConfiguration,
): ConfigFormDataSourceDefinition {
  return {
    auto: false,
    cacheTtlMs: 0,
    id: createIdentity('source', runtime),
    name: nextName('Data source', runtime.dataSources.map(item => item.name)),
    request: {
      method: 'GET',
      responseType: 'json',
      url: '',
    },
    timeoutMs: 10_000,
  }
}

export function validateRuntimeDraft(
  runtime: ConfigFormPageRuntimeConfiguration,
): DataCommandDiagnostic[] {
  const diagnostics: DataCommandDiagnostic[] = []
  runtime.dataSources.forEach((source, index) => {
    diagnostics.push(...validateDataSourceRequiredValues(source, ['dataSources', index]))
  })
  const parsed = configFormPageRuntimeConfigurationSchema.safeParse(runtime)
  if (!parsed.success) {
    diagnostics.push(...parsed.error.issues.map(issue => ({
      code: 'DATA_RUNTIME_INVALID',
      message: issue.message,
      path: issue.path as Array<string | number>,
    })))
  }
  return deduplicateDiagnostics(diagnostics)
}

export function validateDataSourceDraft(
  source: ConfigFormDataSourceDefinition,
): DataCommandDiagnostic[] {
  const diagnostics = validateDataSourceRequiredValues(source, ['dataSources', 0])
  const parsed = configFormDataSourceDefinitionSchema.safeParse(source)
  if (!parsed.success) {
    diagnostics.push(...parsed.error.issues.map(issue => ({
      code: 'DATA_SOURCE_INVALID',
      message: issue.message,
      path: ['dataSources', 0, ...(issue.path as Array<string | number>)],
    })))
  }
  return deduplicateDiagnostics(diagnostics)
}

export function toPersistedRuntime(
  runtime: ConfigFormPageRuntimeConfiguration,
): ConfigFormPageRuntimeConfiguration | undefined {
  const parsed = configFormPageRuntimeConfigurationSchema.safeParse(runtime)
  if (!parsed.success)
    throw new TypeError(parsed.error.issues[0]?.message ?? 'Page runtime configuration is invalid.')
  if (parsed.data.variables.length === 0 && parsed.data.dataSources.length === 0)
    return undefined
  return cloneWorkbenchJson(parsed.data)
}

export function isMissingRequiredValue(value: ConfigFormValueInput | undefined): boolean {
  if (value === undefined)
    return true
  const literal = readFixedValue(value)
  if (!literal.fixed)
    return false
  if (typeof literal.value === 'string')
    return literal.value.trim().length === 0
  return literal.value === undefined
}

function validateDataSourceRequiredValues(
  source: ConfigFormDataSourceDefinition,
  sourcePath: Array<string | number>,
): DataCommandDiagnostic[] {
  const diagnostics: DataCommandDiagnostic[] = []
  if (isMissingRequiredValue(source.request.url)) {
    diagnostics.push({
      code: 'DATA_SOURCE_URL_REQUIRED',
      message: 'Data source URL is required.',
      path: [...sourcePath, 'request', 'url'],
    })
  }
  validateFixedOption(source.request.method, HTTP_METHODS, 'HTTP method', [...sourcePath, 'request', 'method'], diagnostics)
  validateFixedOption(source.request.responseType, RESPONSE_TYPES, 'Response type', [...sourcePath, 'request', 'responseType'], diagnostics)
  validateFixedObject(source.request.headers, 'Headers', [...sourcePath, 'request', 'headers'], diagnostics)
  validateFixedObject(source.request.query, 'Query', [...sourcePath, 'request', 'query'], diagnostics)
  ;(['timeoutMs', 'cacheTtlMs'] as const).forEach((key) => {
    const value = source[key]
    if (value !== undefined && (!Number.isInteger(value) || value < 0 || value > DATA_SOURCE_EDITOR_MAX_DURATION_MS)) {
      diagnostics.push({
        code: 'DATA_SOURCE_DURATION_INVALID',
        message: 'Duration must be an integer from 0 through 2147483647.',
        path: [...sourcePath, key],
      })
    }
  })
  return diagnostics
}

function validateFixedOption(
  input: ConfigFormValueInput | undefined,
  allowed: ReadonlySet<string>,
  label: string,
  path: Array<string | number>,
  diagnostics: DataCommandDiagnostic[],
): void {
  if (input === undefined)
    return
  const value = readFixedValue(input)
  if (value.fixed && (typeof value.value !== 'string' || !allowed.has(value.value))) {
    diagnostics.push({
      code: 'DATA_SOURCE_OPTION_INVALID',
      message: `${label} has an invalid fixed value.`,
      path,
    })
  }
}

function validateFixedObject(
  input: ConfigFormValueInput | undefined,
  label: string,
  path: Array<string | number>,
  diagnostics: DataCommandDiagnostic[],
): void {
  if (input === undefined)
    return
  const value = readFixedValue(input)
  if (value.fixed && !isPlainRecord(value.value)) {
    diagnostics.push({
      code: 'DATA_SOURCE_OBJECT_INVALID',
      message: `${label} must resolve from an object or a dynamic reference.`,
      path,
    })
  }
}

function readFixedValue(input: ConfigFormValueInput): { fixed: boolean, value?: unknown } {
  if (!isPlainRecord(input) || !Object.hasOwn(input, '$ref'))
    return { fixed: true, value: input }
  const reference = input.$ref
  if (isPlainRecord(reference) && reference.kind === 'literal' && Object.hasOwn(reference, 'value'))
    return { fixed: true, value: reference.value }
  return { fixed: false }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function createIdentity(
  kind: 'source' | 'variable',
  runtime: ConfigFormPageRuntimeConfiguration,
): string {
  const existing = new Set([
    ...runtime.variables.map(item => item.id),
    ...runtime.dataSources.map(item => item.id),
  ])
  do {
    const random = typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(36)}-${++fallbackIdentitySequence}`
    const candidate = `${kind}-${random}`
    if (!existing.has(candidate))
      return candidate
  } while (true)
}

function nextName(prefix: string, names: readonly string[]): string {
  const existing = new Set(names.map(name => name.trim().toLocaleLowerCase()))
  let index = names.length + 1
  while (existing.has(`${prefix} ${index}`.toLocaleLowerCase()))
    index += 1
  return `${prefix} ${index}`
}

function deduplicateDiagnostics(
  diagnostics: readonly DataCommandDiagnostic[],
): DataCommandDiagnostic[] {
  const keys = new Set<string>()
  return diagnostics.filter((diagnostic) => {
    const key = `${diagnostic.code}:${JSON.stringify(diagnostic.path)}:${diagnostic.message}`
    if (keys.has(key))
      return false
    keys.add(key)
    return true
  })
}
