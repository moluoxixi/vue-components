import type { ConfigFormJsonObject, ConfigFormJsonValue } from '../../json'

export interface ConfigFormValueScopeDefinition {
  nodeId: string
  field: string
  parentId?: string
  kind: 'object' | 'array'
  itemKey?: string
  minItems?: number
  maxItems?: number
}

export interface ConfigFormScopedFieldDefinition {
  nodeId: string
  field: string
  scopeId?: string
  defaultValue?: ConfigFormJsonValue
}

export interface ConfigFormScopePathEntry {
  scopeId: string
  rowId: string
}

/** Array row identities from the outermost array scope to the current row. */
export type ConfigFormScopePath = readonly ConfigFormScopePathEntry[]
export type ConfigFormScopeSelector = 'current' | 'parent' | 'root'

export interface ConfigFormValueScopeRowIdFactoryContext {
  scopeId: string
  parentScope: ConfigFormScopePath
  /** Zero-based retry number when a factory returns an already reserved ID. */
  attempt: number
}

export type ConfigFormValueScopeRowIdFactory = (
  context: ConfigFormValueScopeRowIdFactoryContext,
) => string

export interface CreateConfigFormValueScopeStoreOptions {
  scopes: readonly ConfigFormValueScopeDefinition[]
  fields: readonly ConfigFormScopedFieldDefinition[]
  values?: ConfigFormJsonObject
  createRowId?: ConfigFormValueScopeRowIdFactory
}

export interface ConfigFormValueScopeRow {
  rowId: string
  index: number
  /** Full scope including this row. */
  scope: ConfigFormScopePath
  value: ConfigFormJsonObject
}

export type ConfigFormValueScopePatchInstance = {
  nodeId: string
  scope: ConfigFormScopePath
} & ({ value: ConfigFormJsonValue, remove?: false } | { remove: true, value?: never })

/** Host-observed rows in an array whose reference has not been replaced. */
export interface ConfigFormValueScopeRetainedArray {
  scopeId: string
  parentScope: ConfigFormScopePath
  valuePath: readonly (number | string)[]
  rowIds: readonly (string | null)[]
}

/** One validated root and stable-address value operation. */
export interface ConfigFormValueScopePatch {
  set?: ConfigFormJsonObject
  remove?: readonly string[]
  instances?: readonly ConfigFormValueScopePatchInstance[]
}

export interface ConfigFormValueScopeMutationResult {
  /** Current natural JSON path affected by the mutation. */
  path: readonly (number | string)[]
  /** Defensive snapshot after the mutation. */
  values: ConfigFormJsonObject
  /** Row scopes that no longer resolve and whose owned work should be cancelled. */
  invalidatedScopes: readonly ConfigFormScopePath[]
}

export interface ConfigFormValueScopeRowMutationResult extends ConfigFormValueScopeMutationResult {
  row: ConfigFormValueScopeRow
}

export interface ConfigFormValueScopeRemoveResult extends ConfigFormValueScopeMutationResult {
  removedRow: ConfigFormValueScopeRow
}

export type ConfigFormValueScopeTransaction = <T>(
  operation: (store: ConfigFormValueScopeStore) => T,
) => T

export interface ConfigFormValueScopeStore {
  getValues: () => ConfigFormJsonObject
  replaceValues: (values: ConfigFormJsonObject, retainedArrays?: readonly ConfigFormValueScopeRetainedArray[]) => ConfigFormValueScopeMutationResult
  /** Atomically apply root keys and stable field-address writes. */
  applyPatch: (patch: ConfigFormValueScopePatch) => ConfigFormValueScopeMutationResult
  /** Run several candidate mutations and publish their values/metadata together. */
  transaction: ConfigFormValueScopeTransaction
  /** Atomically patch root properties; untouched subtrees retain their row identities. */
  patchValues: (values: ConfigFormJsonObject, removeFields?: readonly string[]) => ConfigFormValueScopeMutationResult
  getValue: (nodeId: string, scope?: ConfigFormScopePath) => ConfigFormJsonValue | undefined
  setValue: (
    nodeId: string,
    value: ConfigFormJsonValue,
    scope?: ConfigFormScopePath,
  ) => ConfigFormValueScopeMutationResult
  resolvePath: (nodeId: string, scope?: ConfigFormScopePath) => readonly (number | string)[]
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
}
