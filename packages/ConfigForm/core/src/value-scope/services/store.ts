import type { ConfigFormJsonObject, ConfigFormJsonValue } from '../../json'
import type {
  ConfigFormScopedFieldDefinition,
  ConfigFormScopePath,
  ConfigFormScopePathEntry,
  ConfigFormScopeSelector,
  ConfigFormValueScopeDefinition,
  ConfigFormValueScopeMutationResult,
  ConfigFormValueScopePatch,
  ConfigFormValueScopeRemoveResult,
  ConfigFormValueScopeRetainedArray,
  ConfigFormValueScopeRow,
  ConfigFormValueScopeRowIdFactory,
  ConfigFormValueScopeRowMutationResult,
  ConfigFormValueScopeStore,
  CreateConfigFormValueScopeStoreOptions,
} from '../types'
import { cloneConfigFormJsonValue } from '../../json'

export const CONFIG_FORM_VALUE_SCOPE_MAX_DEPTH = 32
export const CONFIG_FORM_VALUE_SCOPE_MAX_ENTRIES = 10_000
export const CONFIG_FORM_VALUE_SCOPE_ROW_ID_ATTEMPTS = 100

const UNSAFE_KEYS = new Set(['__proto__', 'prototype', 'constructor'])
const ROOT_OWNER = '$root'

interface ScopeNode {
  definition: ConfigFormValueScopeDefinition
  index: number
  parent?: ScopeNode
  children: ScopeNode[]
  fields: FieldNode[]
  chain: ScopeNode[]
}

interface FieldNode {
  definition: ConfigFormScopedFieldDefinition
  index: number
  owner?: ScopeNode
}

interface ValueScopeSchema {
  scopeById: Map<string, ScopeNode>
  fieldById: Map<string, FieldNode>
  rootScopes: ScopeNode[]
  rootFields: FieldNode[]
}

interface RowMetadata {
  rowId: string
}

interface ArrayInstanceMetadata {
  scopeId: string
  parentScope: ConfigFormScopePathEntry[]
  rows: RowMetadata[]
}

type MetadataMap = Map<string, ArrayInstanceMetadata>

interface RowIdTransaction {
  stagedIds: Set<string>
}

interface SuppressedDefault {
  nodeId: string
  scope: ConfigFormScopePath
}

interface LocatedContainer {
  container: ConfigFormJsonObject
  path: (number | string)[]
  scope: ConfigFormScopePathEntry[]
}

interface LocatedArray {
  array: ConfigFormJsonObject[]
  instance: ArrayInstanceMetadata
  parentScope: ConfigFormScopePathEntry[]
  path: (number | string)[]
  scope: ScopeNode
}

export class ConfigFormValueScopeError<
  TContext extends Record<string, unknown> = Record<string, unknown>,
> extends Error {
  readonly code: string
  readonly path?: string
  readonly context: TContext

  constructor(code: string, message: string, path?: string, context: TContext = {} as TContext) {
    super(message)
    Object.setPrototypeOf(this, new.target.prototype)
    this.name = new.target.name
    this.code = code
    this.path = path
    this.context = context
  }
}

/** Produce a collision-safe key for field/runtime state owned by one row chain. */
export function getConfigFormValueScopeInstanceKey(
  nodeId: string,
  scope: ConfigFormScopePath = [],
): string {
  return JSON.stringify([nodeId, ...scope.map(entry => [entry.scopeId, entry.rowId])])
}

/** Select the current array row chain, its immediate array parent, or root. */
export function selectConfigFormScopePath(
  scope: ConfigFormScopePath,
  selector: ConfigFormScopeSelector,
): ConfigFormScopePath {
  if (selector === 'root')
    return []
  const end = selector === 'parent' ? Math.max(0, scope.length - 1) : scope.length
  return cloneScopePath(scope.slice(0, end))
}

export function createConfigFormValueScopeStore(
  options: CreateConfigFormValueScopeStoreOptions,
): ConfigFormValueScopeStore {
  return new ValueScopeStore(options)
}

class ValueScopeStore implements ConfigFormValueScopeStore {
  private readonly schema: ValueScopeSchema
  private readonly createRowId: ConfigFormValueScopeRowIdFactory
  private readonly reservedRowIds = new Set<string>()
  private suppressedDefaults = new Map<string, SuppressedDefault>()
  private metadata: MetadataMap
  private values: ConfigFormJsonObject
  constructor(options: CreateConfigFormValueScopeStoreOptions) {
    assertOptions(options)
    this.schema = createSchema(options.scopes, options.fields)
    let nextDefaultRowId = 0
    this.createRowId = options.createRowId ?? (() => `row-${++nextDefaultRowId}`)

    const values = this.normalizeValues(options.values === undefined ? {} : options.values)
    const metadata: MetadataMap = new Map()
    const transaction = this.createTransaction()
    this.buildFreshContainerMetadata(values, this.schema.rootScopes, [], metadata, transaction)
    this.assertMetadata(values, metadata)
    this.values = values
    this.metadata = metadata
    this.commitIds(transaction)
  }

  getValues(): ConfigFormJsonObject {
    return cloneJsonSnapshot(this.values)
  }

  replaceValues(values: ConfigFormJsonObject, retainedArrays: readonly ConfigFormValueScopeRetainedArray[] = []): ConfigFormValueScopeMutationResult {
    const retained = new Map<string, { instanceKey: string, rowIds: readonly (string | null)[] }>()
    cloneCheckedJson(retainedArrays, 'retainedArrays').forEach((entry) => {
      const previous = this.locateArray(entry.scopeId, entry.parentScope, this.values, this.metadata)
      if (!Array.isArray(entry.valuePath) || !Array.isArray(entry.rowIds) || entry.rowIds.length === 0)
        throw metadataError('Invalid retained array identity.', entry.scopeId)
      entry.valuePath.forEach((segment) => {
        if (typeof segment === 'number') {
          if (!Number.isSafeInteger(segment) || segment < 0)
            throw metadataError('Invalid retained array path.', entry.scopeId)
        }
        else {
          assertBusinessKey(segment, 'retainedArrays.valuePath')
        }
      })
      const ids = new Set(previous.instance.rows.map(row => row.rowId))
      entry.rowIds.forEach((rowId) => {
        if (rowId !== null && !ids.delete(rowId))
          throw metadataError('Retained rows must be unique existing array identities.', entry.scopeId)
      })
      const path = pathToString(entry.valuePath)
      if (retained.has(path))
        throw metadataError('Duplicate retained array path.', entry.scopeId)
      retained.set(path, { instanceKey: getArrayInstanceKey(entry.scopeId, entry.parentScope), rowIds: entry.rowIds })
    })
    const nextValues = this.normalizeValues(values)
    const nextMetadata: MetadataMap = new Map()
    const transaction = this.createTransaction()
    this.reconcileContainerMetadata(
      this.values,
      nextValues,
      this.schema.rootScopes,
      [],
      this.metadata,
      nextMetadata,
      transaction,
      'values',
      'values',
      retained,
    )
    this.assertMetadata(nextValues, nextMetadata)
    const invalidatedScopes = getInvalidatedScopes(this.metadata, nextMetadata)
    this.commit(nextValues, nextMetadata, transaction)
    return this.mutationResult([], invalidatedScopes)
  }

  applyPatch(patch: ConfigFormValueScopePatch): ConfigFormValueScopeMutationResult {
    if (!isPlainObject(patch))
      throw new ConfigFormValueScopeError('CONFIG_FORM_VALUE_SCOPE_PATCH_INVALID', 'Value patch must be an object.', 'patch')
    const rootSet = cloneCheckedObject(patch.set === undefined ? {} : patch.set, 'patch.set', 'CONFIG_FORM_VALUE_SCOPE_PATCH_SET_INVALID')
    const remove = patch.remove === undefined ? [] : cloneCheckedJson(patch.remove, 'patch.remove')
    const instances = patch.instances === undefined ? [] : patch.instances
    if (!Array.isArray(remove))
      throw new ConfigFormValueScopeError('CONFIG_FORM_VALUE_SCOPE_PATCH_REMOVE_INVALID', 'Patch remove must be an array.', 'patch.remove')
    if (!Array.isArray(instances) || instances.length > CONFIG_FORM_VALUE_SCOPE_MAX_ENTRIES)
      throw new ConfigFormValueScopeError('CONFIG_FORM_VALUE_SCOPE_PATCH_INSTANCES_INVALID', 'Patch instances must be a bounded array.', 'patch.instances')

    const rootFields = new Set(Object.keys(rootSet))
    rootFields.forEach(field => assertBusinessKey(field, `patch.set.${field}`))
    remove.forEach((field, index) => {
      assertBusinessKey(field, `patch.remove[${index}]`)
      if (rootFields.has(field))
        throw new ConfigFormValueScopeError('CONFIG_FORM_VALUE_SCOPE_PATCH_CONFLICT', `Duplicate root operation: ${field}`, `patch.remove[${index}]`)
      rootFields.add(field)
    })

    const instanceKeys = new Set<string>()
    const prepared = Array.from(instances, (input, index) => {
      if (!isPlainObject(input))
        throw new ConfigFormValueScopeError('CONFIG_FORM_VALUE_SCOPE_PATCH_INSTANCE_INVALID', 'Patch instance must be an object.', `patch.instances[${index}]`)
      assertDefinitionId(input.nodeId, `patch.instances[${index}].nodeId`)
      const field = this.getField(input.nodeId)
      const located = this.locateFieldContainer(field, input.scope as ConfigFormScopePath, this.values, this.metadata)
      const scope = cloneScopePath(located.scope)
      const key = getConfigFormValueScopeInstanceKey(input.nodeId, scope)
      if (instanceKeys.has(key))
        throw new ConfigFormValueScopeError('CONFIG_FORM_VALUE_SCOPE_PATCH_DUPLICATE_INSTANCE', 'Duplicate patch instance address.', `patch.instances[${index}]`)
      instanceKeys.add(key)
      const rootField = field.owner?.chain[0]?.definition.field ?? field.definition.field
      if (rootFields.has(rootField))
        throw new ConfigFormValueScopeError('CONFIG_FORM_VALUE_SCOPE_PATCH_CONFLICT', `Root operation ${rootField} conflicts with an instance write.`, `patch.instances[${index}]`)
      if (input.remove !== undefined && input.remove !== false && input.remove !== true)
        throw new ConfigFormValueScopeError('CONFIG_FORM_VALUE_SCOPE_PATCH_INSTANCE_INVALID', 'Instance remove must be a boolean.', `patch.instances[${index}].remove`)
      if (input.remove === true) {
        if (Object.hasOwn(input, 'value'))
          throw new ConfigFormValueScopeError('CONFIG_FORM_VALUE_SCOPE_PATCH_CONFLICT', 'Instance removal cannot also set a value.', `patch.instances[${index}]`)
        return { field, scope, remove: true as const }
      }
      assertJsonValue(input.value, `patch.instances[${index}].value`)
      return { field, scope, remove: false as const, value: cloneCheckedJson(input.value, `patch.instances[${index}].value`) }
    })

    const draft = cloneJsonSnapshot(this.values)
    Object.entries(rootSet).forEach(([field, value]) => defineValue(draft, field, value))
    remove.forEach(field => delete draft[field])
    const nextValues = this.normalizeValues(draft)
    // Defaults apply to replaced roots, not to omissions in untouched subtrees.
    for (const field of new Set([...Object.keys(nextValues), ...Object.keys(this.values)])) {
      if (rootFields.has(field))
        continue
      if (Object.hasOwn(this.values, field))
        defineValue(nextValues, field, cloneJsonSnapshot(this.values[field]!))
      else
        delete nextValues[field]
    }
    const nextSuppressed = new Map(this.suppressedDefaults)
    Object.keys(rootSet).forEach((field) => {
      this.schema.rootFields.filter(item => item.definition.field === field).forEach(item => nextSuppressed.delete(getConfigFormValueScopeInstanceKey(item.definition.nodeId, [])))
      this.schema.rootScopes.filter(item => item.definition.field === field).forEach(item => nextSuppressed.delete(getConfigFormValueScopeInstanceKey(item.definition.nodeId, [])))
    })
    remove.forEach((field) => {
      this.schema.rootFields.filter(item => item.definition.field === field).forEach(item => nextSuppressed.set(getConfigFormValueScopeInstanceKey(item.definition.nodeId, []), { nodeId: item.definition.nodeId, scope: [] }))
      this.schema.rootScopes.filter(item => item.definition.field === field).forEach(item => nextSuppressed.set(getConfigFormValueScopeInstanceKey(item.definition.nodeId, []), { nodeId: item.definition.nodeId, scope: [] }))
    })
    prepared.forEach((operation) => {
      const key = getConfigFormValueScopeInstanceKey(operation.field.definition.nodeId, operation.scope)
      if (operation.remove)
        nextSuppressed.set(key, { nodeId: operation.field.definition.nodeId, scope: cloneScopePath(operation.scope) })
      else
        nextSuppressed.delete(key)
    })
    const changedScopeIds = new Set(this.schema.rootScopes.map(scope => scope.definition.nodeId))
    const retained = new Map<string, { instanceKey: string, rowIds: readonly string[] }>()
    for (const instance of this.metadata.values()) {
      const scope = this.schema.scopeById.get(instance.scopeId)
      if (!scope || rootFields.has(scope.chain[0]!.definition.field))
        continue
      const located = this.locateArray(instance.scopeId, instance.parentScope, this.values, this.metadata)
      retained.set(pathToString(located.path), {
        instanceKey: getArrayInstanceKey(instance.scopeId, instance.parentScope),
        rowIds: instance.rows.map(row => row.rowId),
      })
    }
    const nextMetadata: MetadataMap = new Map([...this.metadata].filter(([, instance]) => {
      const scope = this.schema.scopeById.get(instance.scopeId)!
      return !scope.chain.some(ancestor => changedScopeIds.has(ancestor.definition.nodeId))
    }))
    const transaction = this.createTransaction()
    this.reconcileContainerMetadata(this.values, nextValues, this.schema.rootScopes, [], this.metadata, nextMetadata, transaction, 'values', 'values', retained)
    prepared.forEach((operation) => {
      const target = this.locateFieldContainer(operation.field, operation.scope, nextValues, nextMetadata)
      if (operation.remove)
        delete target.container[operation.field.definition.field]
      else
        defineValue(target.container, operation.field.definition.field, operation.value)
    })
    // Normalize the full candidate, then reapply removals because defaults are materialized by normalization.
    const checked = this.normalizeValues(nextValues)
    remove.forEach(field => delete checked[field])
    prepared.filter(operation => operation.remove).forEach((operation) => {
      const target = this.locateFieldContainer(operation.field, operation.scope, checked, nextMetadata)
      delete target.container[operation.field.definition.field]
    })
    nextSuppressed.forEach((suppressed) => {
      const field = this.schema.fieldById.get(suppressed.nodeId)
      if (field) {
        const target = this.locateFieldContainer(field, suppressed.scope, checked, nextMetadata)
        delete target.container[field.definition.field]
        return
      }
      const scope = this.schema.scopeById.get(suppressed.nodeId)
      if (!scope || scope.parent)
        throw metadataError('Unknown suppressed value scope.', suppressed.nodeId)
      delete checked[scope.definition.field]
    })
    this.assertMetadata(checked, nextMetadata)
    const invalidatedScopes = getInvalidatedScopes(this.metadata, nextMetadata)
    this.commit(checked, nextMetadata, transaction)
    this.suppressedDefaults = nextSuppressed
    return this.mutationResult([], invalidatedScopes)
  }

  transaction<T>(operation: (store: ConfigFormValueScopeStore) => T): T {
    const previousValues = this.values
    const previousMetadata = this.metadata
    const candidate: ValueScopeStore = Object.create(ValueScopeStore.prototype)
    Object.assign(candidate, {
      createRowId: this.createRowId,
      metadata: cloneMetadata(this.metadata),
      reservedRowIds: new Set(this.reservedRowIds),
      schema: this.schema,
      suppressedDefaults: new Map(this.suppressedDefaults),
      values: cloneJsonSnapshot(this.values),
    })
    const result = operation(candidate)
    if (result !== null && typeof result === 'object' && typeof (result as { then?: unknown }).then === 'function') {
      throw new ConfigFormValueScopeError(
        'CONFIG_FORM_VALUE_SCOPE_TRANSACTION_ASYNC',
        'Value scope transactions must complete synchronously.',
        'operation',
      )
    }
    if (this.values !== previousValues || this.metadata !== previousMetadata)
      throw new ConfigFormValueScopeError('CONFIG_FORM_VALUE_SCOPE_TRANSACTION_STALE', 'Value scope changed during the transaction.', 'operation')
    this.values = candidate.values
    this.metadata = candidate.metadata
    this.suppressedDefaults = candidate.suppressedDefaults
    candidate.reservedRowIds.forEach(rowId => this.reservedRowIds.add(rowId))
    return result
  }

  patchValues(values: ConfigFormJsonObject, removeFields: readonly string[] = []): ConfigFormValueScopeMutationResult {
    return this.applyPatch({ set: values, remove: removeFields })
  }

  getValue(nodeId: string, scope: ConfigFormScopePath = []): ConfigFormJsonValue | undefined {
    const field = this.getField(nodeId)
    const located = this.locateFieldContainer(field, scope, this.values, this.metadata)
    if (!Object.hasOwn(located.container, field.definition.field))
      return undefined
    return cloneJsonSnapshot(located.container[field.definition.field]!)
  }

  setValue(
    nodeId: string,
    value: ConfigFormJsonValue,
    scope: ConfigFormScopePath = [],
  ): ConfigFormValueScopeMutationResult {
    const field = this.getField(nodeId)
    const current = this.locateFieldContainer(field, scope, this.values, this.metadata)
    const nextValue = cloneCheckedJson(value, 'value')
    const draft = cloneJsonSnapshot(this.values)
    const target = this.locateFieldContainer(field, scope, draft, this.metadata)
    defineValue(target.container, field.definition.field, nextValue)
    const nextValues = this.normalizeValues(draft)
    this.assertMetadata(nextValues, this.metadata)
    this.values = nextValues
    return this.mutationResult([...current.path, field.definition.field], [])
  }

  resolvePath(nodeId: string, scope: ConfigFormScopePath = []): readonly (number | string)[] {
    const field = this.getField(nodeId)
    const located = this.locateFieldContainer(field, scope, this.values, this.metadata)
    return [...located.path, field.definition.field]
  }

  listRows(scopeId: string, parentScope: ConfigFormScopePath = []): readonly ConfigFormValueScopeRow[] {
    const located = this.locateArray(scopeId, parentScope, this.values, this.metadata)
    return located.instance.rows.map((_, index) => this.rowSnapshot(located, index))
  }

  appendRow(
    scopeId: string,
    value: ConfigFormJsonObject = {},
    parentScope: ConfigFormScopePath = [],
  ): ConfigFormValueScopeRowMutationResult {
    const located = this.locateArray(scopeId, parentScope, this.values, this.metadata)
    return this.insertRow(scopeId, located.array.length, value, parentScope)
  }

  insertRow(
    scopeId: string,
    index: number,
    value: ConfigFormJsonObject = {},
    parentScope: ConfigFormScopePath = [],
  ): ConfigFormValueScopeRowMutationResult {
    const current = this.locateArray(scopeId, parentScope, this.values, this.metadata)
    assertInsertIndex(index, current.array.length)
    this.assertCanAdd(current)
    const inputRow = cloneCheckedObject(value, 'value', 'CONFIG_FORM_VALUE_SCOPE_ROW_SHAPE_INVALID')

    const nextValuesDraft = cloneJsonSnapshot(this.values)
    if (current.array.length === 0 && current.scope.parent === undefined && parentScope.length === 0
      && !Object.hasOwn(nextValuesDraft, current.scope.definition.field)) {
      nextValuesDraft[current.scope.definition.field] = []
    }
    const draftTarget = this.locateArray(scopeId, parentScope, nextValuesDraft, this.metadata)
    draftTarget.array.splice(index, 0, inputRow)
    const nextValues = this.normalizeValues(nextValuesDraft)

    const nextMetadata = cloneMetadata(this.metadata)
    const transaction = this.createTransaction()
    const rowId = this.generateRowId(current.scope, current.parentScope, transaction)
    const nextInstance = nextMetadata.get(getArrayInstanceKey(scopeId, current.parentScope)) ?? {
      scopeId,
      parentScope: cloneScopePath(current.parentScope),
      rows: [],
    }
    nextMetadata.set(getArrayInstanceKey(scopeId, current.parentScope), nextInstance)
    if (current.array.length === 0)
      nextInstance.rows.length = 0
    nextInstance.rows.splice(index, 0, { rowId })
    const nextTarget = this.locateArray(scopeId, parentScope, nextValues, nextMetadata)
    const rowScope = [...nextTarget.parentScope, { scopeId, rowId }]
    this.buildFreshContainerMetadata(
      nextTarget.array[index]!,
      current.scope.children,
      rowScope,
      nextMetadata,
      transaction,
    )
    this.assertMetadata(nextValues, nextMetadata)
    this.commit(nextValues, nextMetadata, transaction)

    const committed = this.locateArray(scopeId, parentScope, this.values, this.metadata)
    return this.rowMutationResult(committed, index, [...committed.path, index], [])
  }

  duplicateRow(
    scopeId: string,
    rowId: string,
    parentScope: ConfigFormScopePath = [],
  ): ConfigFormValueScopeRowMutationResult {
    const current = this.locateArray(scopeId, parentScope, this.values, this.metadata)
    this.assertCanAdd(current)
    const sourceIndex = findRowIndex(current.instance, rowId, 'rowId')
    const insertIndex = sourceIndex + 1
    const copiedRow = cloneJsonSnapshot(current.array[sourceIndex]!)
    // The copy is a new row, so it must not inherit the source row's business key:
    // keeping it would collide with the source itemKey. The host assigns a fresh one.
    if (current.scope.definition.itemKey !== undefined)
      delete copiedRow[current.scope.definition.itemKey]

    const nextValues = cloneJsonSnapshot(this.values)
    const draftTarget = this.locateArray(scopeId, parentScope, nextValues, this.metadata)
    draftTarget.array.splice(insertIndex, 0, copiedRow)
    const normalizedValues = this.normalizeValues(nextValues)

    const nextMetadata = cloneMetadata(this.metadata)
    const transaction = this.createTransaction()
    const nextRowId = this.generateRowId(current.scope, current.parentScope, transaction)
    const nextInstance = nextMetadata.get(getArrayInstanceKey(scopeId, current.parentScope))
    if (!nextInstance)
      throw metadataError('Array scope metadata is unavailable.', scopeId)
    nextInstance.rows.splice(insertIndex, 0, { rowId: nextRowId })
    const nextTarget = this.locateArray(scopeId, parentScope, normalizedValues, nextMetadata)
    const rowScope = [...nextTarget.parentScope, { scopeId, rowId: nextRowId }]
    this.buildFreshContainerMetadata(
      nextTarget.array[insertIndex]!,
      current.scope.children,
      rowScope,
      nextMetadata,
      transaction,
    )
    this.assertMetadata(normalizedValues, nextMetadata)
    this.commit(normalizedValues, nextMetadata, transaction)

    const committed = this.locateArray(scopeId, parentScope, this.values, this.metadata)
    return this.rowMutationResult(committed, insertIndex, [...committed.path, insertIndex], [])
  }

  removeRow(
    scopeId: string,
    rowId: string,
    parentScope: ConfigFormScopePath = [],
  ): ConfigFormValueScopeRemoveResult {
    const current = this.locateArray(scopeId, parentScope, this.values, this.metadata)
    const index = findRowIndex(current.instance, rowId, 'rowId')
    const minimum = current.scope.definition.minItems ?? 0
    if (current.array.length <= minimum) {
      throw new ConfigFormValueScopeError(
        'CONFIG_FORM_VALUE_SCOPE_MIN_ITEMS',
        `Array scope ${scopeId} requires at least ${minimum} rows.`,
        pathToString(current.path),
        { minItems: minimum, scopeId },
      )
    }

    const removedRow = this.rowSnapshot(current, index)
    const nextValues = cloneJsonSnapshot(this.values)
    const draftTarget = this.locateArray(scopeId, parentScope, nextValues, this.metadata)
    draftTarget.array.splice(index, 1)
    const normalizedValues = this.normalizeValues(nextValues)

    const nextMetadata = cloneMetadata(this.metadata)
    const nextInstance = nextMetadata.get(getArrayInstanceKey(scopeId, current.parentScope))
    if (!nextInstance)
      throw metadataError('Array scope metadata is unavailable.', scopeId)
    nextInstance.rows.splice(index, 1)
    const removedScope = [...current.parentScope, { scopeId, rowId }]
    for (const [key, instance] of nextMetadata) {
      if (scopeStartsWith(instance.parentScope, removedScope))
        nextMetadata.delete(key)
    }

    this.assertMetadata(normalizedValues, nextMetadata)
    const invalidatedScopes = getInvalidatedScopes(this.metadata, nextMetadata)
    this.commit(normalizedValues, nextMetadata, this.createTransaction())
    return {
      ...this.mutationResult([...current.path, index], invalidatedScopes),
      removedRow,
    }
  }

  moveRow(
    scopeId: string,
    rowId: string,
    toIndex: number,
    parentScope: ConfigFormScopePath = [],
  ): ConfigFormValueScopeRowMutationResult {
    const current = this.locateArray(scopeId, parentScope, this.values, this.metadata)
    const fromIndex = findRowIndex(current.instance, rowId, 'rowId')
    assertMoveIndex(toIndex, current.array.length)

    if (fromIndex !== toIndex) {
      const nextValues = cloneJsonSnapshot(this.values)
      const draftTarget = this.locateArray(scopeId, parentScope, nextValues, this.metadata)
      const [row] = draftTarget.array.splice(fromIndex, 1)
      draftTarget.array.splice(toIndex, 0, row!)

      const nextMetadata = cloneMetadata(this.metadata)
      const nextTarget = this.locateArray(scopeId, parentScope, nextValues, nextMetadata)
      const [rowMetadata] = nextTarget.instance.rows.splice(fromIndex, 1)
      nextTarget.instance.rows.splice(toIndex, 0, rowMetadata!)
      this.assertMetadata(nextValues, nextMetadata)
      this.commit(nextValues, nextMetadata, this.createTransaction())
    }

    const committed = this.locateArray(scopeId, parentScope, this.values, this.metadata)
    return this.rowMutationResult(committed, toIndex, [...committed.path, toIndex], [])
  }

  private normalizeValues(input: ConfigFormJsonObject): ConfigFormJsonObject {
    const values = cloneCheckedObject(input, 'values', 'CONFIG_FORM_VALUE_SCOPE_VALUES_SHAPE_INVALID')
    this.normalizeContainer(values, this.schema.rootFields, this.schema.rootScopes, 'values')
    assertJsonValue(values, 'values')
    return values
  }

  private normalizeContainer(
    container: ConfigFormJsonObject,
    fields: readonly FieldNode[],
    scopes: readonly ScopeNode[],
    path: string,
  ): void {
    for (const field of fields) {
      if (!Object.hasOwn(container, field.definition.field) && Object.hasOwn(field.definition, 'defaultValue')) {
        defineValue(
          container,
          field.definition.field,
          cloneJsonSnapshot(field.definition.defaultValue!),
        )
      }
    }

    for (const scope of scopes) {
      const fieldPath = appendValuePath(path, scope.definition.field)
      if (!Object.hasOwn(container, scope.definition.field)) {
        defineValue(container, scope.definition.field, scope.definition.kind === 'array' ? [] : {})
      }
      const value = container[scope.definition.field]
      if (scope.definition.kind === 'object') {
        if (!isPlainObject(value)) {
          throw new ConfigFormValueScopeError(
            'CONFIG_FORM_VALUE_SCOPE_OBJECT_SHAPE_INVALID',
            `Object scope ${scope.definition.nodeId} must contain an object.`,
            fieldPath,
            { scopeId: scope.definition.nodeId },
          )
        }
        this.normalizeContainer(value as ConfigFormJsonObject, scope.fields, scope.children, fieldPath)
        continue
      }

      if (!Array.isArray(value)) {
        throw new ConfigFormValueScopeError(
          'CONFIG_FORM_VALUE_SCOPE_ARRAY_SHAPE_INVALID',
          `Array scope ${scope.definition.nodeId} must contain an array.`,
          fieldPath,
          { scopeId: scope.definition.nodeId },
        )
      }
      const maximum = scope.definition.maxItems
      if (value.length > CONFIG_FORM_VALUE_SCOPE_MAX_ENTRIES || (maximum !== undefined && value.length > maximum)) {
        throw new ConfigFormValueScopeError(
          'CONFIG_FORM_VALUE_SCOPE_MAX_ITEMS',
          `Array scope ${scope.definition.nodeId} exceeds its maximum row count.`,
          fieldPath,
          { count: value.length, maxItems: maximum, scopeId: scope.definition.nodeId },
        )
      }
      const minimum = scope.definition.minItems ?? 0
      while (value.length < minimum)
        value.push({})

      value.forEach((row, index) => {
        const rowPath = `${fieldPath}[${index}]`
        if (!isPlainObject(row)) {
          throw new ConfigFormValueScopeError(
            'CONFIG_FORM_VALUE_SCOPE_ROW_SHAPE_INVALID',
            `Rows in array scope ${scope.definition.nodeId} must be objects.`,
            rowPath,
            { index, scopeId: scope.definition.nodeId },
          )
        }
        if (scope.definition.itemKey && Object.hasOwn(row, scope.definition.itemKey))
          assertItemKeyValue(row[scope.definition.itemKey], appendValuePath(rowPath, scope.definition.itemKey), scope.definition.nodeId)
        this.normalizeContainer(row as ConfigFormJsonObject, scope.fields, scope.children, rowPath)
      })
    }
  }

  private buildFreshContainerMetadata(
    container: ConfigFormJsonObject,
    scopes: readonly ScopeNode[],
    parentScope: ConfigFormScopePath,
    metadata: MetadataMap,
    transaction: RowIdTransaction,
  ): void {
    for (const scope of scopes) {
      const value = container[scope.definition.field]!
      if (scope.definition.kind === 'object') {
        this.buildFreshContainerMetadata(
          value as ConfigFormJsonObject,
          scope.children,
          parentScope,
          metadata,
          transaction,
        )
        continue
      }

      const array = value as ConfigFormJsonObject[]
      const instance: ArrayInstanceMetadata = {
        scopeId: scope.definition.nodeId,
        parentScope: cloneScopePath(parentScope),
        rows: [],
      }
      const instanceKey = getArrayInstanceKey(scope.definition.nodeId, parentScope)
      if (metadata.has(instanceKey))
        throw metadataError('Duplicate array scope instance.', scope.definition.nodeId)
      metadata.set(instanceKey, instance)
      array.forEach((row) => {
        const rowId = this.generateRowId(scope, parentScope, transaction)
        instance.rows.push({ rowId })
        this.buildFreshContainerMetadata(
          row,
          scope.children,
          [...parentScope, { scopeId: scope.definition.nodeId, rowId }],
          metadata,
          transaction,
        )
      })
    }
  }

  private reconcileContainerMetadata(
    previousContainer: ConfigFormJsonObject,
    nextContainer: ConfigFormJsonObject,
    scopes: readonly ScopeNode[],
    parentScope: ConfigFormScopePath,
    previousMetadata: MetadataMap,
    nextMetadata: MetadataMap,
    transaction: RowIdTransaction,
    previousPath: string,
    nextPath: string,
    retained?: ReadonlyMap<string, { instanceKey: string, rowIds: readonly (string | null)[] }>,
  ): void {
    for (const scope of scopes) {
      const previousValue = previousContainer[scope.definition.field] ?? (scope.definition.kind === 'array' ? [] : {})
      const nextValue = nextContainer[scope.definition.field] ?? (scope.definition.kind === 'array' ? [] : {})
      const previousFieldPath = appendValuePath(previousPath, scope.definition.field)
      const nextFieldPath = appendValuePath(nextPath, scope.definition.field)
      if (scope.definition.kind === 'object') {
        this.reconcileContainerMetadata(
          previousValue as ConfigFormJsonObject,
          nextValue as ConfigFormJsonObject,
          scope.children,
          parentScope,
          previousMetadata,
          nextMetadata,
          transaction,
          previousFieldPath,
          nextFieldPath,
          retained,
        )
        continue
      }

      const previousArray = previousValue as ConfigFormJsonObject[]
      const nextArray = nextValue as ConfigFormJsonObject[]
      const instanceKey = getArrayInstanceKey(scope.definition.nodeId, parentScope)
      const previousInstance = previousMetadata.get(instanceKey)
      if (!previousInstance || previousInstance.rows.length !== previousArray.length)
        throw metadataError('Missing previous array scope metadata.', scope.definition.nodeId)

      const nextInstance: ArrayInstanceMetadata = {
        scopeId: scope.definition.nodeId,
        parentScope: cloneScopePath(parentScope),
        rows: [],
      }
      nextMetadata.set(instanceKey, nextInstance)

      let matches = new Map<number, number>()
      if (scope.definition.itemKey) {
        const previousKeys = collectUniqueItemKeys(
          previousArray,
          scope.definition.itemKey,
          scope.definition.nodeId,
          previousFieldPath,
        )
        const nextKeys = collectUniqueItemKeys(
          nextArray,
          scope.definition.itemKey,
          scope.definition.nodeId,
          nextFieldPath,
        )
        matches = new Map(
          [...nextKeys].flatMap(([key, nextIndex]) => {
            const previousIndex = previousKeys.get(key)
            return previousIndex === undefined ? [] : [[nextIndex, previousIndex] as const]
          }),
        )
      }
      const preserved = retained?.get(nextFieldPath)
      if (preserved?.instanceKey === instanceKey) {
        const previousIndices = new Map(previousInstance.rows.map((row, index) => [row.rowId, index]))
        const used = new Set<number>()
        preserved.rowIds.forEach((rowId, index) => {
          if (rowId === null)
            return
          const previousIndex = previousIndices.get(rowId)
          if (previousIndex === undefined || used.has(previousIndex))
            throw metadataError('Retained rows must be unique existing array identities.', scope.definition.nodeId)
          matches.set(index, previousIndex)
          used.add(previousIndex)
        })
        matches.forEach((previousIndex, nextIndex) => {
          if (preserved.rowIds[nextIndex] === null)
            matches.delete(nextIndex)
        })
      }

      nextArray.forEach((row, nextIndex) => {
        const previousIndex = matches.get(nextIndex)
        const rowId = previousIndex === undefined
          ? this.generateRowId(scope, parentScope, transaction)
          : previousInstance.rows[previousIndex]!.rowId
        nextInstance.rows.push({ rowId })
        const rowScope = [...parentScope, { scopeId: scope.definition.nodeId, rowId }]
        if (previousIndex === undefined) {
          this.buildFreshContainerMetadata(row, scope.children, rowScope, nextMetadata, transaction)
          return
        }
        this.reconcileContainerMetadata(
          previousArray[previousIndex]!,
          row,
          scope.children,
          rowScope,
          previousMetadata,
          nextMetadata,
          transaction,
          `${previousFieldPath}[${previousIndex}]`,
          `${nextFieldPath}[${nextIndex}]`,
          retained,
        )
      })
    }
  }

  private locateFieldContainer(
    field: FieldNode,
    scope: ConfigFormScopePath,
    values: ConfigFormJsonObject,
    metadata: MetadataMap,
  ): LocatedContainer {
    return this.locateContainer(field.owner?.chain ?? [], scope, values, metadata)
  }

  private locateArray(
    scopeId: string,
    parentScope: ConfigFormScopePath,
    values: ConfigFormJsonObject,
    metadata: MetadataMap,
  ): LocatedArray {
    const scope = this.getArrayScope(scopeId)
    const parentChain = scope.chain.slice(0, -1)
    const located = this.locateContainer(parentChain, parentScope, values, metadata, 'parentScope')
    const array = located.container[scope.definition.field] ?? []
    if (!Array.isArray(array))
      throw metadataError('Array scope value is unavailable.', scopeId)
    const instance = metadata.get(getArrayInstanceKey(scopeId, located.scope))
    if (array.length === 0 && scope.parent === undefined && located.scope.length === 0
      && (!instance || instance.rows.length !== 0)) {
      return {
        array: array as ConfigFormJsonObject[],
        instance: { scopeId, parentScope: [], rows: [] },
        parentScope: located.scope,
        path: [...located.path, scope.definition.field],
        scope,
      }
    }
    if (!instance || instance.rows.length !== array.length)
      throw metadataError('Array scope metadata is unavailable.', scopeId)
    return {
      array: array as ConfigFormJsonObject[],
      instance,
      parentScope: located.scope,
      path: [...located.path, scope.definition.field],
      scope,
    }
  }

  private locateContainer(
    chain: readonly ScopeNode[],
    inputScope: ConfigFormScopePath,
    values: ConfigFormJsonObject,
    metadata: MetadataMap,
    scopePath = 'scope',
  ): LocatedContainer {
    const expectedArrays = chain.filter(scope => scope.definition.kind === 'array')
    const scope = validateScopePath(inputScope, expectedArrays, scopePath)
    const resolvedScope: ConfigFormScopePathEntry[] = []
    const path: (number | string)[] = []
    let container = values
    let arrayIndex = 0

    for (const node of chain) {
      const value = container[node.definition.field] ?? (node.definition.kind === 'array' ? [] : {})
      path.push(node.definition.field)
      if (node.definition.kind === 'object') {
        if (!isPlainObject(value))
          throw metadataError('Object scope value is unavailable.', node.definition.nodeId)
        container = value as ConfigFormJsonObject
        continue
      }

      if (!Array.isArray(value))
        throw metadataError('Array scope value is unavailable.', node.definition.nodeId)
      const entry = scope[arrayIndex++]!
      const instance = metadata.get(getArrayInstanceKey(node.definition.nodeId, resolvedScope))
      if (!instance || instance.rows.length !== value.length)
        throw metadataError('Array scope metadata is unavailable.', node.definition.nodeId)
      const rowIndex = instance.rows.findIndex(row => row.rowId === entry.rowId)
      if (rowIndex < 0) {
        throw new ConfigFormValueScopeError(
          'CONFIG_FORM_VALUE_SCOPE_ROW_NOT_FOUND',
          `Row ${entry.rowId} does not exist in array scope ${node.definition.nodeId}.`,
          `${scopePath}[${arrayIndex - 1}].rowId`,
          { rowId: entry.rowId, scopeId: node.definition.nodeId },
        )
      }
      path.push(rowIndex)
      resolvedScope.push({ scopeId: node.definition.nodeId, rowId: entry.rowId })
      container = value[rowIndex] as ConfigFormJsonObject
    }

    return { container, path, scope: resolvedScope }
  }

  private assertCanAdd(located: LocatedArray): void {
    const maximum = located.scope.definition.maxItems
    if (located.array.length >= CONFIG_FORM_VALUE_SCOPE_MAX_ENTRIES
      || (maximum !== undefined && located.array.length >= maximum)) {
      throw new ConfigFormValueScopeError(
        'CONFIG_FORM_VALUE_SCOPE_MAX_ITEMS',
        `Array scope ${located.scope.definition.nodeId} cannot accept another row.`,
        pathToString(located.path),
        { maxItems: maximum, scopeId: located.scope.definition.nodeId },
      )
    }
  }

  private getField(nodeId: string): FieldNode {
    const field = this.schema.fieldById.get(nodeId)
    if (!field) {
      throw new ConfigFormValueScopeError(
        'CONFIG_FORM_VALUE_SCOPE_FIELD_NOT_FOUND',
        `Unknown scoped field node: ${nodeId}`,
        'nodeId',
        { nodeId },
      )
    }
    return field
  }

  private getArrayScope(scopeId: string): ScopeNode {
    const scope = this.schema.scopeById.get(scopeId)
    if (!scope) {
      throw new ConfigFormValueScopeError(
        'CONFIG_FORM_VALUE_SCOPE_SCOPE_NOT_FOUND',
        `Unknown value scope: ${scopeId}`,
        'scopeId',
        { scopeId },
      )
    }
    if (scope.definition.kind !== 'array') {
      throw new ConfigFormValueScopeError(
        'CONFIG_FORM_VALUE_SCOPE_KIND_INVALID',
        `Value scope ${scopeId} is not an array scope.`,
        'scopeId',
        { kind: scope.definition.kind, scopeId },
      )
    }
    return scope
  }

  private generateRowId(
    scope: ScopeNode,
    parentScope: ConfigFormScopePath,
    transaction: RowIdTransaction,
  ): string {
    for (let attempt = 0; attempt < CONFIG_FORM_VALUE_SCOPE_ROW_ID_ATTEMPTS; attempt += 1) {
      let rowId: unknown
      try {
        rowId = this.createRowId({
          attempt,
          parentScope: cloneScopePath(parentScope),
          scopeId: scope.definition.nodeId,
        })
      }
      catch (cause) {
        throw new ConfigFormValueScopeError(
          'CONFIG_FORM_VALUE_SCOPE_ROW_ID_FACTORY_FAILED',
          'The row ID factory failed.',
          'createRowId',
          { cause: cause instanceof Error ? cause.message : String(cause), scopeId: scope.definition.nodeId },
        )
      }
      if (typeof rowId !== 'string' || !rowId.trim() || UNSAFE_KEYS.has(rowId)) {
        throw new ConfigFormValueScopeError(
          'CONFIG_FORM_VALUE_SCOPE_ROW_ID_INVALID',
          'The row ID factory must return a non-empty safe string.',
          'createRowId',
          { rowId, scopeId: scope.definition.nodeId },
        )
      }
      if (this.reservedRowIds.has(rowId) || transaction.stagedIds.has(rowId))
        continue
      transaction.stagedIds.add(rowId)
      return rowId
    }
    throw new ConfigFormValueScopeError(
      'CONFIG_FORM_VALUE_SCOPE_ROW_ID_EXHAUSTED',
      `The row ID factory returned reserved IDs ${CONFIG_FORM_VALUE_SCOPE_ROW_ID_ATTEMPTS} times.`,
      'createRowId',
      { attempts: CONFIG_FORM_VALUE_SCOPE_ROW_ID_ATTEMPTS, scopeId: scope.definition.nodeId },
    )
  }

  private assertMetadata(values: ConfigFormJsonObject, metadata: MetadataMap): void {
    const instanceKeys = new Set<string>()
    const activeRowIds = new Set<string>()

    const visit = (
      container: ConfigFormJsonObject,
      scopes: readonly ScopeNode[],
      parentScope: ConfigFormScopePath,
    ): void => {
      for (const scope of scopes) {
        const value = container[scope.definition.field] ?? (scope.definition.kind === 'array' ? [] : {})
        if (scope.definition.kind === 'object') {
          visit(value as ConfigFormJsonObject, scope.children, parentScope)
          continue
        }
        const key = getArrayInstanceKey(scope.definition.nodeId, parentScope)
        const instance = metadata.get(key)
        if (!instance || instance.scopeId !== scope.definition.nodeId || instance.rows.length !== (value as unknown[]).length)
          throw metadataError('Array scope metadata does not match its values.', scope.definition.nodeId)
        instanceKeys.add(key)
        instance.rows.forEach((row, index) => {
          if (!isValidRowId(row.rowId) || activeRowIds.has(row.rowId))
            throw metadataError('Array row metadata contains an invalid or duplicate row ID.', scope.definition.nodeId)
          activeRowIds.add(row.rowId)
          visit(
            (value as ConfigFormJsonObject[])[index]!,
            scope.children,
            [...parentScope, { scopeId: scope.definition.nodeId, rowId: row.rowId }],
          )
        })
      }
    }

    visit(values, this.schema.rootScopes, [])
    if (instanceKeys.size !== metadata.size)
      throw metadataError('Orphaned array scope metadata was found.')
  }

  private rowSnapshot(located: LocatedArray, index: number): ConfigFormValueScopeRow {
    const metadata = located.instance.rows[index]
    const value = located.array[index]
    if (!metadata || !value)
      throw metadataError('Array row snapshot is unavailable.', located.scope.definition.nodeId)
    return {
      index,
      rowId: metadata.rowId,
      scope: [...cloneScopePath(located.parentScope), {
        rowId: metadata.rowId,
        scopeId: located.scope.definition.nodeId,
      }],
      value: cloneJsonSnapshot(value),
    }
  }

  private rowMutationResult(
    located: LocatedArray,
    index: number,
    path: readonly (number | string)[],
    invalidatedScopes: readonly ConfigFormScopePath[],
  ): ConfigFormValueScopeRowMutationResult {
    return {
      ...this.mutationResult(path, invalidatedScopes),
      row: this.rowSnapshot(located, index),
    }
  }

  private mutationResult(
    path: readonly (number | string)[],
    invalidatedScopes: readonly ConfigFormScopePath[],
  ): ConfigFormValueScopeMutationResult {
    return {
      invalidatedScopes: invalidatedScopes.map(cloneScopePath),
      path: [...path],
      values: this.getValues(),
    }
  }

  private createTransaction(): RowIdTransaction {
    return { stagedIds: new Set() }
  }

  private commit(values: ConfigFormJsonObject, metadata: MetadataMap, transaction: RowIdTransaction): void {
    this.values = values
    this.metadata = metadata
    this.commitIds(transaction)
  }

  private commitIds(transaction: RowIdTransaction): void {
    transaction.stagedIds.forEach(rowId => this.reservedRowIds.add(rowId))
  }
}

function assertOptions(options: CreateConfigFormValueScopeStoreOptions): void {
  if (!isPlainObject(options)) {
    throw new ConfigFormValueScopeError(
      'CONFIG_FORM_VALUE_SCOPE_OPTIONS_INVALID',
      'Value scope store options must be an object.',
      'options',
    )
  }
  if (!Array.isArray(options.scopes)) {
    throw new ConfigFormValueScopeError(
      'CONFIG_FORM_VALUE_SCOPE_SCOPES_INVALID',
      'Value scope definitions must be an array.',
      'scopes',
    )
  }
  if (!Array.isArray(options.fields)) {
    throw new ConfigFormValueScopeError(
      'CONFIG_FORM_VALUE_SCOPE_FIELDS_INVALID',
      'Scoped field definitions must be an array.',
      'fields',
    )
  }
  if (options.createRowId !== undefined && typeof options.createRowId !== 'function') {
    throw new ConfigFormValueScopeError(
      'CONFIG_FORM_VALUE_SCOPE_ROW_ID_FACTORY_INVALID',
      'createRowId must be a function.',
      'createRowId',
    )
  }
}

function createSchema(
  inputScopes: readonly ConfigFormValueScopeDefinition[],
  inputFields: readonly ConfigFormScopedFieldDefinition[],
): ValueScopeSchema {
  if (inputScopes.length > CONFIG_FORM_VALUE_SCOPE_MAX_ENTRIES || inputFields.length > CONFIG_FORM_VALUE_SCOPE_MAX_ENTRIES) {
    throw new ConfigFormValueScopeError(
      'CONFIG_FORM_VALUE_SCOPE_SCHEMA_LIMIT_EXCEEDED',
      'Value scope definitions exceed the supported count.',
      inputScopes.length > CONFIG_FORM_VALUE_SCOPE_MAX_ENTRIES ? 'scopes' : 'fields',
    )
  }

  const scopeById = new Map<string, ScopeNode>()
  const fieldById = new Map<string, FieldNode>()
  const allNodeIds = new Map<string, string>()

  inputScopes.forEach((definition, index) => {
    const path = `scopes[${index}]`
    if (!isPlainObject(definition))
      throw schemaError('CONFIG_FORM_VALUE_SCOPE_DEFINITION_INVALID', 'Scope definition must be an object.', path)
    assertDefinitionId(definition.nodeId, `${path}.nodeId`)
    assertBusinessKey(definition.field, `${path}.field`)
    if (definition.kind !== 'array' && definition.kind !== 'object') {
      throw schemaError(
        'CONFIG_FORM_VALUE_SCOPE_KIND_INVALID',
        'Scope kind must be "object" or "array".',
        `${path}.kind`,
      )
    }
    if (definition.parentId !== undefined)
      assertDefinitionId(definition.parentId, `${path}.parentId`)
    assertUniqueNodeId(definition.nodeId, path, allNodeIds)

    if (definition.kind === 'object') {
      if (definition.itemKey !== undefined || definition.minItems !== undefined || definition.maxItems !== undefined) {
        throw schemaError(
          'CONFIG_FORM_VALUE_SCOPE_ARRAY_OPTIONS_INVALID',
          'itemKey, minItems, and maxItems are valid only for array scopes.',
          path,
        )
      }
    }
    else {
      if (definition.itemKey !== undefined)
        assertBusinessKey(definition.itemKey, `${path}.itemKey`)
      assertItemBound(definition.minItems, `${path}.minItems`)
      assertItemBound(definition.maxItems, `${path}.maxItems`)
      if (definition.minItems !== undefined
        && definition.maxItems !== undefined
        && definition.minItems > definition.maxItems) {
        throw schemaError(
          'CONFIG_FORM_VALUE_SCOPE_BOUNDS_INVALID',
          'minItems cannot exceed maxItems.',
          path,
        )
      }
    }

    const copied: ConfigFormValueScopeDefinition = {
      field: definition.field,
      kind: definition.kind,
      nodeId: definition.nodeId,
      ...(definition.parentId === undefined ? {} : { parentId: definition.parentId }),
      ...(definition.itemKey === undefined ? {} : { itemKey: definition.itemKey }),
      ...(definition.minItems === undefined ? {} : { minItems: definition.minItems }),
      ...(definition.maxItems === undefined ? {} : { maxItems: definition.maxItems }),
    }
    scopeById.set(definition.nodeId, {
      chain: [],
      children: [],
      definition: copied,
      fields: [],
      index,
    })
  })

  for (const scope of scopeById.values()) {
    const parentId = scope.definition.parentId
    if (!parentId)
      continue
    const parent = scopeById.get(parentId)
    if (!parent) {
      throw schemaError(
        'CONFIG_FORM_VALUE_SCOPE_PARENT_NOT_FOUND',
        `Unknown parent scope: ${parentId}`,
        `scopes[${scope.index}].parentId`,
      )
    }
    scope.parent = parent
    parent.children.push(scope)
  }

  for (const scope of scopeById.values()) {
    const ancestors = new Set<string>()
    const chain: ScopeNode[] = []
    let current: ScopeNode | undefined = scope
    while (current) {
      if (ancestors.has(current.definition.nodeId)) {
        throw schemaError(
          'CONFIG_FORM_VALUE_SCOPE_CYCLE',
          `Value scope topology contains a cycle at ${current.definition.nodeId}.`,
          `scopes[${scope.index}].parentId`,
        )
      }
      ancestors.add(current.definition.nodeId)
      chain.unshift(current)
      if (chain.length > CONFIG_FORM_VALUE_SCOPE_MAX_DEPTH) {
        throw schemaError(
          'CONFIG_FORM_VALUE_SCOPE_DEPTH_EXCEEDED',
          `Value scope topology exceeds ${CONFIG_FORM_VALUE_SCOPE_MAX_DEPTH} levels.`,
          `scopes[${scope.index}].parentId`,
        )
      }
      current = current.parent
    }
    scope.chain = chain
  }

  const rootFields: FieldNode[] = []
  inputFields.forEach((definition, index) => {
    const path = `fields[${index}]`
    if (!isPlainObject(definition))
      throw schemaError('CONFIG_FORM_VALUE_SCOPE_FIELD_DEFINITION_INVALID', 'Field definition must be an object.', path)
    assertDefinitionId(definition.nodeId, `${path}.nodeId`)
    assertBusinessKey(definition.field, `${path}.field`)
    if (definition.scopeId !== undefined)
      assertDefinitionId(definition.scopeId, `${path}.scopeId`)
    assertUniqueNodeId(definition.nodeId, path, allNodeIds)

    let defaultValue: ConfigFormJsonValue | undefined
    const hasDefault = Object.hasOwn(definition, 'defaultValue')
    if (hasDefault)
      defaultValue = cloneCheckedJson(definition.defaultValue, `${path}.defaultValue`)

    const copied: ConfigFormScopedFieldDefinition = {
      field: definition.field,
      nodeId: definition.nodeId,
      ...(definition.scopeId === undefined ? {} : { scopeId: definition.scopeId }),
      ...(hasDefault ? { defaultValue: defaultValue! } : {}),
    }
    const field: FieldNode = { definition: copied, index }
    if (definition.scopeId !== undefined) {
      const owner = scopeById.get(definition.scopeId)
      if (!owner) {
        throw schemaError(
          'CONFIG_FORM_VALUE_SCOPE_FIELD_OWNER_NOT_FOUND',
          `Unknown field scope: ${definition.scopeId}`,
          `${path}.scopeId`,
        )
      }
      field.owner = owner
      owner.fields.push(field)
    }
    else {
      rootFields.push(field)
    }
    fieldById.set(definition.nodeId, field)
  })

  assertSiblingFieldsUnique(undefined, rootFields, [...scopeById.values()].filter(scope => !scope.parent))
  for (const scope of scopeById.values())
    assertSiblingFieldsUnique(scope, scope.fields, scope.children)

  return {
    fieldById,
    rootFields,
    rootScopes: [...scopeById.values()].filter(scope => !scope.parent),
    scopeById,
  }
}

function assertSiblingFieldsUnique(
  owner: ScopeNode | undefined,
  fields: readonly FieldNode[],
  scopes: readonly ScopeNode[],
): void {
  const occupied = new Map<string, string>()
  fields.forEach((field) => {
    const path = `fields[${field.index}].field`
    const previous = occupied.get(field.definition.field)
    if (previous)
      throw duplicateBusinessField(field.definition.field, owner, previous, path)
    occupied.set(field.definition.field, path)
  })
  scopes.forEach((scope) => {
    const path = `scopes[${scope.index}].field`
    const previous = occupied.get(scope.definition.field)
    if (previous)
      throw duplicateBusinessField(scope.definition.field, owner, previous, path)
    occupied.set(scope.definition.field, path)
  })
}

function duplicateBusinessField(
  field: string,
  owner: ScopeNode | undefined,
  previousPath: string,
  path: string,
): ConfigFormValueScopeError {
  return new ConfigFormValueScopeError(
    'CONFIG_FORM_VALUE_SCOPE_FIELD_DUPLICATE',
    `Duplicate business field ${JSON.stringify(field)} in the same value container.`,
    path,
    { field, ownerId: owner?.definition.nodeId ?? ROOT_OWNER, previousPath },
  )
}

function assertUniqueNodeId(nodeId: string, path: string, nodeIds: Map<string, string>): void {
  const previousPath = nodeIds.get(nodeId)
  if (previousPath) {
    throw new ConfigFormValueScopeError(
      'CONFIG_FORM_VALUE_SCOPE_NODE_ID_DUPLICATE',
      `Duplicate ConfigForm node ID: ${nodeId}`,
      `${path}.nodeId`,
      { nodeId, previousPath },
    )
  }
  nodeIds.set(nodeId, `${path}.nodeId`)
}

function assertDefinitionId(value: unknown, path: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || UNSAFE_KEYS.has(value)) {
    throw schemaError(
      'CONFIG_FORM_VALUE_SCOPE_NODE_ID_INVALID',
      'Node and scope IDs must be non-empty safe strings.',
      path,
    )
  }
}

function assertBusinessKey(value: unknown, path: string): asserts value is string {
  if (typeof value !== 'string' || !value.length || UNSAFE_KEYS.has(value)) {
    throw schemaError(
      'CONFIG_FORM_VALUE_SCOPE_KEY_INVALID',
      'Value fields and item keys must be non-empty safe strings.',
      path,
    )
  }
}

function assertItemBound(value: unknown, path: string): void {
  if (value === undefined)
    return
  if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > CONFIG_FORM_VALUE_SCOPE_MAX_ENTRIES) {
    throw schemaError(
      'CONFIG_FORM_VALUE_SCOPE_BOUND_INVALID',
      `Array bounds must be safe integers from 0 to ${CONFIG_FORM_VALUE_SCOPE_MAX_ENTRIES}.`,
      path,
    )
  }
}

function validateScopePath(
  input: ConfigFormScopePath,
  expected: readonly ScopeNode[],
  path: string,
): ConfigFormScopePathEntry[] {
  if (!Array.isArray(input)) {
    throw new ConfigFormValueScopeError(
      'CONFIG_FORM_VALUE_SCOPE_PATH_INVALID',
      'A scope path must be an array.',
      path,
    )
  }
  if (input.length !== expected.length) {
    throw new ConfigFormValueScopeError(
      'CONFIG_FORM_VALUE_SCOPE_ANCESTOR_MISMATCH',
      `Expected ${expected.length} array scope ancestors but received ${input.length}.`,
      path,
      { actual: input.length, expected: expected.length },
    )
  }
  return input.map((entry, index) => {
    if (!isPlainObject(entry)
      || typeof entry.scopeId !== 'string'
      || !isValidRowId(entry.rowId)) {
      throw new ConfigFormValueScopeError(
        'CONFIG_FORM_VALUE_SCOPE_PATH_INVALID',
        'Scope path entries require valid scopeId and rowId strings.',
        `${path}[${index}]`,
      )
    }
    const expectedId = expected[index]!.definition.nodeId
    if (entry.scopeId !== expectedId) {
      throw new ConfigFormValueScopeError(
        'CONFIG_FORM_VALUE_SCOPE_ANCESTOR_MISMATCH',
        `Expected array scope ${expectedId} but received ${entry.scopeId}.`,
        `${path}[${index}].scopeId`,
        { actual: entry.scopeId, expected: expectedId },
      )
    }
    return { rowId: entry.rowId, scopeId: entry.scopeId }
  })
}

function collectUniqueItemKeys(
  rows: readonly ConfigFormJsonObject[],
  itemKey: string,
  scopeId: string,
  path: string,
): Map<string, number> {
  const keys = new Map<string, number>()
  rows.forEach((row, index) => {
    if (!Object.hasOwn(row, itemKey))
      return
    const itemPath = appendValuePath(`${path}[${index}]`, itemKey)
    const key = normalizeItemKey(row[itemKey], itemPath, scopeId)
    const previousIndex = keys.get(key)
    if (previousIndex !== undefined) {
      throw new ConfigFormValueScopeError(
        'CONFIG_FORM_VALUE_SCOPE_ITEM_KEY_AMBIGUOUS',
        `Array scope ${scopeId} contains duplicate itemKey values.`,
        itemPath,
        { index, itemKey, previousIndex, scopeId },
      )
    }
    keys.set(key, index)
  })
  return keys
}

function assertItemKeyValue(value: unknown, path: string, scopeId: string): void {
  normalizeItemKey(value, path, scopeId)
}

function normalizeItemKey(value: unknown, path: string, scopeId: string): string {
  if (typeof value === 'string')
    return `string:${value}`
  if (typeof value === 'number' && Number.isFinite(value))
    return `number:${Object.is(value, -0) ? 0 : value}`
  throw new ConfigFormValueScopeError(
    'CONFIG_FORM_VALUE_SCOPE_ITEM_KEY_INVALID',
    `itemKey values in array scope ${scopeId} must be strings or finite numbers.`,
    path,
    { scopeId },
  )
}

function cloneCheckedJson<T>(value: T, path: string): T {
  assertJsonValue(value, path)
  return cloneConfigFormJsonValue(value as ConfigFormJsonValue) as T
}

function cloneCheckedObject(
  value: unknown,
  path: string,
  shapeCode: string,
): ConfigFormJsonObject {
  if (!isPlainObject(value)) {
    throw new ConfigFormValueScopeError(
      shapeCode,
      'Expected a plain JSON object.',
      path,
    )
  }
  return cloneCheckedJson(value as ConfigFormJsonObject, path)
}

function cloneJsonSnapshot<T extends ConfigFormJsonValue>(value: T): T
function cloneJsonSnapshot(value: undefined): undefined
function cloneJsonSnapshot<T extends ConfigFormJsonValue | undefined>(value: T): T {
  if (value === undefined)
    return value
  return cloneConfigFormJsonValue(value) as T
}

function assertJsonValue(value: unknown, rootPath: string): asserts value is ConfigFormJsonValue {
  const ancestors = new Set<object>()
  let entries = 0

  const visit = (current: unknown, depth: number, path: string): void => {
    entries += 1
    if (entries > CONFIG_FORM_VALUE_SCOPE_MAX_ENTRIES || depth > CONFIG_FORM_VALUE_SCOPE_MAX_DEPTH) {
      throw new ConfigFormValueScopeError(
        'CONFIG_FORM_VALUE_SCOPE_JSON_LIMIT_EXCEEDED',
        'JSON data exceeds the supported size or depth.',
        path,
        { maxDepth: CONFIG_FORM_VALUE_SCOPE_MAX_DEPTH, maxEntries: CONFIG_FORM_VALUE_SCOPE_MAX_ENTRIES },
      )
    }
    if (current === null || typeof current === 'string' || typeof current === 'boolean')
      return
    if (typeof current === 'number') {
      if (!Number.isFinite(current)) {
        throw new ConfigFormValueScopeError(
          'CONFIG_FORM_VALUE_SCOPE_JSON_NON_FINITE',
          'JSON numbers must be finite.',
          path,
        )
      }
      return
    }
    if (typeof current !== 'object') {
      throw new ConfigFormValueScopeError(
        'CONFIG_FORM_VALUE_SCOPE_JSON_INVALID',
        'Value scope data must contain only JSON values.',
        path,
      )
    }
    if (ancestors.has(current)) {
      throw new ConfigFormValueScopeError(
        'CONFIG_FORM_VALUE_SCOPE_JSON_CIRCULAR',
        'Value scope data cannot contain circular references.',
        path,
      )
    }
    if (!Array.isArray(current) && !isPlainObject(current)) {
      throw new ConfigFormValueScopeError(
        'CONFIG_FORM_VALUE_SCOPE_JSON_OBJECT_INVALID',
        'Value scope data contains an unsupported object.',
        path,
      )
    }
    if (Object.getOwnPropertySymbols(current).length) {
      throw new ConfigFormValueScopeError(
        'CONFIG_FORM_VALUE_SCOPE_JSON_INVALID',
        'Value scope data cannot contain symbol keys.',
        path,
      )
    }

    ancestors.add(current)
    try {
      if (Array.isArray(current)) {
        const extraKey = Object.keys(current).find((key) => {
          const index = Number(key)
          return !Number.isInteger(index) || index < 0 || index >= current.length || String(index) !== key
        })
        if (extraKey !== undefined) {
          const unsafe = UNSAFE_KEYS.has(extraKey)
          throw new ConfigFormValueScopeError(
            unsafe ? 'CONFIG_FORM_VALUE_SCOPE_UNSAFE_KEY' : 'CONFIG_FORM_VALUE_SCOPE_JSON_INVALID',
            unsafe ? `Unsafe value key: ${extraKey}` : 'Value scope arrays cannot contain named properties.',
            appendValuePath(path, extraKey),
            { key: extraKey },
          )
        }
        for (let index = 0; index < current.length; index += 1) {
          if (!Object.hasOwn(current, index)) {
            throw new ConfigFormValueScopeError(
              'CONFIG_FORM_VALUE_SCOPE_JSON_INVALID',
              'Value scope arrays cannot contain sparse entries.',
              `${path}[${index}]`,
            )
          }
          visit(current[index], depth + 1, `${path}[${index}]`)
        }
        return
      }
      Object.entries(current).forEach(([key, child]) => {
        if (UNSAFE_KEYS.has(key)) {
          throw new ConfigFormValueScopeError(
            'CONFIG_FORM_VALUE_SCOPE_UNSAFE_KEY',
            `Unsafe value key: ${key}`,
            appendValuePath(path, key),
            { key },
          )
        }
        visit(child, depth + 1, appendValuePath(path, key))
      })
    }
    finally {
      ancestors.delete(current)
    }
  }

  visit(value, 0, rootPath)
}

function getArrayInstanceKey(scopeId: string, parentScope: ConfigFormScopePath): string {
  return getConfigFormValueScopeInstanceKey(scopeId, parentScope)
}

function cloneMetadata(metadata: MetadataMap): MetadataMap {
  return new Map([...metadata].map(([key, instance]) => [key, {
    parentScope: cloneScopePath(instance.parentScope),
    rows: instance.rows.map(row => ({ rowId: row.rowId })),
    scopeId: instance.scopeId,
  }]))
}

function collectRowScopes(metadata: MetadataMap): ConfigFormScopePathEntry[][] {
  return [...metadata.values()].flatMap(instance => instance.rows.map(row => [
    ...cloneScopePath(instance.parentScope),
    { rowId: row.rowId, scopeId: instance.scopeId },
  ]))
}

function getInvalidatedScopes(previous: MetadataMap, next: MetadataMap): ConfigFormScopePath[] {
  const nextKeys = new Set(collectRowScopes(next).map(scope => getConfigFormValueScopeInstanceKey('', scope)))
  return collectRowScopes(previous)
    .filter(scope => !nextKeys.has(getConfigFormValueScopeInstanceKey('', scope)))
    .map(cloneScopePath)
}

function cloneScopePath(scope: ConfigFormScopePath): ConfigFormScopePathEntry[] {
  return scope.map(entry => ({ rowId: entry.rowId, scopeId: entry.scopeId }))
}

function scopeStartsWith(scope: ConfigFormScopePath, prefix: ConfigFormScopePath): boolean {
  return prefix.length <= scope.length && prefix.every((entry, index) =>
    entry.scopeId === scope[index]!.scopeId && entry.rowId === scope[index]!.rowId)
}

function findRowIndex(instance: ArrayInstanceMetadata, rowId: string, path: string): number {
  if (!isValidRowId(rowId)) {
    throw new ConfigFormValueScopeError(
      'CONFIG_FORM_VALUE_SCOPE_ROW_ID_INVALID',
      'rowId must be a non-empty safe string.',
      path,
      { rowId },
    )
  }
  const index = instance.rows.findIndex(row => row.rowId === rowId)
  if (index < 0) {
    throw new ConfigFormValueScopeError(
      'CONFIG_FORM_VALUE_SCOPE_ROW_NOT_FOUND',
      `Unknown row ID ${rowId} in array scope ${instance.scopeId}.`,
      path,
      { rowId, scopeId: instance.scopeId },
    )
  }
  return index
}

function isValidRowId(value: unknown): value is string {
  return typeof value === 'string' && Boolean(value.trim()) && !UNSAFE_KEYS.has(value)
}

function assertInsertIndex(index: number, length: number): void {
  if (!Number.isInteger(index) || index < 0 || index > length) {
    throw new ConfigFormValueScopeError(
      'CONFIG_FORM_VALUE_SCOPE_INDEX_INVALID',
      `Insert index must be an integer from 0 to ${length}.`,
      'index',
      { index, length },
    )
  }
}

function assertMoveIndex(index: number, length: number): void {
  if (!Number.isInteger(index) || index < 0 || index >= length) {
    throw new ConfigFormValueScopeError(
      'CONFIG_FORM_VALUE_SCOPE_INDEX_INVALID',
      `Move index must be an integer from 0 to ${Math.max(0, length - 1)}.`,
      'toIndex',
      { index, length },
    )
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function defineValue(target: ConfigFormJsonObject, key: string, value: ConfigFormJsonValue): void {
  Object.defineProperty(target, key, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  })
}

function appendValuePath(path: string, key: string): string {
  return `${path}[${JSON.stringify(key)}]`
}

function pathToString(path: readonly (number | string)[]): string {
  return path.reduce<string>((result, segment) =>
    typeof segment === 'number' ? `${result}[${segment}]` : appendValuePath(result, segment), 'values')
}

function schemaError(code: string, message: string, path: string): ConfigFormValueScopeError {
  return new ConfigFormValueScopeError(code, message, path)
}

function metadataError(message: string, scopeId?: string): ConfigFormValueScopeError {
  return new ConfigFormValueScopeError(
    'CONFIG_FORM_VALUE_SCOPE_METADATA_INVALID',
    message,
    scopeId ? `scope:${scopeId}` : undefined,
    scopeId ? { scopeId } : {},
  )
}
