import type {
  ConfigFormReactionProjection,
  ConfigFormScopedFieldDefinition,
  ConfigFormValueScopeStore,
} from '@moluoxixi/config-form-core'
import type { Component } from 'vue'
import type {
  ConfigFormControllerDiagnostic,
  ConfigFormLifecycleInput,
  ConfigFormLifecycleKind,
} from './lifecycle'
import type { ConfigFormMeta } from './meta'
import type { ConfigFormResolvedFieldState } from './node'
import type {
  ConfigFormErrors,
  ConfigFormNode,
  ConfigFormValues,
} from './props'
import type {
  ConfigFormFieldAddress,
  ConfigFormFieldInstance,
  ConfigFormValidationIssue,
  ConfigFormValueSchema,
} from './scope'

export type ControllerNode<TValues extends ConfigFormValues> = ConfigFormNode<
  TValues,
  Component | string,
  unknown,
  unknown
>

export type ControllerFieldState<TValues extends ConfigFormValues> = ConfigFormResolvedFieldState<
  TValues,
  unknown,
  unknown
> & {
  address: ConfigFormFieldAddress
  instanceKey: string
  valuePath: readonly (number | string)[]
}

export interface ControllerValidationResult<TValues extends ConfigFormValues> {
  issues: readonly ConfigFormValidationIssue[]
  states: ControllerFieldState<TValues>[]
  status: 'invalid' | 'stale' | 'valid'
}

export interface ControllerMetaService {
  clearTouched: (instanceKeys?: readonly string[]) => void
  commitMeta: () => ConfigFormMeta
  getFieldMeta: (instanceKey: string) => ConfigFormMeta['fields'][string]
  getMeta: () => ConfigFormMeta
  recaptureBaseline: () => void
  reconcileInstances: (instances: readonly ConfigFormFieldInstance[]) => void
  refreshSchema: (
    instances: readonly ConfigFormFieldInstance[],
    previousKeys: ReadonlyMap<string, string>,
    defaults: ReadonlyMap<string, unknown>,
    previousInstanceKeys: ReadonlySet<string>,
  ) => void
  refreshMeta: () => ConfigFormMeta
  setTouched: (instanceKeys: readonly string[], touched?: boolean) => void
}

export type ControllerFieldStateResolver<TValues extends ConfigFormValues> = (
  values: TValues,
  projection?: ConfigFormReactionProjection<TValues>,
) => ControllerFieldState<TValues>[]

export interface ControllerResetServiceOptions<TValues extends ConfigFormValues> {
  beginReset: () => void
  clearTouched: (fields?: string[]) => void
  commitValues: (values: TValues, fieldsToClear?: string[], notifyValuesChange?: boolean) => void
  createResetValues: () => TValues
  readValues: () => TValues
  runLifecycle: (kind: ConfigFormLifecycleKind, input?: ConfigFormLifecycleInput<TValues>) => Promise<boolean>
}

export interface ControllerSubmitServiceOptions<TValues extends ConfigFormValues> {
  getErrors: () => ConfigFormErrors
  getFieldStates: ControllerFieldStateResolver<TValues>
  hasLifecycle: (kind: ConfigFormLifecycleKind) => boolean
  getValues: () => TValues
  isActive: () => boolean
  getOperationToken: () => object
  isOperationCurrent: (token: object) => boolean
  onError?: (errors: ConfigFormErrors) => void
  onSubmit?: (values: TValues) => unknown | Promise<unknown>
  readValues: () => TValues
  reportDiagnostic: (diagnostic: ConfigFormControllerDiagnostic) => void
  runLifecycle: (kind: ConfigFormLifecycleKind, input?: ConfigFormLifecycleInput<TValues>) => Promise<boolean>
  scoped: boolean
  setTouched: (instanceKeys: readonly string[]) => void
  validateValues: (values: TValues) => Promise<ControllerValidationResult<TValues>>
}

export type ControllerReset = (fields?: string | string[]) => Promise<boolean>

export interface ControllerScopeService {
  definitions: readonly ConfigFormScopedFieldDefinition[]
  getDefinition: (nodeId: string) => ConfigFormScopedFieldDefinition
  getInstance: (address: ConfigFormFieldAddress) => ConfigFormFieldInstance
  getInstanceKey: (address: ConfigFormFieldAddress) => string
  getRootDefinition: (field: string) => ConfigFormScopedFieldDefinition | undefined
  listInstances: (nodeId?: string) => ConfigFormFieldInstance[]
  listRowIds: (scopeIds?: ReadonlySet<string>) => Map<string, string[]>
  schema: ConfigFormValueSchema
  store: ConfigFormValueScopeStore
}
