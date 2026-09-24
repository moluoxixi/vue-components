import type {
  ConfigFormJsonObject,
  ConfigFormJsonValue,
  ConfigFormScopedFieldDefinition,
  ConfigFormScopePath,
  ConfigFormValueScopeDefinition,
} from '@moluoxixi/config-form-core'

/** JSON-safe value ownership declared by a component/container node. */
export type ConfigFormNodeValueScope = Omit<
  ConfigFormValueScopeDefinition,
  'nodeId' | 'parentId'
>

/** Compiler-ready value topology accepted by the Headless controller. */
export interface ConfigFormValueSchema {
  valueScopes: readonly ConfigFormValueScopeDefinition[]
  scopedFields: readonly ConfigFormScopedFieldDefinition[]
}

/** Stable field identity: a schema node plus its outer-to-inner array row chain. */
export interface ConfigFormFieldAddress {
  nodeId: string
  scope: ConfigFormScopePath
}

export interface ConfigFormFieldInstance {
  address: ConfigFormFieldAddress
  field: string
  instanceKey: string
  ownerScopeId?: string
  value: ConfigFormJsonValue | undefined
  valuePath: readonly (number | string)[]
}

export interface ConfigFormFieldInstanceChangeRequest {
  address: ConfigFormFieldAddress
  value: ConfigFormJsonValue
}

export interface ConfigFormValidationIssue {
  address: ConfigFormFieldAddress
  code: string
  instanceKey: string
  message: string
  nodeId: string
  scope: ConfigFormScopePath
  valuePath: readonly (number | string)[]
}

export interface ConfigFormFieldRuleIssue {
  code: string
  message: string
}

/** Public atomic value patch; instance operations use stable row identity. */
export type ConfigFormValuePatchInstance = {
  address: ConfigFormFieldAddress
} & ({ value: ConfigFormJsonValue, remove?: false } | { remove: true, value?: never })

export interface ConfigFormValuePatch {
  set?: ConfigFormJsonObject
  remove?: readonly string[]
  instances?: readonly ConfigFormValuePatchInstance[]
}
