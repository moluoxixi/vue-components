import type {
  ConfigFormJsonObject,
  ConfigFormScopedFieldDefinition,
  ConfigFormScopePath,
  ConfigFormValueScopeDefinition,
  ConfigFormValueScopeRetainedArray,
  ConfigFormValueScopeStore,
} from '@moluoxixi/config-form-core'
import type {
  ConfigFormFieldAddress,
  ConfigFormFieldInstance,
  ConfigFormValues,
  ConfigFormValueSchema,
} from '../types'
import type { ControllerNode, ControllerScopeService } from '../types/controller-internal'
import {
  createConfigFormValueScopeStore,
  getConfigFormValueScopeInstanceKey,
} from '@moluoxixi/config-form-core'
import { cloneControllerValue } from './controller-values'

export function resolveControllerValueSchema<TValues extends ConfigFormJsonObject>(
  nodes: ControllerNode<TValues>[],
  explicit?: ConfigFormValueSchema,
): ConfigFormValueSchema | undefined {
  if (explicit) {
    return {
      scopedFields: explicit.scopedFields.map(definition => cloneControllerValue(definition)),
      valueScopes: explicit.valueScopes.map(definition => cloneControllerValue(definition)),
    }
  }

  const derived = deriveControllerValueSchema(nodes)
  return derived.valueScopes.length > 0 ? derived : undefined
}

export function createControllerScopeService(
  schema: ConfigFormValueSchema,
  values: ConfigFormJsonObject,
  createRowId?: Parameters<typeof createConfigFormValueScopeStore>[0]['createRowId'],
): ControllerScopeService {
  const copiedSchema: ConfigFormValueSchema = {
    scopedFields: schema.scopedFields.map(definition => cloneControllerValue(definition)),
    valueScopes: schema.valueScopes.map(definition => cloneControllerValue(definition)),
  }
  const store = createConfigFormValueScopeStore({
    createRowId,
    fields: copiedSchema.scopedFields,
    scopes: copiedSchema.valueScopes,
    values,
  })
  const definitions = copiedSchema.scopedFields
  const definitionById = new Map(definitions.map(definition => [definition.nodeId, definition]))
  const scopeById = new Map(copiedSchema.valueScopes.map(scope => [scope.nodeId, scope]))
  const rootDefinitionByField = new Map(
    definitions
      .filter(definition => definition.scopeId === undefined)
      .map(definition => [definition.field, definition]),
  )

  function getDefinition(nodeId: string): ConfigFormScopedFieldDefinition {
    const definition = definitionById.get(nodeId)
    if (!definition)
      throw new Error(`Unknown ConfigForm field node: ${nodeId}`)
    return definition
  }

  function getInstanceKey(address: ConfigFormFieldAddress): string {
    getDefinition(address.nodeId)
    store.resolvePath(address.nodeId, address.scope)
    return getConfigFormValueScopeInstanceKey(address.nodeId, address.scope)
  }

  function getInstance(address: ConfigFormFieldAddress): ConfigFormFieldInstance {
    const definition = getDefinition(address.nodeId)
    const scope = cloneScope(address.scope)
    const valuePath = store.resolvePath(definition.nodeId, scope)
    return {
      address: { nodeId: definition.nodeId, scope },
      field: definition.field,
      instanceKey: getConfigFormValueScopeInstanceKey(definition.nodeId, scope),
      ...(definition.scopeId === undefined ? {} : { ownerScopeId: definition.scopeId }),
      value: store.getValue(definition.nodeId, scope),
      valuePath: [...valuePath],
    }
  }

  function listInstances(nodeId?: string): ConfigFormFieldInstance[] {
    return definitions.flatMap((definition) => {
      if (nodeId !== undefined && definition.nodeId !== nodeId)
        return []
      return enumerateFieldScopes(definition, scopeById, store).map(scope => getInstance({
        nodeId: definition.nodeId,
        scope,
      }))
    })
  }

  function listRowIds(scopeIds?: ReadonlySet<string>): Map<string, string[]> {
    const rows = new Map<string, string[]>()
    copiedSchema.valueScopes.forEach((scope) => {
      if (scope.kind !== 'array' || (scopeIds && !scopeIds.has(scope.nodeId)))
        return
      const parents = enumerateFieldScopes({
        nodeId: scope.nodeId,
        field: scope.field,
        scopeId: scope.parentId,
      }, scopeById, store)
      parents.forEach((parentScope) => {
        rows.set(getConfigFormValueScopeInstanceKey(scope.nodeId, parentScope), store.listRows(scope.nodeId, parentScope).map(row => row.rowId))
      })
    })
    return rows
  }

  return {
    definitions,
    getDefinition,
    getInstance,
    getInstanceKey,
    getRootDefinition: field => rootDefinitionByField.get(field),
    listInstances,
    listRowIds,
    schema: copiedSchema,
    store,
  }
}

export function deriveControllerValueSchema<TValues extends ConfigFormJsonObject>(
  nodes: ControllerNode<TValues>[],
): ConfigFormValueSchema {
  const valueScopes: ConfigFormValueScopeDefinition[] = []
  const scopedFields: ConfigFormScopedFieldDefinition[] = []

  const visit = (
    node: ControllerNode<TValues>,
    ownerScopeId: string | undefined,
    ancestors: ReadonlySet<object>,
  ): void => {
    if (ancestors.has(node))
      throw new Error('ConfigForm node slots must not contain circular references.')
    const nextAncestors = new Set(ancestors).add(node)

    if ('field' in node) {
      scopedFields.push({
        field: node.field,
        nodeId: node.id,
        ...(ownerScopeId === undefined ? {} : { scopeId: ownerScopeId }),
        ...(node.defaultValue === undefined
          ? {}
          : { defaultValue: cloneControllerValue(node.defaultValue) as ConfigFormScopedFieldDefinition['defaultValue'] }),
      })
      return
    }

    let childOwner = ownerScopeId
    if (node.valueScope) {
      valueScopes.push({
        field: node.valueScope.field,
        kind: node.valueScope.kind,
        nodeId: node.id,
        ...(ownerScopeId === undefined ? {} : { parentId: ownerScopeId }),
        ...(node.valueScope.itemKey === undefined ? {} : { itemKey: node.valueScope.itemKey }),
        ...(node.valueScope.minItems === undefined ? {} : { minItems: node.valueScope.minItems }),
        ...(node.valueScope.maxItems === undefined ? {} : { maxItems: node.valueScope.maxItems }),
      })
      childOwner = node.id
    }

    Object.values(node.slots ?? {}).forEach((slot) => {
      if (typeof slot === 'function')
        return
      const children = Array.isArray(slot) ? slot : [slot]
      children.forEach(child => visit(child as ControllerNode<TValues>, childOwner, nextAncestors))
    })
  }

  nodes.forEach(node => visit(node, undefined, new Set()))
  return { scopedFields, valueScopes }
}

function enumerateFieldScopes(
  field: ConfigFormScopedFieldDefinition,
  scopeById: ReadonlyMap<string, ConfigFormValueScopeDefinition>,
  store: ConfigFormValueScopeStore,
): ConfigFormScopePath[] {
  const chain: ConfigFormValueScopeDefinition[] = []
  let scopeId = field.scopeId
  while (scopeId !== undefined) {
    const scope = scopeById.get(scopeId)
    if (!scope)
      throw new Error(`Unknown ConfigForm value scope: ${scopeId}`)
    chain.unshift(scope)
    scopeId = scope.parentId
  }

  let paths: ConfigFormScopePath[] = [[]]
  chain.forEach((scope) => {
    if (scope.kind !== 'array')
      return
    paths = paths.flatMap(parentScope => store.listRows(scope.nodeId, parentScope).map(row => cloneScope(row.scope)))
  })
  return paths
}

function cloneScope(scope: ConfigFormScopePath): ConfigFormScopePath {
  return scope.map(entry => ({ rowId: entry.rowId, scopeId: entry.scopeId }))
}

interface ObservedModelArray {
  scopeId: string
  parentScope: ConfigFormScopePath
  valuePath: readonly (number | string)[]
  value: unknown[]
  rows: unknown[]
  rowIds: string[]
}

/** Keep host references separate from the defensive Core value snapshots. */
export function createControllerModelObserver(service: ControllerScopeService, initial: ConfigFormValues) {
  const children = new Map<string | undefined, ConfigFormValueScopeDefinition[]>()
  service.schema.valueScopes.forEach((scope) => {
    children.set(scope.parentId, [...(children.get(scope.parentId) ?? []), scope])
  })
  // Declaring a business key means an equal external replacement is a reconciliation
  // rather than an invalidation, so arrays observed at the same path keep their row
  // identity even when the host handed over fresh array objects.
  const reconcilesByPath = service.schema.valueScopes.some(scope => scope.kind === 'array' && scope.itemKey !== undefined)
  let observed = new Map<string, ObservedModelArray>()

  function visit(
    values: unknown,
    parentId: string | undefined,
    path: readonly (number | string)[],
    parentScope: ConfigFormScopePath,
    onArray: (value: unknown[], scope: ConfigFormValueScopeDefinition, path: readonly (number | string)[], parentScope: ConfigFormScopePath) => readonly ConfigFormScopePath[],
  ): void {
    if (values === null || typeof values !== 'object')
      return
    for (const scope of children.get(parentId) ?? []) {
      const value = (values as Record<string, unknown>)[scope.field]
      const valuePath = [...path, scope.field]
      if (scope.kind === 'object') {
        visit(value, scope.nodeId, valuePath, parentScope, onArray)
      }
      else if (Array.isArray(value)) {
        const rowScopes = onArray(value, scope, valuePath, parentScope)
        value.forEach((row, index) => {
          // A host row the store does not own has no owned child scopes: descending
          // with a fabricated parent scope would fail ancestor resolution. This is
          // reachable when a schema refresh prunes rows the host model still carries.
          const rowScope = rowScopes[index]
          if (rowScope)
            visit(row, scope.nodeId, [...valuePath, index], rowScope, onArray)
        })
      }
    }
  }

  function observe(values: ConfigFormValues): void {
    const next = new Map<string, ObservedModelArray>()
    visit(values, undefined, [], [], (value, scope, valuePath, parentScope) => {
      const rows = service.store.listRows(scope.nodeId, parentScope)
      next.set(JSON.stringify(valuePath), {
        scopeId: scope.nodeId,
        parentScope,
        valuePath,
        value,
        rows: [...value],
        rowIds: rows.map(row => row.rowId),
      })
      return rows.map(row => row.scope)
    })
    observed = next
  }

  function prepare(values: ConfigFormValues) {
    const byReference = new Map<unknown[], ObservedModelArray[]>()
    observed.forEach((array) => {
      byReference.set(array.value, [...(byReference.get(array.value) ?? []), array])
    })
    const retainedArrays: ConfigFormValueScopeRetainedArray[] = []
    let changed = false
    let count = 0
    visit(values, undefined, [], [], (value, scope, valuePath) => {
      count += 1
      const atPath = observed.get(JSON.stringify(valuePath))
      const atPathMatches = atPath?.value === value
      const observedByReference = byReference.get(value)?.find(array => array.scopeId === scope.nodeId)
      const previous = atPathMatches
        ? atPath
        : observedByReference ?? (reconcilesByPath ? atPath : undefined)
      if (atPath?.value !== value || atPath.rows.length !== value.length
        || atPath.rows.some((row, index) => row !== value[index])) {
        changed = true
      }

      const rowIdsByReference = new Map<unknown, string>()
      const rowIdsByItemKey = new Map<string, string>()
      if (previous) {
        previous.rows.forEach((row, index) => {
          const rowId = previous.rowIds[index]
          if (rowId === undefined)
            return
          rowIdsByReference.set(row, rowId)
          if (scope.itemKey && row !== null && typeof row === 'object') {
            const key = (row as Record<string, unknown>)[scope.itemKey]
            if (key !== undefined && key !== null)
              rowIdsByItemKey.set(`${typeof key}:${String(key)}`, rowId)
          }
        })
      }
      // An unkeyed array that only matched by path has neither a row reference nor a
      // business key to compare, so its row identities follow the row positions.
      const positionalIds = previous && !scope.itemKey && !atPathMatches && !observedByReference
        ? previous.rowIds
        : undefined
      const rowIds = value.map((row, index) => {
        const byRow = rowIdsByReference.get(row)
        if (byRow !== undefined)
          return byRow
        if (scope.itemKey && row !== null && typeof row === 'object') {
          const key = (row as Record<string, unknown>)[scope.itemKey]
          if (key !== undefined && key !== null)
            return rowIdsByItemKey.get(`${typeof key}:${String(key)}`) ?? null
        }
        return positionalIds?.[index] ?? null
      })
      // Core rejects an empty retained identity list, and an array with no rows has
      // nothing to retain, so such an array is simply not reported as retained.
      if (previous && rowIds.length > 0) {
        retainedArrays.push({
          scopeId: scope.nodeId,
          parentScope: previous.parentScope,
          valuePath,
          rowIds,
        })
      }
      const rowScopes = rowIds.map(rowId => rowId === null
        ? []
        : [...(previous?.parentScope ?? []), { scopeId: scope.nodeId, rowId }])
      return rowScopes
    })
    return { changed: changed || count !== observed.size, retainedArrays }
  }

  observe(initial)
  return { observe, prepare }
}
