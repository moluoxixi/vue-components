import type {
  ConfigFormScopePath,
  ConfigFormValueScopeRowIdFactory,
  ConfigFormValueScopeStore,
} from '@moluoxixi/config-form-core'
import type {
  ModelJsonObject,
  PrototypeDiagnostic,
  PrototypeInstanceRuntimeSnapshotV1,
  PrototypeNodeAddressV1,
  PrototypeReadResult,
  PrototypeSurfaceContractV1,
  SafeExpressionScopeValues,
} from '../types'
import {
  ConfigFormValueScopeError,
  createConfigFormValueScopeStore,
} from '@moluoxixi/config-form-core'
import { addressKey, cloneJson, deepFreeze, sameScope, scopeKey } from '../utils'

interface PreparedRuntime {
  store: ConfigFormValueScopeStore
  snapshot: PrototypeInstanceRuntimeSnapshotV1
}

function diagnostic(message: string, path: readonly (string | number)[] = []): PrototypeDiagnostic {
  return { code: 'prototype_session_invalid', message, path }
}

function scopeChain(surface: PrototypeSurfaceContractV1, ownerScopeId: string | null): typeof surface.topology.valueScopes {
  const byId = new Map(surface.topology.valueScopes.map(scope => [scope.nodeId, scope]))
  const chain: typeof surface.topology.valueScopes[number][] = []
  let current = ownerScopeId === null ? undefined : byId.get(ownerScopeId)
  const visited = new Set<string>()
  while (current) {
    if (visited.has(current.nodeId))
      throw new Error(`Value scope topology contains a cycle at ${current.nodeId}.`)
    visited.add(current.nodeId)
    chain.unshift(current)
    current = current.parentId === undefined ? undefined : byId.get(current.parentId)
  }
  return chain
}

function enumerateScopes(
  surface: PrototypeSurfaceContractV1,
  store: ConfigFormValueScopeStore,
  ownerScopeId: string | null,
): ConfigFormScopePath[] {
  let paths: ConfigFormScopePath[] = [[]]
  for (const definition of scopeChain(surface, ownerScopeId)) {
    if (definition.kind !== 'array')
      continue
    paths = paths.flatMap(parentScope => store.listRows(definition.nodeId, parentScope).map(row => row.scope))
  }
  return paths
}

function buildSnapshot(
  surface: PrototypeSurfaceContractV1,
  store: ConfigFormValueScopeStore,
): PrototypeInstanceRuntimeSnapshotV1 {
  const nodeAddresses = surface.topology.nodeOrder.flatMap((nodeId) => {
    const owner = surface.topology.ownerScopeIdByNodeId[nodeId]
    return enumerateScopes(surface, store, owner).map(scope => ({ nodeId, scope }))
  })
  const fieldByNodeId = new Map(surface.topology.scopedFields.map(field => [field.nodeId, field]))
  const fieldInstances = surface.topology.nodeOrder.flatMap((nodeId) => {
    const field = fieldByNodeId.get(nodeId)
    if (!field)
      return []
    return enumerateScopes(surface, store, field.scopeId ?? null).map(scope => ({
      address: { nodeId, scope },
      valuePath: store.resolvePath(nodeId, scope),
    }))
  })
  return { nodeAddresses, fieldInstances }
}

export function createPrototypeRuntimeRowIdFactory(
  runtime: PrototypeInstanceRuntimeSnapshotV1,
  fallback?: ConfigFormValueScopeRowIdFactory,
): ConfigFormValueScopeRowIdFactory {
  const queues = new Map<string, string[]>()
  const seen = new Map<string, Set<string>>()
  const addresses = [
    ...runtime.nodeAddresses,
    ...runtime.fieldInstances.map(field => field.address),
  ]
  for (const address of addresses) {
    for (let index = 0; index < address.scope.length; index += 1) {
      const entry = address.scope[index]!
      const parentScope = address.scope.slice(0, index)
      const key = `${entry.scopeId}:${scopeKey(parentScope)}`
      const values = queues.get(key) ?? []
      const ids = seen.get(key) ?? new Set<string>()
      if (!ids.has(entry.rowId)) {
        ids.add(entry.rowId)
        values.push(entry.rowId)
      }
      queues.set(key, values)
      seen.set(key, ids)
    }
  }
  const offsets = new Map<string, number>()
  return (context) => {
    const { scopeId, parentScope } = context
    const key = `${scopeId}:${scopeKey(parentScope)}`
    const offset = offsets.get(key) ?? 0
    offsets.set(key, offset + 1)
    return queues.get(key)?.[offset]
      ?? fallback?.(context)
      ?? `__missing-runtime-row-${scopeId}-${offset}`
  }
}

function sameAddress(left: PrototypeNodeAddressV1, right: PrototypeNodeAddressV1): boolean {
  return left.nodeId === right.nodeId && sameScope(left.scope, right.scope)
}

function sameSnapshot(
  expected: PrototypeInstanceRuntimeSnapshotV1,
  received: PrototypeInstanceRuntimeSnapshotV1,
): boolean {
  return expected.nodeAddresses.length === received.nodeAddresses.length
    && expected.nodeAddresses.every((address, index) => sameAddress(address, received.nodeAddresses[index]!))
    && expected.fieldInstances.length === received.fieldInstances.length
    && expected.fieldInstances.every((field, index) => {
      const candidate = received.fieldInstances[index]!
      return sameAddress(field.address, candidate.address)
        && field.valuePath.length === candidate.valuePath.length
        && field.valuePath.every((segment, pathIndex) => segment === candidate.valuePath[pathIndex])
    })
}

function prepare(
  surface: PrototypeSurfaceContractV1,
  values: ModelJsonObject,
  createRowId?: ConfigFormValueScopeRowIdFactory,
): PrototypeReadResult<PreparedRuntime> {
  try {
    const store = createConfigFormValueScopeStore({
      scopes: surface.topology.valueScopes,
      fields: surface.topology.scopedFields,
      values,
      ...(createRowId ? { createRowId } : {}),
    })
    return {
      success: true,
      data: { store, snapshot: buildSnapshot(surface, store) },
      diagnostics: [],
    }
  }
  catch (error) {
    const message = error instanceof Error ? error.message : 'Runtime snapshot cannot resolve the Surface value topology.'
    return {
      success: false,
      diagnostics: [diagnostic(message, error instanceof ConfigFormValueScopeError && error.path ? [error.path] : [])],
    }
  }
}

export function createPrototypeInstanceRuntimeSnapshot(
  surface: PrototypeSurfaceContractV1,
  values: ModelJsonObject,
  createRowId: ConfigFormValueScopeRowIdFactory,
): PrototypeReadResult<PrototypeInstanceRuntimeSnapshotV1> {
  const result = prepare(surface, values, createRowId)
  if (!result.success)
    return result
  return {
    success: true,
    data: deepFreeze(result.data.snapshot) as PrototypeInstanceRuntimeSnapshotV1,
    diagnostics: [],
  }
}

export function preparePrototypeRuntime(
  surface: PrototypeSurfaceContractV1,
  values: ModelJsonObject,
  runtime: PrototypeInstanceRuntimeSnapshotV1,
): PrototypeReadResult<PreparedRuntime> {
  const result = prepare(surface, values, createPrototypeRuntimeRowIdFactory(runtime))
  if (!result.success)
    return result
  if (!sameSnapshot(result.data.snapshot, runtime)) {
    return {
      success: false,
      diagnostics: [diagnostic('Runtime snapshot does not exactly match current values and Surface topology.', ['runtime'])],
    }
  }
  return result
}

function getObjectAtPath(values: ModelJsonObject, path: readonly (string | number)[]): ModelJsonObject {
  let current: unknown = values
  for (const segment of path) {
    if (typeof current !== 'object' || current === null || !Object.hasOwn(current, segment))
      throw new Error('Runtime scope path is missing from current values.')
    current = (current as Record<string | number, unknown>)[segment]
  }
  if (typeof current !== 'object' || current === null || Array.isArray(current))
    throw new Error('Runtime scope path does not resolve to a JSON object.')
  return cloneJson(current as ModelJsonObject)
}

function containerPaths(
  surface: PrototypeSurfaceContractV1,
  store: ConfigFormValueScopeStore,
  ownerScopeId: string | null,
  scope: ConfigFormScopePath,
): (string | number)[][] {
  const paths: (string | number)[][] = [[]]
  const currentPath: (string | number)[] = []
  let arrayScope: ConfigFormScopePath = []
  for (const definition of scopeChain(surface, ownerScopeId)) {
    currentPath.push(definition.field)
    if (definition.kind === 'array') {
      const entry = scope[arrayScope.length]
      if (!entry || entry.scopeId !== definition.nodeId)
        throw new Error(`Runtime address is missing array scope ${definition.nodeId}.`)
      const rows = store.listRows(definition.nodeId, arrayScope)
      const index = rows.findIndex(row => row.rowId === entry.rowId)
      if (index < 0)
        throw new Error(`Runtime address references a stale row ${entry.rowId}.`)
      currentPath.push(index)
      arrayScope = [...arrayScope, entry]
    }
    paths.push([...currentPath])
  }
  if (arrayScope.length !== scope.length)
    throw new Error('Runtime address contains unrelated row scope entries.')
  return paths
}

export function resolvePrototypeScopeValues(
  surface: PrototypeSurfaceContractV1,
  values: ModelJsonObject,
  prepared: PreparedRuntime,
  address: PrototypeNodeAddressV1,
): PrototypeReadResult<SafeExpressionScopeValues> {
  if (surface.topology.ownerScopeIdByNodeId[address.nodeId] === undefined) {
    return { success: false, diagnostics: [diagnostic('Expression address references an unknown node.')] }
  }
  try {
    const paths = containerPaths(
      surface,
      prepared.store,
      surface.topology.ownerScopeIdByNodeId[address.nodeId],
      address.scope,
    )
    const currentPath = paths.at(-1) ?? []
    const parentPath = paths.length > 1 ? paths.at(-2)! : []
    return {
      success: true,
      data: {
        current: getObjectAtPath(values, currentPath),
        parent: getObjectAtPath(values, parentPath),
        root: cloneJson(values),
      },
      diagnostics: [],
    }
  }
  catch (error) {
    return {
      success: false,
      diagnostics: [diagnostic(error instanceof Error ? error.message : 'Expression scope cannot be resolved.')],
    }
  }
}

export function resolvePrototypeFieldAddress(
  surface: PrototypeSurfaceContractV1,
  runtime: PrototypeInstanceRuntimeSnapshotV1,
  sourceAddress: PrototypeNodeAddressV1,
  targetFieldId: string,
): PrototypeNodeAddressV1 | undefined {
  const target = surface.topology.scopedFields.find(field => field.nodeId === targetFieldId)
  if (!target)
    return undefined
  const sourceOwner = surface.topology.ownerScopeIdByNodeId[sourceAddress.nodeId]
  if (sourceOwner === undefined)
    return undefined
  const sourceChain = scopeChain(surface, sourceOwner)
  const targetChain = scopeChain(surface, target.scopeId ?? null)
  if (targetChain.length > sourceChain.length
    || targetChain.some((scope, index) => scope.nodeId !== sourceChain[index]?.nodeId)) {
    return undefined
  }
  const targetArrayIds = targetChain.filter(scope => scope.kind === 'array').map(scope => scope.nodeId)
  const scope = sourceAddress.scope.slice(0, targetArrayIds.length)
  if (scope.some((entry, index) => entry.scopeId !== targetArrayIds[index]))
    return undefined
  const address = { nodeId: targetFieldId, scope }
  return runtime.fieldInstances.some(field => sameAddress(field.address, address)) ? address : undefined
}

export function hasRuntimeAddress(
  runtime: PrototypeInstanceRuntimeSnapshotV1,
  address: PrototypeNodeAddressV1,
  fieldsOnly = false,
): boolean {
  const addresses = fieldsOnly ? runtime.fieldInstances.map(field => field.address) : runtime.nodeAddresses
  return addresses.some(candidate => sameAddress(candidate, address))
}

export function runtimeAddressKey(address: PrototypeNodeAddressV1): string {
  return addressKey(address.nodeId, address.scope)
}
