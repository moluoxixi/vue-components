import type { ConfigFormJsonPrimitive, ConfigFormJsonValue } from '../../json'

export type ConfigFormValueReferenceScope = 'current' | 'parent' | 'root'

export type ConfigFormValueReference
  = | { kind: 'literal', value: ConfigFormJsonValue }
    | { kind: 'field', nodeId: string, scope?: ConfigFormValueReferenceScope }
    | { kind: 'variable', variableId: string }
    /** Data payload supplied while mapping a Data Source response. */
    | { kind: 'event', path: string[] }
    | { kind: 'expression', source: string }

export interface ConfigFormValueReferenceWrapper {
  $ref: ConfigFormValueReference
}

export type ConfigFormValueInput
  = | ConfigFormJsonPrimitive
    | ConfigFormValueReferenceWrapper
    | ConfigFormValueInput[]
    | { [key: string]: ConfigFormValueInput }

export interface ConfigFormFieldResolution {
  found: boolean
  value?: unknown
}

export interface ConfigFormValueContext {
  fields?: Readonly<Record<string, unknown>>
  variables?: Readonly<Record<string, unknown>>
  /** Current Data Source response payload; unrelated to component event forwarding. */
  event?: unknown
  resolveField?: (
    nodeId: string,
    scope: ConfigFormValueReferenceScope,
  ) => ConfigFormFieldResolution
}

export type ConfigFormValueReferenceCollectionEntry
  = | { kind: 'field', id: string, scope: ConfigFormValueReferenceScope, path: string }
    | { kind: 'variable', id: string, path: string }

export type ConfigFormValueReferenceIdMap
  = | ReadonlyMap<string, string>
    | Readonly<Record<string, string>>

export interface ConfigFormValueReferenceRemap {
  fields?: ConfigFormValueReferenceIdMap
  variables?: ConfigFormValueReferenceIdMap
}
