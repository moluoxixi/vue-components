import type {
  ModelJsonObject,
  PrimaryUiActionBinding,
  PrototypeDiagnostic,
  PrototypeInstanceProjectionV1,
  PrototypeProjectContextV1,
  PrototypeReadResult,
  PrototypeSessionV1,
  PrototypeSurfaceContractV1,
  SurfaceInstanceV1,
} from '../types'
import { readPrototypeProjectContext } from '../schemas'
import { readPrototypeSessionShape } from '../schemas/session'
import { deepJsonEqual, sameScope } from '../utils'
import { projectPrototypeInstance } from './projection'
import { hasRuntimeAddress, preparePrototypeRuntime } from './runtime-snapshot'

function invalid(
  message: string,
  path: readonly (string | number)[] = [],
): PrototypeDiagnostic {
  return { code: 'prototype_session_invalid', message, path }
}

function prefixInstanceDiagnostic(
  instanceId: string,
  diagnostic: PrototypeDiagnostic,
): PrototypeDiagnostic {
  return {
    ...diagnostic,
    path: ['instancesById', instanceId, ...(diagnostic.path ?? [])],
  }
}

function hasValidParameters(
  surface: PrototypeSurfaceContractV1,
  parameters: Readonly<ModelJsonObject>,
): boolean {
  const definitions = new Map(surface.parameters.map(parameter => [parameter.name, parameter]))
  return Object.keys(parameters).every(name => definitions.has(name))
    && surface.parameters.every(parameter => (
      (!parameter.required && parameter.defaultValue === undefined)
      || Object.hasOwn(parameters, parameter.name)
    ))
}

function sameProjection(
  left: PrototypeInstanceProjectionV1,
  right: PrototypeInstanceProjectionV1,
): boolean {
  return left.length === right.length && left.every((entry, index) => {
    const candidate = right[index]
    if (!candidate || entry.address.nodeId !== candidate.address.nodeId
      || !sameScope(entry.address.scope, candidate.address.scope)) {
      return false
    }
    const stateKeys = Object.keys(entry.states).sort()
    const candidateStateKeys = Object.keys(candidate.states).sort()
    if (stateKeys.length !== candidateStateKeys.length
      || stateKeys.some((key, stateIndex) => key !== candidateStateKeys[stateIndex]
        || entry.states[key as keyof typeof entry.states] !== candidate.states[key as keyof typeof candidate.states])) {
      return false
    }
    return entry.properties.length === candidate.properties.length
      && entry.properties.every((property, propertyIndex) => {
        const candidateProperty = candidate.properties[propertyIndex]
        return candidateProperty !== undefined
          && property.path.length === candidateProperty.path.length
          && property.path.every((segment, pathIndex) => segment === candidateProperty.path[pathIndex])
          && deepJsonEqual(property.value, candidateProperty.value)
      })
  })
}

function validateInstanceState(
  instance: SurfaceInstanceV1,
  surface: PrototypeSurfaceContractV1,
): readonly PrototypeDiagnostic[] {
  if (!hasValidParameters(surface, instance.parameters)) {
    return [invalid('Instance parameters do not match the Surface contract.', ['parameters'])]
  }
  const prepared = preparePrototypeRuntime(surface, instance.values, instance.runtime)
  if (!prepared.success)
    return prepared.diagnostics
  const projection = projectPrototypeInstance(
    surface,
    instance.values,
    instance.parameters,
    instance.runtime,
  )
  if (!projection.success)
    return projection.diagnostics
  return sameProjection(instance.projection, projection.data)
    ? []
    : [invalid('Instance projection does not match current values, parameters, runtime, and Surface rules.', ['projection'])]
}

function validateOpener(
  session: PrototypeSessionV1,
  context: PrototypeProjectContextV1,
  instance: SurfaceInstanceV1,
  overlayIndex: number,
): PrototypeDiagnostic | undefined {
  const parentId = instance.parentInstanceId
  const openerAddress = instance.openerAddress
  const openerInteractionId = instance.openerInteractionId
  const parent = parentId === undefined ? undefined : session.instancesById[parentId]
  if (!parent || !openerAddress || !openerInteractionId)
    return invalid('Overlay opener identity must reference a live parent.', ['parentInstanceId'])
  const parentOverlayIndex = session.overlayStack.indexOf(parent.instanceId)
  if (parentOverlayIndex >= overlayIndex)
    return invalid('Overlay parent must precede the child in the live stack.', ['parentInstanceId'])
  const parentSurface = context.surfacesById[parent.surfaceId]
  const opener = parentSurface?.interactions.find((interaction): interaction is PrimaryUiActionBinding => (
    interaction.kind === 'primaryUiAction' && interaction.id === openerInteractionId
  ))
  if (!parentSurface || !opener || opener.nodeId !== openerAddress.nodeId
    || opener.action.kind !== 'open' || opener.action.targetSurfaceId !== instance.surfaceId
    || !hasRuntimeAddress(parent.runtime, openerAddress)) {
    return invalid('Overlay opener identity does not match a live open binding.', ['openerInteractionId'])
  }
  return undefined
}

export function readPrototypeSession(
  input: unknown,
  contextInput: PrototypeProjectContextV1,
): PrototypeReadResult<PrototypeSessionV1> {
  const sessionRead = readPrototypeSessionShape(input)
  if (!sessionRead.success)
    return sessionRead
  const contextRead = readPrototypeProjectContext(contextInput)
  if (!contextRead.success)
    return contextRead
  const session = sessionRead.data
  const context = contextRead.data
  const diagnostics: PrototypeDiagnostic[] = []
  if (session.projectId !== context.projectId) {
    diagnostics.push(invalid('Session project identity must match the Prototype project context.', ['projectId']))
  }
  session.pageHistory.forEach((instanceId) => {
    const instance = session.instancesById[instanceId]!
    const surface = context.surfacesById[instance.surfaceId]
    if (!surface || surface.kind !== 'page') {
      diagnostics.push(invalid('Page history instances must reference Page Surfaces.', ['instancesById', instanceId, 'surfaceId']))
      return
    }
    validateInstanceState(instance, surface).forEach(diagnostic => diagnostics.push(
      prefixInstanceDiagnostic(instanceId, diagnostic),
    ))
  })
  session.overlayStack.forEach((instanceId, overlayIndex) => {
    const instance = session.instancesById[instanceId]!
    const surface = context.surfacesById[instance.surfaceId]
    if (!surface || surface.kind === 'page') {
      diagnostics.push(invalid('Overlay stack instances must reference Dialog or Drawer Surfaces.', ['instancesById', instanceId, 'surfaceId']))
      return
    }
    const openerDiagnostic = validateOpener(session, context, instance, overlayIndex)
    if (openerDiagnostic)
      diagnostics.push(prefixInstanceDiagnostic(instanceId, openerDiagnostic))
    validateInstanceState(instance, surface).forEach(diagnostic => diagnostics.push(
      prefixInstanceDiagnostic(instanceId, diagnostic),
    ))
  })
  return diagnostics.length > 0
    ? { success: false, diagnostics }
    : sessionRead
}
