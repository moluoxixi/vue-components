import type { ConfigFormValueScopePatchInstance } from '@moluoxixi/config-form-core'
import type {
  ModelJsonObject,
  ModelJsonValue,
  NamedResultBinding,
  PrimaryUiActionBinding,
  PrototypeDiagnostic,
  PrototypeInstanceRuntimeSnapshotV1,
  PrototypeNodeAddressV1,
  PrototypeProjectContextV1,
  PrototypeSessionCommand,
  PrototypeSessionEffect,
  PrototypeSessionV1,
  PrototypeSurfaceContractV1,
  PrototypeTransition,
  SurfaceInstanceV1,
  SurfaceParameterBinding,
} from '../types'
import {
  readPrototypeProjectContext,
  readPrototypeSessionCommand,
} from '../schemas'
import {
  readRuntimeSnapshot,
} from '../schemas/common'
import { cloneJson, deepFreeze, hasExactKeys, isRecord, isSafeIdentifier, sameScope, scopeStartsWith } from '../utils'
import { evaluatePrototypeExpression, projectPrototypeInstance } from './projection'
import {
  hasRuntimeAddress,
  preparePrototypeRuntime,
  resolvePrototypeFieldAddress,
} from './runtime-snapshot'
import { readPrototypeSession } from './session-reader'
import { settlePrototypeValues } from './values'

interface PrototypeInitializationInput {
  projectId: string
  homeInstance: {
    instanceId: string
    runtime: PrototypeInstanceRuntimeSnapshotV1
  }
}

function failed(
  session: PrototypeSessionV1,
  diagnostic: PrototypeDiagnostic | readonly PrototypeDiagnostic[],
): PrototypeTransition {
  return {
    session,
    diagnostics: Array.isArray(diagnostic) ? diagnostic : [diagnostic],
    effects: [],
  }
}

function actionInvalid(instanceId: string, action: string, reason: string): PrototypeDiagnostic {
  return {
    code: 'prototype_action_invalid',
    message: reason,
    context: { instanceId, action, reason },
  }
}

function instanceNotFound(instanceId: string, action: string): PrototypeDiagnostic {
  return {
    code: 'prototype_instance_not_found',
    message: `Prototype instance does not exist: ${instanceId}.`,
    context: { instanceId, action },
  }
}

function freezeTransition(
  session: PrototypeSessionV1,
  effects: readonly PrototypeSessionEffect[],
): PrototypeTransition {
  return deepFreeze({ session, diagnostics: [], effects }) as PrototypeTransition
}

function defaultParameters(surface: PrototypeSurfaceContractV1): ModelJsonObject | undefined {
  const parameters: ModelJsonObject = {}
  for (const definition of surface.parameters) {
    if (definition.defaultValue !== undefined)
      parameters[definition.name] = cloneJson(definition.defaultValue)
    else if (definition.required)
      return undefined
  }
  return parameters
}

function createInstance(
  surface: PrototypeSurfaceContractV1,
  instanceId: string,
  runtime: PrototypeInstanceRuntimeSnapshotV1,
  parameters: ModelJsonObject,
  opener?: {
    parentInstanceId: string
    openerAddress: PrototypeNodeAddressV1
    openerInteractionId: string
  },
): { success: true, instance: SurfaceInstanceV1 } | { success: false, diagnostics: readonly PrototypeDiagnostic[] } {
  const values = cloneJson(surface.initialValues)
  const prepared = preparePrototypeRuntime(surface, values, runtime)
  if (!prepared.success)
    return prepared
  const projection = projectPrototypeInstance(surface, values, parameters, runtime)
  if (!projection.success)
    return projection
  return {
    success: true,
    instance: deepFreeze({
      instanceId,
      surfaceId: surface.id,
      ...(opener ?? {}),
      parameters: cloneJson(parameters),
      values,
      runtime,
      projection: projection.data,
    }) as SurfaceInstanceV1,
  }
}

function currentPageId(session: PrototypeSessionV1): string | undefined {
  return session.pageHistory.at(-1)
}

function contextResult(input: PrototypeProjectContextV1 | unknown) {
  return readPrototypeProjectContext(input)
}

export function initializePrototypeSession(
  input: PrototypeInitializationInput | unknown,
  contextInput: PrototypeProjectContextV1 | unknown,
): PrototypeTransition {
  const contextRead = contextResult(contextInput)
  const emptySession = deepFreeze({
    version: 1 as const,
    projectId: isRecord(input) && typeof input.projectId === 'string' ? input.projectId : '',
    pageHistory: [],
    overlayStack: [],
    instancesById: {},
  }) as PrototypeSessionV1
  if (!contextRead.success)
    return failed(emptySession, contextRead.diagnostics)
  if (!isRecord(input) || !hasExactKeys(input, ['projectId', 'homeInstance'])
    || input.projectId !== contextRead.data.projectId || !isRecord(input.homeInstance)
    || !hasExactKeys(input.homeInstance, ['instanceId', 'runtime']) || !isSafeIdentifier(input.homeInstance.instanceId)) {
    return failed(emptySession, actionInvalid('', 'initialize', 'Prototype initialization input is invalid.'))
  }
  const runtimeDiagnostics: PrototypeDiagnostic[] = []
  const runtime = readRuntimeSnapshot(input.homeInstance.runtime, ['homeInstance', 'runtime'], runtimeDiagnostics)
  if (!runtime)
    return failed(emptySession, runtimeDiagnostics)
  const home = contextRead.data.surfacesById[contextRead.data.homeSurfaceId]
  if (!home || home.kind !== 'page')
    return failed(emptySession, actionInvalid('', 'initialize', 'Prototype home Surface must be a Page.'))
  const parameters = defaultParameters(home)
  if (!parameters) {
    return failed(emptySession, {
      code: 'surface_parameter_invalid',
      message: 'Home Surface has a required parameter without a default value.',
      context: { targetSurfaceId: home.id, parameterName: '' },
    })
  }
  const created = createInstance(home, input.homeInstance.instanceId, runtime, parameters)
  if (!created.success)
    return failed(emptySession, created.diagnostics)
  const session = deepFreeze({
    version: 1 as const,
    projectId: input.projectId,
    pageHistory: [created.instance.instanceId],
    overlayStack: [],
    instancesById: { [created.instance.instanceId]: created.instance },
  }) as PrototypeSessionV1
  return freezeTransition(session, [
    { type: 'instance.mount', instanceId: created.instance.instanceId, surfaceId: home.id },
    { type: 'instance.projection.replace', instanceId: created.instance.instanceId, projection: created.instance.projection },
  ])
}

function cloneSession(session: PrototypeSessionV1): {
  pageHistory: string[]
  overlayStack: string[]
  instancesById: Record<string, SurfaceInstanceV1>
} {
  return {
    pageHistory: [...session.pageHistory],
    overlayStack: [...session.overlayStack],
    instancesById: { ...session.instancesById },
  }
}

function publishSession(
  source: PrototypeSessionV1,
  draft: ReturnType<typeof cloneSession>,
): PrototypeSessionV1 {
  return deepFreeze({
    version: 1 as const,
    projectId: source.projectId,
    pageHistory: draft.pageHistory,
    overlayStack: draft.overlayStack,
    instancesById: draft.instancesById,
  }) as PrototypeSessionV1
}

function closeTopOverlay(
  session: PrototypeSessionV1,
  focus = true,
): PrototypeTransition {
  const instanceId = session.overlayStack.at(-1)
  if (!instanceId)
    return failed(session, actionInvalid(currentPageId(session) ?? '', 'closeCurrent', 'No overlay is open.'))
  const instance = session.instancesById[instanceId]!
  const draft = cloneSession(session)
  draft.overlayStack.pop()
  delete draft.instancesById[instanceId]
  const effects: PrototypeSessionEffect[] = [{ type: 'instance.dispose', instanceId }]
  if (focus && instance.parentInstanceId && instance.openerAddress && draft.instancesById[instance.parentInstanceId]) {
    effects.push({
      type: 'focus.restore',
      instanceId: instance.parentInstanceId,
      address: instance.openerAddress,
    })
  }
  return freezeTransition(publishSession(session, draft), effects)
}

function closeAllOverlays(session: PrototypeSessionV1): PrototypeTransition {
  if (session.overlayStack.length === 0)
    return freezeTransition(session, [])
  const draft = cloneSession(session)
  const closed = [...draft.overlayStack].reverse()
  const bottom = draft.instancesById[draft.overlayStack[0]!]
  draft.overlayStack = []
  closed.forEach(instanceId => delete draft.instancesById[instanceId])
  const effects: PrototypeSessionEffect[] = closed.map(instanceId => ({ type: 'instance.dispose', instanceId }))
  if (bottom?.parentInstanceId && bottom.openerAddress && draft.instancesById[bottom.parentInstanceId]) {
    effects.push({ type: 'focus.restore', instanceId: bottom.parentInstanceId, address: bottom.openerAddress })
  }
  return freezeTransition(publishSession(session, draft), effects)
}

function back(session: PrototypeSessionV1): PrototypeTransition {
  if (session.overlayStack.length > 0)
    return closeTopOverlay(session)
  if (session.pageHistory.length < 2)
    return failed(session, actionInvalid(currentPageId(session) ?? '', 'back', 'Page history has no previous entry.'))
  const draft = cloneSession(session)
  const instanceId = draft.pageHistory.pop()!
  delete draft.instancesById[instanceId]
  return freezeTransition(publishSession(session, draft), [{ type: 'instance.dispose', instanceId }])
}

function bindParameters(
  sourceSurface: PrototypeSurfaceContractV1,
  sourceInstance: SurfaceInstanceV1,
  sourceAddress: PrototypeNodeAddressV1,
  target: PrototypeSurfaceContractV1,
  bindings: readonly SurfaceParameterBinding[],
  item?: Readonly<ModelJsonObject>,
): { success: true, parameters: ModelJsonObject } | { success: false, diagnostics: readonly PrototypeDiagnostic[] } {
  const parameters: ModelJsonObject = {}
  target.parameters.forEach((definition) => {
    if (definition.defaultValue !== undefined)
      parameters[definition.name] = cloneJson(definition.defaultValue)
  })
  for (const binding of bindings) {
    const evaluated = evaluatePrototypeExpression({
      surface: sourceSurface,
      values: sourceInstance.values,
      parameters: sourceInstance.parameters,
      runtime: sourceInstance.runtime,
      address: sourceAddress,
      expression: binding.value,
      ...(item ? { item } : {}),
    })
    if (!evaluated.success)
      return { success: false, diagnostics: [evaluated.diagnostic] }
    parameters[binding.name] = cloneJson(evaluated.value)
  }
  const missing = target.parameters.find(definition => definition.required && !Object.hasOwn(parameters, definition.name))
  if (missing) {
    return {
      success: false,
      diagnostics: [{
        code: 'surface_parameter_invalid',
        message: `Required Surface parameter is missing: ${missing.name}.`,
        context: { targetSurfaceId: target.id, parameterName: missing.name, reason: 'missing' },
      }],
    }
  }
  return { success: true, parameters }
}

function navigateOrOpen(
  session: PrototypeSessionV1,
  context: PrototypeProjectContextV1,
  sourceSurface: PrototypeSurfaceContractV1,
  sourceInstance: SurfaceInstanceV1,
  sourceAddress: PrototypeNodeAddressV1,
  binding: PrimaryUiActionBinding & { action: Extract<PrimaryUiActionBinding['action'], { kind: 'navigate' | 'open' }> },
  command: Extract<PrototypeSessionCommand, { type: 'interaction.activate' }>,
): PrototypeTransition {
  const target = context.surfacesById[binding.action.targetSurfaceId]!
  const next = command.nextInstance!
  if (session.instancesById[next.instanceId])
    return failed(session, actionInvalid(sourceInstance.instanceId, binding.action.kind, 'Next instance ID is already live.'))
  const parameterResult = bindParameters(
    sourceSurface,
    sourceInstance,
    sourceAddress,
    target,
    binding.action.parameters,
    command.item,
  )
  if (!parameterResult.success)
    return failed(session, parameterResult.diagnostics)
  const opener = binding.action.kind === 'open'
    ? {
        parentInstanceId: sourceInstance.instanceId,
        openerAddress: sourceAddress,
        openerInteractionId: binding.id,
      }
    : undefined
  const created = createInstance(target, next.instanceId, next.runtime, parameterResult.parameters, opener)
  if (!created.success)
    return failed(session, created.diagnostics)
  const draft = cloneSession(session)
  const effects: PrototypeSessionEffect[] = []
  if (binding.action.kind === 'open') {
    draft.overlayStack.push(next.instanceId)
  }
  else {
    ;[...draft.overlayStack].reverse().forEach((instanceId) => {
      delete draft.instancesById[instanceId]
      effects.push({ type: 'instance.dispose', instanceId })
    })
    draft.overlayStack = []
    draft.pageHistory.push(next.instanceId)
  }
  draft.instancesById[next.instanceId] = created.instance
  effects.push(
    { type: 'instance.mount', instanceId: next.instanceId, surfaceId: target.id },
    { type: 'instance.projection.replace', instanceId: next.instanceId, projection: created.instance.projection },
  )
  return freezeTransition(publishSession(session, draft), effects)
}

function evaluateResultAssignments(
  parentSurface: PrototypeSurfaceContractV1,
  parent: SurfaceInstanceV1,
  openerAddress: PrototypeNodeAddressV1,
  resultValue: ModelJsonValue,
  binding: NamedResultBinding,
): { success: true, values: ModelJsonObject, changedAddresses: readonly PrototypeNodeAddressV1[] }
  | { success: false, diagnostics: readonly PrototypeDiagnostic[] } {
  const prepared = preparePrototypeRuntime(parentSurface, parent.values, parent.runtime)
  if (!prepared.success)
    return prepared
  const writes: ConfigFormValueScopePatchInstance[] = []
  const changedAddresses: PrototypeNodeAddressV1[] = []
  for (const assignment of binding.assignments) {
    const address = resolvePrototypeFieldAddress(parentSurface, parent.runtime, openerAddress, assignment.targetFieldId)
    if (!address) {
      return {
        success: false,
        diagnostics: [{
          code: 'surface_result_invalid',
          message: 'Result assignment target cannot be resolved from the opener scope.',
          context: { surfaceId: parentSurface.id, resultName: binding.resultName, reason: 'target_scope' },
        }],
      }
    }
    const evaluated = evaluatePrototypeExpression({
      surface: parentSurface,
      values: parent.values,
      parameters: parent.parameters,
      runtime: parent.runtime,
      address: openerAddress,
      expression: assignment.value,
      result: resultValue,
      prepared: prepared.data,
    })
    if (!evaluated.success)
      return { success: false, diagnostics: [evaluated.diagnostic] }
    writes.push({ nodeId: address.nodeId, scope: address.scope, value: cloneJson(evaluated.value) })
    changedAddresses.push(address)
  }
  try {
    prepared.data.store.applyPatch({ instances: writes })
  }
  catch (error) {
    return {
      success: false,
      diagnostics: [{
        code: 'surface_result_invalid',
        message: error instanceof Error ? error.message : 'Result assignment transaction failed.',
        context: { surfaceId: parentSurface.id, resultName: binding.resultName, reason: 'write' },
      }],
    }
  }
  return { success: true, values: prepared.data.store.getValues(), changedAddresses }
}

function closeWithResult(
  session: PrototypeSessionV1,
  context: PrototypeProjectContextV1,
  sourceSurface: PrototypeSurfaceContractV1,
  sourceInstance: SurfaceInstanceV1,
  sourceAddress: PrototypeNodeAddressV1,
  binding: PrimaryUiActionBinding & { action: Extract<PrimaryUiActionBinding['action'], { kind: 'closeCurrent' }> },
  command: Extract<PrototypeSessionCommand, { type: 'interaction.activate' }>,
): PrototypeTransition {
  if (session.overlayStack.at(-1) !== sourceInstance.instanceId)
    return failed(session, actionInvalid(sourceInstance.instanceId, 'closeCurrent', 'Only the top overlay can close itself.'))
  if (!binding.action.result)
    return closeTopOverlay(session)
  const result = evaluatePrototypeExpression({
    surface: sourceSurface,
    values: sourceInstance.values,
    parameters: sourceInstance.parameters,
    runtime: sourceInstance.runtime,
    address: sourceAddress,
    expression: binding.action.result.value,
    ...(command.item ? { item: command.item } : {}),
  })
  if (!result.success)
    return failed(session, result.diagnostic)
  if (!sourceSurface.outputs.some(output => output.name === binding.action.result!.name)) {
    return failed(session, {
      code: 'surface_result_invalid',
      message: 'Surface result is not declared.',
      context: { surfaceId: sourceSurface.id, resultName: binding.action.result.name, reason: 'undeclared' },
    })
  }
  const parentId = sourceInstance.parentInstanceId
  const openerAddress = sourceInstance.openerAddress
  const openerInteractionId = sourceInstance.openerInteractionId
  const parent = parentId ? session.instancesById[parentId] : undefined
  if (!parent || !openerAddress || !openerInteractionId) {
    return failed(session, {
      code: 'surface_result_invalid',
      message: 'Surface result opener is no longer live.',
      context: { surfaceId: sourceSurface.id, resultName: binding.action.result.name, reason: 'opener_missing' },
    })
  }
  const parentSurface = context.surfacesById[parent.surfaceId]!
  const opener = parentSurface.interactions.find((interaction): interaction is PrimaryUiActionBinding => (
    interaction.kind === 'primaryUiAction' && interaction.id === openerInteractionId
  ))
  if (!opener || opener.nodeId !== openerAddress.nodeId || opener.action.kind !== 'open'
    || opener.action.targetSurfaceId !== sourceSurface.id || !hasRuntimeAddress(parent.runtime, openerAddress)) {
    return failed(session, {
      code: 'surface_result_invalid',
      message: 'Surface result opener identity does not match the live open binding.',
      context: { surfaceId: sourceSurface.id, resultName: binding.action.result.name, reason: 'opener_mismatch' },
    })
  }
  const resultBinding = opener.action.onResults?.find(candidate => candidate.resultName === binding.action.result!.name)
  let nextParent = parent
  const prefixEffects: PrototypeSessionEffect[] = []
  if (resultBinding) {
    const assignments = evaluateResultAssignments(parentSurface, parent, openerAddress, result.value, resultBinding)
    if (!assignments.success)
      return failed(session, assignments.diagnostics)
    const settled = settlePrototypeValues(
      parentSurface,
      parent.parameters,
      assignments.values,
      parent.runtime,
      openerAddress.scope,
      assignments.changedAddresses,
    )
    if (!settled.success)
      return failed(session, settled.diagnostics)
    const projection = projectPrototypeInstance(parentSurface, settled.data.values, parent.parameters, parent.runtime)
    if (!projection.success)
      return failed(session, projection.diagnostics)
    nextParent = deepFreeze({
      ...parent,
      values: settled.data.values,
      projection: projection.data,
    }) as SurfaceInstanceV1
    prefixEffects.push(
      {
        type: 'instance.values.replace',
        instanceId: parent.instanceId,
        values: settled.data.values,
        changedAddresses: settled.data.changedAddresses,
      },
      { type: 'instance.projection.replace', instanceId: parent.instanceId, projection: projection.data },
    )
  }
  const draft = cloneSession(session)
  draft.instancesById[parent.instanceId] = nextParent
  draft.overlayStack.pop()
  delete draft.instancesById[sourceInstance.instanceId]
  return freezeTransition(publishSession(session, draft), [
    ...prefixEffects,
    { type: 'instance.dispose', instanceId: sourceInstance.instanceId },
    { type: 'focus.restore', instanceId: parent.instanceId, address: openerAddress },
  ])
}

function valuesChanged(
  session: PrototypeSessionV1,
  context: PrototypeProjectContextV1,
  command: Extract<PrototypeSessionCommand, { type: 'instance.valuesChanged' }>,
): PrototypeTransition {
  const instance = session.instancesById[command.instanceId]
  if (!instance)
    return failed(session, instanceNotFound(command.instanceId, command.type))
  const surface = context.surfacesById[instance.surfaceId]!
  const newRuntime = preparePrototypeRuntime(surface, command.values, command.runtime)
  if (!newRuntime.success)
    return failed(session, newRuntime.diagnostics)
  const addressesValid = command.changedAddresses.every(address => (
    hasRuntimeAddress(instance.runtime, address, true)
    && hasRuntimeAddress(command.runtime, address, true)
    && scopeStartsWith(command.originScope, address.scope)
  )) && command.changedAddresses.some(address => sameScope(address.scope, command.originScope))
  if (!addressesValid) {
    return failed(session, actionInvalid(instance.instanceId, command.type, 'Changed addresses are stale or do not share the declared origin scope.'))
  }
  const settled = settlePrototypeValues(
    surface,
    instance.parameters,
    command.values,
    command.runtime,
    command.originScope,
    command.changedAddresses,
  )
  if (!settled.success)
    return failed(session, settled.diagnostics)
  const projection = projectPrototypeInstance(surface, settled.data.values, instance.parameters, command.runtime)
  if (!projection.success)
    return failed(session, projection.diagnostics)
  const draft = cloneSession(session)
  draft.instancesById[instance.instanceId] = deepFreeze({
    ...instance,
    values: settled.data.values,
    runtime: command.runtime,
    projection: projection.data,
  }) as SurfaceInstanceV1
  return freezeTransition(publishSession(session, draft), [
    {
      type: 'instance.values.replace',
      instanceId: instance.instanceId,
      values: settled.data.values,
      changedAddresses: settled.data.changedAddresses,
    },
    { type: 'instance.projection.replace', instanceId: instance.instanceId, projection: projection.data },
  ])
}

function dismiss(
  session: PrototypeSessionV1,
  context: PrototypeProjectContextV1,
  command: Extract<PrototypeSessionCommand, { type: 'overlay.dismiss' }>,
): PrototypeTransition {
  if (session.overlayStack.at(-1) !== command.instanceId)
    return failed(session, actionInvalid(command.instanceId, command.type, 'Only the top overlay can be dismissed.'))
  const instance = session.instancesById[command.instanceId]
  if (!instance)
    return failed(session, instanceNotFound(command.instanceId, command.type))
  const surface = context.surfacesById[instance.surfaceId]
  if (!surface || surface.kind === 'page' || !surface.presentation.close[command.reason])
    return failed(session, actionInvalid(command.instanceId, command.type, `Overlay dismissal by ${command.reason} is disabled.`))
  return closeTopOverlay(session)
}

function activate(
  session: PrototypeSessionV1,
  context: PrototypeProjectContextV1,
  rawCommand: unknown,
  command: Extract<PrototypeSessionCommand, { type: 'interaction.activate' }>,
): PrototypeTransition {
  const sourceInstance = session.instancesById[command.sourceInstanceId]
  if (!sourceInstance)
    return failed(session, instanceNotFound(command.sourceInstanceId, command.type))
  const sourceSurface = context.surfacesById[sourceInstance.surfaceId]
  const binding = sourceSurface?.interactions.find((interaction): interaction is PrimaryUiActionBinding => (
    interaction.kind === 'primaryUiAction' && interaction.id === command.interactionId
  ))
  if (!sourceSurface || !binding)
    return failed(session, actionInvalid(sourceInstance.instanceId, command.type, 'Interaction does not exist on the source Surface.'))
  const strictCommand = readPrototypeSessionCommand(rawCommand, {
    trigger: binding.trigger,
    actionKind: binding.action.kind,
  })
  if (!strictCommand.success)
    return failed(session, strictCommand.diagnostics)
  const activation = strictCommand.data as Extract<PrototypeSessionCommand, { type: 'interaction.activate' }>
  if (binding.nodeId !== activation.sourceAddress.nodeId || !hasRuntimeAddress(sourceInstance.runtime, activation.sourceAddress))
    return failed(session, actionInvalid(sourceInstance.instanceId, command.type, 'Activation address does not match the live interaction binding.'))
  if (binding.action.kind === 'navigate' || binding.action.kind === 'open') {
    return navigateOrOpen(
      session,
      context,
      sourceSurface,
      sourceInstance,
      activation.sourceAddress,
      binding as PrimaryUiActionBinding & { action: Extract<PrimaryUiActionBinding['action'], { kind: 'navigate' | 'open' }> },
      activation,
    )
  }
  if (binding.action.kind === 'back')
    return back(session)
  if (binding.action.kind === 'closeAll')
    return closeAllOverlays(session)
  return closeWithResult(
    session,
    context,
    sourceSurface,
    sourceInstance,
    activation.sourceAddress,
    binding as PrimaryUiActionBinding & { action: Extract<PrimaryUiActionBinding['action'], { kind: 'closeCurrent' }> },
    activation,
  )
}

export function reducePrototypeSession(
  session: PrototypeSessionV1,
  commandInput: PrototypeSessionCommand | unknown,
  contextInput: PrototypeProjectContextV1 | unknown,
): PrototypeTransition {
  const contextRead = contextResult(contextInput)
  if (!contextRead.success)
    return failed(session, contextRead.diagnostics)
  const sessionRead = readPrototypeSession(session, contextRead.data)
  if (!sessionRead.success)
    return failed(session, sessionRead.diagnostics)
  const commandRead = readPrototypeSessionCommand(commandInput)
  if (!commandRead.success)
    return failed(session, commandRead.diagnostics)
  const command = commandRead.data
  switch (command.type) {
    case 'instance.valuesChanged': return valuesChanged(session, contextRead.data, command)
    case 'interaction.activate': return activate(session, contextRead.data, commandInput, command)
    case 'history.back': return back(session)
    case 'overlay.dismiss': return dismiss(session, contextRead.data, command)
    case 'overlay.closeAll': return closeAllOverlays(session)
  }
}
