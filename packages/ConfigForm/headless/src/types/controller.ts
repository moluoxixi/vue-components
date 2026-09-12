import type {
  ConfigFormJsonObject,
  ConfigFormJsonValue,
  ConfigFormReactionProjection,
  ConfigFormScopePath,
  ConfigFormValueScopeRemoveResult,
  ConfigFormValueScopeRow,
  ConfigFormValueScopeRowIdFactory,
  ConfigFormValueScopeRowMutationResult,
} from '@moluoxixi/config-form-core'
import type { Component } from 'vue'
import type {
  ConfigFormFieldChangePayload,
  ConfigFormFieldChangeRequest,
} from './emits'
import type {
  ConfigFormControllerDiagnostic,
  ConfigFormLifecycleHook,
  ConfigFormLifecycleInput,
  ConfigFormLifecycleKind,
} from './lifecycle'
import type { ConfigFormFieldMeta, ConfigFormMeta } from './meta'
import type {
  ConfigFormAttrs,
  ConfigFormCondition,
  ConfigFormErrors,
  ConfigFormFieldKey,
  ConfigFormNode,
  ConfigFormValidateTrigger,
  ConfigFormValues,
} from './props'
import type {
  ConfigFormFieldAddress,
  ConfigFormFieldInstance,
  ConfigFormFieldInstanceChangeRequest,
  ConfigFormValuePatch,
  ConfigFormValidationIssue,
  ConfigFormValueSchema,
} from './scope'

export interface ConfigFormModelAdapter<TValues extends ConfigFormValues = ConfigFormValues> {
  /** Controller operations always read the latest host model, including reactive replacements. */
  read: () => TValues
  /** Synchronously commit the complete next model. read() must see it before write() returns. */
  write: (values: TValues) => void
}

export interface ConfigFormControllerOptions<TValues extends ConfigFormValues = ConfigFormValues> {
  /** Minimal host model adapter, independent of Vue refs or a state library. */
  model: ConfigFormModelAdapter<TValues>
  /** Read the current node tree for validation, reset, reactions, and submit. */
  fields?: () => ConfigFormNode<TValues, Component | string, unknown, unknown>[]
  /** Compiler-provided topology. When omitted, a topology is derived from component valueScope nodes. */
  valueSchema?: ConfigFormValueSchema
  /** Optional deterministic row identity factory for hosts and tests. */
  createRowId?: ConfigFormValueScopeRowIdFactory
  /** Explicit reset baseline; otherwise the controller captures the first model and field defaults. */
  defaultValues?: Partial<TValues>
  /** Read the current form-level readonly condition. */
  readonly?: () => ConfigFormCondition<TValues> | undefined
  /** Host Flow state overlays participate in the same validation and submission policy. */
  reactionStates?: () => ConfigFormReactionProjection<TValues>['states'] | undefined
  /** Lets adapters skip an async hook round-trip when a lifecycle has no subscriber. */
  shouldRunLifecycle?: (kind: ConfigFormLifecycleKind) => boolean
  onFieldChange?: (payload: ConfigFormFieldChangePayload<TValues>) => void
  onChange?: (values: TValues) => void
  onErrorsChange?: (errors: ConfigFormErrors) => void
  onIssuesChange?: (issues: readonly ConfigFormValidationIssue[]) => void
  onValidatingChange?: (validating: boolean) => void
  onMetaChange?: (meta: ConfigFormMeta) => void
  onLifecycle?: ConfigFormLifecycleHook<TValues>
  onDiagnostic?: (diagnostic: ConfigFormControllerDiagnostic) => void
  onSubmit?: (values: TValues) => unknown | Promise<unknown>
  onError?: (errors: ConfigFormErrors) => void
}

export type ConfigFormFieldValue<
  TValues extends ConfigFormValues,
  TField extends string,
> = TField extends ConfigFormFieldKey<TValues> ? TValues[TField] : unknown

export type ConfigFormFieldSelector<TValues extends ConfigFormValues>
  = | ConfigFormFieldKey<TValues>
    | string
    | Array<ConfigFormFieldKey<TValues> | string>

export interface ConfigFormController<TValues extends ConfigFormValues = ConfigFormValues> {
  /** Root-field component write path retained for flat renderers. */
  applyFieldChange: (request: ConfigFormFieldChangeRequest<TValues>) => void
  /** Exact component write path for object/array field instances. */
  applyFieldInstanceChange: (request: ConfigFormFieldInstanceChangeRequest) => void
  getValues: () => TValues
  getMeta: () => ConfigFormMeta
  getFieldMeta: (field: ConfigFormFieldKey<TValues> | string) => ConfigFormFieldMeta
  getInstanceMeta: (address: ConfigFormFieldAddress) => ConfigFormFieldMeta
  refreshMeta: () => ConfigFormMeta
  refreshReactions: () => void
  /** Atomically refresh value definitions; omitted schema is derived from the current fields. */
  updateValueSchema: (schema?: ConfigFormValueSchema) => void
  runLifecycle: (
    kind: ConfigFormLifecycleKind,
    input?: ConfigFormLifecycleInput<TValues>,
  ) => Promise<boolean>
  getValue: <TField extends string>(field: TField) => ConfigFormFieldValue<TValues, TField>
  getInstanceValue: (address: ConfigFormFieldAddress) => ConfigFormJsonValue | undefined
  getInstanceKey: (address: ConfigFormFieldAddress) => string
  listFieldInstances: (nodeId?: string) => readonly ConfigFormFieldInstance[]
  getErrors: () => ConfigFormErrors
  getIssues: () => readonly ConfigFormValidationIssue[]
  getInstanceErrors: (address: ConfigFormFieldAddress) => string[]
  getReactionProps: (field: ConfigFormFieldKey<TValues> | string) => ConfigFormAttrs
  getReactionState: (
    field: ConfigFormFieldKey<TValues> | string,
  ) => Partial<Record<'disabled' | 'readonly' | 'required' | 'visible', boolean>>
  getInstanceReactionProps: (address: ConfigFormFieldAddress) => ConfigFormAttrs
  getInstanceReactionState: (
    address: ConfigFormFieldAddress,
  ) => Partial<Record<'disabled' | 'readonly' | 'required' | 'visible', boolean>>
  getValidating: () => boolean
  isFieldValidating: (field: ConfigFormFieldKey<TValues> | string) => boolean
  applyValuePatch: (patch: ConfigFormValuePatch) => void
  isInstanceValidating: (address: ConfigFormFieldAddress) => boolean
  setValue: <TField extends string>(
    field: TField,
    value: ConfigFormFieldValue<TValues, NoInfer<TField>>,
  ) => void
  setInstanceValue: (address: ConfigFormFieldAddress, value: ConfigFormJsonValue) => void
  setValues: {
    (values: Partial<TValues>, replace?: false): void
    (values: TValues, replace: true): void
  }
  validate: () => Promise<boolean>
  validateField: (
    field: ConfigFormFieldKey<TValues> | string,
    trigger?: ConfigFormValidateTrigger,
  ) => Promise<boolean>
  validateInstance: (
    address: ConfigFormFieldAddress,
    trigger?: ConfigFormValidateTrigger,
  ) => Promise<boolean>
  clearValidate: (fields?: ConfigFormFieldSelector<TValues>) => void
  clearInstanceValidate: (addresses: ConfigFormFieldAddress | readonly ConfigFormFieldAddress[]) => void
  setErrors: (errors: ConfigFormErrors) => void
  setTouched: {
    (): void
    (touched: boolean): void
    (fields: ConfigFormFieldSelector<TValues>, touched?: boolean): void
  }
  setInstanceTouched: (address: ConfigFormFieldAddress, touched?: boolean) => void
  resetFields: (fields?: ConfigFormFieldSelector<TValues>) => Promise<boolean>
  listRows: (scopeId: string, parentScope?: ConfigFormScopePath) => readonly ConfigFormValueScopeRow[]
  appendRow: (
    scopeId: string,
    value?: ConfigFormJsonObject,
    parentScope?: ConfigFormScopePath,
  ) => ConfigFormValueScopeRowMutationResult
  insertRow: (
    scopeId: string,
    index: number,
    value?: ConfigFormJsonObject,
    parentScope?: ConfigFormScopePath,
  ) => ConfigFormValueScopeRowMutationResult
  duplicateRow: (
    scopeId: string,
    rowId: string,
    parentScope?: ConfigFormScopePath,
  ) => ConfigFormValueScopeRowMutationResult
  removeRow: (
    scopeId: string,
    rowId: string,
    parentScope?: ConfigFormScopePath,
  ) => ConfigFormValueScopeRemoveResult
  moveRow: (
    scopeId: string,
    rowId: string,
    toIndex: number,
    parentScope?: ConfigFormScopePath,
  ) => ConfigFormValueScopeRowMutationResult
  submit: () => Promise<boolean>
  dispose: () => void
}
