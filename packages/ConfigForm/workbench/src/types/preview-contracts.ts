import type { ConfigFormValueScopeDefinition } from '@moluoxixi/config-form-core'

/**
 * Field and scope contracts shared by the Session and Runtime Host features.
 *
 * These describe how a compiled page projects onto runtime field instances, and
 * are consumed by both preview session orchestration and the Runtime Host
 * protocol bridge, so they live outside either feature to keep the dependency
 * graph acyclic.
 */
export interface PreviewScopeContract {
  definition: ConfigFormValueScopeDefinition
  signature: string
}

export interface PreviewFieldContract {
  field: string
  signature: string
  scopes: readonly ConfigFormValueScopeDefinition[]
  defaultValue?: unknown
}

export interface PreviewFieldContracts {
  fields: Record<string, PreviewFieldContract>
  scopes: readonly PreviewScopeContract[]
}
