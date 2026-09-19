import type { ConfigFormScopePath } from '@moluoxixi/config-form-core'
import type {
  PrototypeDiagnostic,
  PrototypeFieldInstanceAddressV1,
  PrototypeInstanceRuntimeSnapshotV1,
  PrototypeNodeAddressV1,
} from '../types'
import {
  SAFE_EXPRESSION_MAX_DEPTH,
} from '../constants'
import { addressKey, hasExactKeys, isRecord, isSafeIdentifier } from '../utils'

export function invalidContract(
  code: string,
  message: string,
  path: readonly (string | number)[] = [],
): PrototypeDiagnostic {
  return { code, message, path }
}

export function readScopePath(
  input: unknown,
  path: readonly (string | number)[],
  diagnostics: PrototypeDiagnostic[],
): ConfigFormScopePath | undefined {
  if (!Array.isArray(input) || input.length > SAFE_EXPRESSION_MAX_DEPTH) {
    diagnostics.push(invalidContract('prototype_session_invalid', 'Scope path must be a bounded array.', path))
    return undefined
  }
  const result: { scopeId: string, rowId: string }[] = []
  const scopeIds = new Set<string>()
  for (let index = 0; index < input.length; index += 1) {
    const entry = input[index]
    if (!isRecord(entry) || !hasExactKeys(entry, ['scopeId', 'rowId'])
      || !isSafeIdentifier(entry.scopeId) || !isSafeIdentifier(entry.rowId)
      || scopeIds.has(entry.scopeId)) {
      diagnostics.push(invalidContract(
        'prototype_session_invalid',
        'Scope path entries require unique safe scopeId and rowId values.',
        [...path, index],
      ))
      return undefined
    }
    scopeIds.add(entry.scopeId)
    result.push({ scopeId: entry.scopeId, rowId: entry.rowId })
  }
  return result
}

export function readNodeAddress(
  input: unknown,
  path: readonly (string | number)[],
  diagnostics: PrototypeDiagnostic[],
): PrototypeNodeAddressV1 | undefined {
  if (!isRecord(input) || !hasExactKeys(input, ['nodeId', 'scope']) || !isSafeIdentifier(input.nodeId)) {
    diagnostics.push(invalidContract('prototype_session_invalid', 'Node address has an invalid shape.', path))
    return undefined
  }
  const scope = readScopePath(input.scope, [...path, 'scope'], diagnostics)
  return scope ? { nodeId: input.nodeId, scope } : undefined
}

export function readRuntimeSnapshot(
  input: unknown,
  path: readonly (string | number)[],
  diagnostics: PrototypeDiagnostic[],
): PrototypeInstanceRuntimeSnapshotV1 | undefined {
  if (!isRecord(input) || !hasExactKeys(input, ['nodeAddresses', 'fieldInstances'])
    || !Array.isArray(input.nodeAddresses) || !Array.isArray(input.fieldInstances)) {
    diagnostics.push(invalidContract('prototype_session_invalid', 'Runtime snapshot has an invalid shape.', path))
    return undefined
  }
  const nodeAddresses: PrototypeNodeAddressV1[] = []
  const nodeKeys = new Set<string>()
  for (let index = 0; index < input.nodeAddresses.length; index += 1) {
    const address = readNodeAddress(input.nodeAddresses[index], [...path, 'nodeAddresses', index], diagnostics)
    if (!address)
      return undefined
    const key = addressKey(address.nodeId, address.scope)
    if (nodeKeys.has(key)) {
      diagnostics.push(invalidContract('prototype_session_invalid', 'Runtime snapshot contains a duplicate node address.', [...path, 'nodeAddresses', index]))
      return undefined
    }
    nodeKeys.add(key)
    nodeAddresses.push(address)
  }

  const fieldInstances: PrototypeFieldInstanceAddressV1[] = []
  const fieldKeys = new Set<string>()
  const valuePaths = new Set<string>()
  for (let index = 0; index < input.fieldInstances.length; index += 1) {
    const field = input.fieldInstances[index]
    if (!isRecord(field) || !hasExactKeys(field, ['address', 'valuePath'])
      || !Array.isArray(field.valuePath) || field.valuePath.length === 0) {
      diagnostics.push(invalidContract('prototype_session_invalid', 'Runtime field instance has an invalid shape.', [...path, 'fieldInstances', index]))
      return undefined
    }
    const address = readNodeAddress(field.address, [...path, 'fieldInstances', index, 'address'], diagnostics)
    if (!address)
      return undefined
    const valuePath: (string | number)[] = []
    for (let segmentIndex = 0; segmentIndex < field.valuePath.length; segmentIndex += 1) {
      const segment = field.valuePath[segmentIndex]
      if ((typeof segment !== 'string' || !isSafeIdentifier(segment))
        && (typeof segment !== 'number' || !Number.isSafeInteger(segment) || segment < 0)) {
        diagnostics.push(invalidContract('prototype_session_invalid', 'Runtime value paths require safe strings or non-negative indexes.', [...path, 'fieldInstances', index, 'valuePath', segmentIndex]))
        return undefined
      }
      valuePath.push(segment)
    }
    const key = addressKey(address.nodeId, address.scope)
    const valuePathKey = JSON.stringify(valuePath)
    if (fieldKeys.has(key) || valuePaths.has(valuePathKey) || !nodeKeys.has(key)) {
      diagnostics.push(invalidContract('prototype_session_invalid', 'Runtime field instance must map one live node address to one value path.', [...path, 'fieldInstances', index]))
      return undefined
    }
    fieldKeys.add(key)
    valuePaths.add(valuePathKey)
    fieldInstances.push({ address, valuePath })
  }
  return { nodeAddresses, fieldInstances }
}
