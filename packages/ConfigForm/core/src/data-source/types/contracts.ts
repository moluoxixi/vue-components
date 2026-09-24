import type { ConfigFormJsonValue } from '../../json'
import type { ConfigFormValueContext, ConfigFormValueInput } from '../../value-reference'

export interface ConfigFormVariableDefinition {
  id: string
  name: string
  initialValue: ConfigFormValueInput
}

export interface ConfigFormDataSourceRequestDefinition {
  url: ConfigFormValueInput
  method?: ConfigFormValueInput
  headers?: ConfigFormValueInput
  query?: ConfigFormValueInput
  body?: ConfigFormValueInput
  responseType?: ConfigFormValueInput
}

export interface ConfigFormDataSourceDefinition {
  id: string
  name: string
  request: ConfigFormDataSourceRequestDefinition
  mapping?: ConfigFormValueInput
  dependencies?: ConfigFormValueInput[]
  auto?: boolean
  timeoutMs?: number
  cacheTtlMs?: number
}

export interface ConfigFormSurfaceRuntimeConfiguration {
  variables: ConfigFormVariableDefinition[]
  dataSources: ConfigFormDataSourceDefinition[]
}

export type ConfigFormDataSourceStatus = 'idle' | 'loading' | 'success' | 'empty' | 'error'

export interface ConfigFormDataSourceDiagnostic {
  code: string
  message: string
  path?: string
}

export interface ConfigFormDataSourceState {
  sourceId: string
  scopeKey?: string
  status: ConfigFormDataSourceStatus
  data?: unknown
  error?: ConfigFormDataSourceDiagnostic
  runId?: string
  startedAt?: number
  finishedAt?: number
}

export interface ConfigFormDataSourceHttpRequestInput {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  headers?: Record<string, string>
  query?: Record<string, string | number | boolean>
  body?: ConfigFormJsonValue
  responseType?: 'json' | 'text'
}

export interface ConfigFormDataSourceHttpRequestOutput {
  status: number
  ok: boolean
  data: unknown
}

export interface ConfigFormDataSourceHost {
  request?: (
    input: ConfigFormDataSourceHttpRequestInput,
    signal: AbortSignal,
  ) => Promise<ConfigFormDataSourceHttpRequestOutput>
}

export interface ConfigFormDataSourceLoadOptions {
  scopeKey?: string
  context?: ConfigFormValueContext
  /** Per-consumer ValueInput parameters merged into the resolved request query. */
  params?: Readonly<Record<string, ConfigFormValueInput>>
  force?: boolean
  signal?: AbortSignal
}

export interface ConfigFormDataSourceRuntimeOptions {
  sources: readonly ConfigFormDataSourceDefinition[]
  host: ConfigFormDataSourceHost
  readContext?: () => ConfigFormValueContext
  onState?: (state: ConfigFormDataSourceState) => void
  maxEntries?: number
}

export interface ConfigFormDataSourceRuntime {
  load: (
    sourceId: string,
    options?: ConfigFormDataSourceLoadOptions,
  ) => Promise<ConfigFormDataSourceState>
  getState: (sourceId: string, scopeKey?: string) => ConfigFormDataSourceState
  invalidate: (sourceId?: string, scopeKey?: string) => void
  reset: (sourceId?: string, scopeKey?: string) => void
  dispose: () => void
}
