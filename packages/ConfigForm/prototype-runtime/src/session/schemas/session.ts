import type {
  PrototypeDiagnostic,
  PrototypeInstanceProjectionV1,
  PrototypeNodeProjectionV1,
  PrototypeReadResult,
  PrototypeSessionV1,
  SurfaceInstanceV1,
} from '../types'
import { PROTOTYPE_SESSION_VERSION } from '../constants'
import { addressKey, cloneJson, deepFreeze, hasExactKeys, isJsonObject, isJsonValue, isRecord, isSafeIdentifier } from '../utils'
import { invalidContract, readNodeAddress, readRuntimeSnapshot } from './common'

function unsupportedVersion(input: unknown): PrototypeReadResult<never> {
  return {
    success: false,
    diagnostics: [{
      code: 'unsupported_contract_version',
      message: `Prototype session requires version ${PROTOTYPE_SESSION_VERSION}.`,
      path: ['version'],
      context: {
        contract: 'PrototypeSession',
        expected: PROTOTYPE_SESSION_VERSION,
        received: isRecord(input) && isJsonValue(input.version) ? input.version : null,
      },
    }],
  }
}

function readProjection(
  input: unknown,
  path: readonly (string | number)[],
  diagnostics: PrototypeDiagnostic[],
): PrototypeInstanceProjectionV1 | undefined {
  if (!Array.isArray(input)) {
    diagnostics.push(invalidContract('prototype_session_invalid', 'Instance projection must be an array.', path))
    return undefined
  }
  const entries: PrototypeNodeProjectionV1[] = []
  const addresses = new Set<string>()
  for (let index = 0; index < input.length; index += 1) {
    const entry = input[index]
    if (!isRecord(entry) || !hasExactKeys(entry, ['address', 'states', 'properties'])
      || !isRecord(entry.states) || !Array.isArray(entry.properties)
      || Object.keys(entry.states).some(key => !['visible', 'disabled', 'readonly', 'required'].includes(key))
      || Object.values(entry.states).some(value => typeof value !== 'boolean')) {
      diagnostics.push(invalidContract('prototype_session_invalid', 'Projection entry has an invalid shape.', [...path, index]))
      return undefined
    }
    const address = readNodeAddress(entry.address, [...path, index, 'address'], diagnostics)
    if (!address)
      return undefined
    const key = addressKey(address.nodeId, address.scope)
    if (addresses.has(key)) {
      diagnostics.push(invalidContract('prototype_session_invalid', 'Projection contains a duplicate node address.', [...path, index, 'address']))
      return undefined
    }
    addresses.add(key)
    const propertyKeys = new Set<string>()
    const properties: PrototypeNodeProjectionV1['properties'][number][] = []
    for (let propertyIndex = 0; propertyIndex < entry.properties.length; propertyIndex += 1) {
      const property = entry.properties[propertyIndex]
      if (!isRecord(property) || !hasExactKeys(property, ['path', 'value']) || !Array.isArray(property.path)
        || property.path.length === 0 || !property.path.every(isSafeIdentifier) || !isJsonValue(property.value)) {
        diagnostics.push(invalidContract('prototype_session_invalid', 'Projection property has an invalid shape.', [...path, index, 'properties', propertyIndex]))
        return undefined
      }
      const propertyPath = [...property.path] as string[]
      const propertyKey = JSON.stringify(propertyPath)
      if (propertyKeys.has(propertyKey)) {
        diagnostics.push(invalidContract('prototype_session_invalid', 'Projection contains a duplicate property path.', [...path, index, 'properties', propertyIndex]))
        return undefined
      }
      propertyKeys.add(propertyKey)
      properties.push({ path: propertyPath, value: cloneJson(property.value) })
    }
    entries.push({
      address,
      states: { ...entry.states },
      properties,
    })
  }
  return entries
}

function readInstance(
  input: unknown,
  path: readonly (string | number)[],
  diagnostics: PrototypeDiagnostic[],
): SurfaceInstanceV1 | undefined {
  if (!isRecord(input) || !hasExactKeys(
    input,
    ['instanceId', 'surfaceId', 'parameters', 'values', 'runtime', 'projection'],
    ['parentInstanceId', 'openerAddress', 'openerInteractionId'],
  ) || !isSafeIdentifier(input.instanceId) || !isSafeIdentifier(input.surfaceId)
  || !isJsonObject(input.parameters) || !isJsonObject(input.values)) {
    diagnostics.push(invalidContract('prototype_session_invalid', 'Surface instance has an invalid shape.', path))
    return undefined
  }
  const triple = [input.parentInstanceId, input.openerAddress, input.openerInteractionId]
  if (!triple.every(value => value === undefined) && !triple.every(value => value !== undefined)) {
    diagnostics.push(invalidContract('prototype_session_invalid', 'Overlay opener identity must be present or absent as one tuple.', path))
    return undefined
  }
  if (input.parentInstanceId !== undefined && (!isSafeIdentifier(input.parentInstanceId) || !isSafeIdentifier(input.openerInteractionId))) {
    diagnostics.push(invalidContract('prototype_session_invalid', 'Overlay opener identifiers are invalid.', path))
    return undefined
  }
  const openerAddress = input.openerAddress === undefined
    ? undefined
    : readNodeAddress(input.openerAddress, [...path, 'openerAddress'], diagnostics)
  const runtime = readRuntimeSnapshot(input.runtime, [...path, 'runtime'], diagnostics)
  const projection = readProjection(input.projection, [...path, 'projection'], diagnostics)
  if (!runtime || !projection || (input.openerAddress !== undefined && !openerAddress))
    return undefined
  return {
    instanceId: input.instanceId,
    surfaceId: input.surfaceId,
    ...(input.parentInstanceId === undefined
      ? {}
      : {
          parentInstanceId: input.parentInstanceId,
          openerAddress: openerAddress!,
          openerInteractionId: input.openerInteractionId as string,
        }),
    parameters: cloneJson(input.parameters),
    values: cloneJson(input.values),
    runtime,
    projection,
  }
}

export function readPrototypeSessionShape(input: unknown): PrototypeReadResult<PrototypeSessionV1> {
  if (!isRecord(input) || input.version !== PROTOTYPE_SESSION_VERSION)
    return unsupportedVersion(input)
  if (!hasExactKeys(input, ['version', 'projectId', 'pageHistory', 'overlayStack', 'instancesById'])
    || !isSafeIdentifier(input.projectId) || !Array.isArray(input.pageHistory)
    || !Array.isArray(input.overlayStack) || !isRecord(input.instancesById)) {
    return { success: false, diagnostics: [invalidContract('prototype_session_invalid', 'Prototype session has an invalid shape.')] }
  }
  const diagnostics: PrototypeDiagnostic[] = []
  const instanceInputs = input.instancesById
  const pageHistory = input.pageHistory.filter(isSafeIdentifier)
  const overlayStack = input.overlayStack.filter(isSafeIdentifier)
  if (pageHistory.length !== input.pageHistory.length || overlayStack.length !== input.overlayStack.length) {
    return { success: false, diagnostics: [invalidContract('prototype_session_invalid', 'Session stacks require safe instance IDs.')] }
  }
  const liveIds = [...pageHistory, ...overlayStack]
  if (pageHistory.length === 0) {
    return { success: false, diagnostics: [invalidContract('prototype_session_invalid', 'Session requires an active Page instance.', ['pageHistory'])] }
  }
  if (new Set(liveIds).size !== liveIds.length || new Set(Object.keys(instanceInputs)).size !== liveIds.length
    || liveIds.some(id => !Object.hasOwn(instanceInputs, id))
    || Object.keys(instanceInputs).some(id => !liveIds.includes(id))) {
    return { success: false, diagnostics: [invalidContract('prototype_session_invalid', 'instancesById must equal the exact live stack union.')] }
  }
  const instancesById: Record<string, SurfaceInstanceV1> = Object.create(null)
  for (const instanceId of liveIds) {
    const instance = readInstance(instanceInputs[instanceId], ['instancesById', instanceId], diagnostics)
    if (!instance)
      continue
    if (instance.instanceId !== instanceId) {
      diagnostics.push(invalidContract('prototype_session_invalid', 'Instance map key must equal instanceId.', ['instancesById', instanceId, 'instanceId']))
      continue
    }
    const isOverlay = overlayStack.includes(instanceId)
    if (isOverlay !== (instance.parentInstanceId !== undefined)) {
      diagnostics.push(invalidContract('prototype_session_invalid', 'Only overlay instances carry opener identity.', ['instancesById', instanceId]))
      continue
    }
    if (instance.parentInstanceId !== undefined && !Object.hasOwn(instanceInputs, instance.parentInstanceId)) {
      diagnostics.push(invalidContract('prototype_session_invalid', 'Overlay parent must remain live.', ['instancesById', instanceId, 'parentInstanceId']))
      continue
    }
    instancesById[instanceId] = instance
  }
  if (diagnostics.length > 0)
    return { success: false, diagnostics }
  return {
    success: true,
    data: deepFreeze({
      version: PROTOTYPE_SESSION_VERSION,
      projectId: input.projectId,
      pageHistory,
      overlayStack,
      instancesById,
    }) as PrototypeSessionV1,
    diagnostics: [],
  }
}
