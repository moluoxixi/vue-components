import type { ConfigFormScopedFieldDefinition, ConfigFormValueScopeDefinition } from '@moluoxixi/config-form-core'
import type {
  ControlledLength,
  DialogPresentationV1,
  DrawerPresentationV1,
  PrototypeDiagnostic,
  PrototypeProjectContextV1,
  PrototypeReadResult,
  PrototypeSurfaceContractV1,
  PrototypeSurfaceTopologyV1,
  ResponsiveLength,
  SurfaceOutputDefinition,
  SurfaceParameterDefinition,
} from '../types'
import { cloneJson, deepFreeze, hasExactKeys, isJsonObject, isJsonValue, isRecord, isSafeIdentifier } from '../utils'
import { invalidContract } from './common'
import { readPrototypeInteractions } from './interaction'

const CONTEXT_VERSION = 1 as const
function isControlledLengthUnit(input: unknown): input is ControlledLength['unit'] {
  return input === 'px' || input === '%' || input === 'rem' || input === 'vw' || input === 'vh'
}

function isDrawerPlacement(input: unknown): input is DrawerPresentationV1['placement'] {
  return input === 'left' || input === 'right' || input === 'top' || input === 'bottom'
}

function readControlledLength(input: unknown): ControlledLength | undefined {
  if (!isRecord(input) || !hasExactKeys(input, ['value', 'unit']) || typeof input.value !== 'number'
    || !Number.isFinite(input.value) || input.value <= 0 || !isControlledLengthUnit(input.unit)) {
    return undefined
  }
  if ((input.unit === '%' || input.unit === 'vw' || input.unit === 'vh') && input.value > 100)
    return undefined
  return { value: input.value, unit: input.unit }
}

function readResponsiveLength(input: unknown): ResponsiveLength | undefined {
  if (!isRecord(input) || !hasExactKeys(input, ['desktop'], ['tablet', 'mobile']))
    return undefined
  const desktop = readControlledLength(input.desktop)
  const tablet = input.tablet === undefined ? undefined : readControlledLength(input.tablet)
  const mobile = input.mobile === undefined ? undefined : readControlledLength(input.mobile)
  if (!desktop || (input.tablet !== undefined && !tablet) || (input.mobile !== undefined && !mobile))
    return undefined
  return { desktop, ...(tablet ? { tablet } : {}), ...(mobile ? { mobile } : {}) }
}

function readPresentation(input: unknown, kind: 'dialog'): DialogPresentationV1 | undefined
function readPresentation(input: unknown, kind: 'drawer'): DrawerPresentationV1 | undefined
function readPresentation(
  input: unknown,
  kind: 'dialog' | 'drawer',
): DialogPresentationV1 | DrawerPresentationV1 | undefined {
  if (!isRecord(input))
    return undefined
  const sizeKey = kind === 'dialog' ? 'width' : 'size'
  const required = kind === 'dialog'
    ? ['kind', 'title', 'width', 'mask', 'close']
    : ['kind', 'title', 'placement', 'size', 'mask', 'close']
  if (!hasExactKeys(input, required) || input.kind !== kind || typeof input.title !== 'string'
    || typeof input.mask !== 'boolean' || !isRecord(input.close)) {
    return undefined
  }
  const close = input.close
  if (!hasExactKeys(close, ['escape', 'mask', 'button'])
    || typeof close.escape !== 'boolean' || typeof close.mask !== 'boolean'
    || typeof close.button !== 'boolean' || (!input.mask && close.mask)) {
    return undefined
  }
  const placement = input.placement
  const size = readResponsiveLength(input[sizeKey])
  if (!size)
    return undefined
  const closePolicy = {
    escape: close.escape,
    mask: close.mask,
    button: close.button,
  }
  if (kind === 'dialog')
    return { kind: 'dialog', title: input.title, width: size, mask: input.mask, close: closePolicy }
  if (!isDrawerPlacement(placement))
    return undefined
  return { kind: 'drawer', title: input.title, placement, size, mask: input.mask, close: closePolicy }
}

function readParameters(input: unknown): SurfaceParameterDefinition[] | undefined {
  if (!Array.isArray(input))
    return undefined
  const names = new Set<string>()
  const result: SurfaceParameterDefinition[] = []
  for (const item of input) {
    if (!isRecord(item) || !hasExactKeys(item, ['name', 'required'], ['defaultValue'])
      || !isSafeIdentifier(item.name) || typeof item.required !== 'boolean' || names.has(item.name)
      || (item.defaultValue !== undefined && !isJsonValue(item.defaultValue))) {
      return undefined
    }
    names.add(item.name)
    result.push({ name: item.name, required: item.required, ...(item.defaultValue === undefined ? {} : { defaultValue: cloneJson(item.defaultValue) }) })
  }
  return result
}

function readOutputs(input: unknown): SurfaceOutputDefinition[] | undefined {
  if (!Array.isArray(input))
    return undefined
  const names = new Set<string>()
  const result: SurfaceOutputDefinition[] = []
  for (const item of input) {
    if (!isRecord(item) || !hasExactKeys(item, ['name']) || !isSafeIdentifier(item.name) || names.has(item.name))
      return undefined
    names.add(item.name)
    result.push({ name: item.name })
  }
  return result
}

function readValueScope(input: unknown): ConfigFormValueScopeDefinition | undefined {
  if (!isRecord(input) || !hasExactKeys(input, ['nodeId', 'field', 'kind'], ['parentId', 'itemKey', 'minItems', 'maxItems'])
    || !isSafeIdentifier(input.nodeId) || !isSafeIdentifier(input.field)
    || (input.kind !== 'object' && input.kind !== 'array')
    || (input.parentId !== undefined && !isSafeIdentifier(input.parentId))) {
    return undefined
  }
  if (input.kind === 'object' && (input.itemKey !== undefined || input.minItems !== undefined || input.maxItems !== undefined))
    return undefined
  if (input.kind === 'array') {
    if (input.itemKey !== undefined && !isSafeIdentifier(input.itemKey))
      return undefined
    if (input.minItems !== undefined && (!Number.isSafeInteger(input.minItems) || (input.minItems as number) < 0))
      return undefined
    if (input.maxItems !== undefined && (!Number.isSafeInteger(input.maxItems) || (input.maxItems as number) < 0))
      return undefined
    if (typeof input.minItems === 'number' && typeof input.maxItems === 'number' && input.minItems > input.maxItems)
      return undefined
  }
  return {
    nodeId: input.nodeId,
    field: input.field,
    kind: input.kind,
    ...(input.parentId === undefined ? {} : { parentId: input.parentId }),
    ...(input.itemKey === undefined ? {} : { itemKey: input.itemKey as string }),
    ...(input.minItems === undefined ? {} : { minItems: input.minItems as number }),
    ...(input.maxItems === undefined ? {} : { maxItems: input.maxItems as number }),
  }
}

function readScopedField(input: unknown): ConfigFormScopedFieldDefinition | undefined {
  if (!isRecord(input) || !hasExactKeys(input, ['nodeId', 'field'], ['scopeId', 'defaultValue'])
    || !isSafeIdentifier(input.nodeId) || !isSafeIdentifier(input.field)
    || (input.scopeId !== undefined && !isSafeIdentifier(input.scopeId))
    || (input.defaultValue !== undefined && !isJsonValue(input.defaultValue))) {
    return undefined
  }
  return {
    nodeId: input.nodeId,
    field: input.field,
    ...(input.scopeId === undefined ? {} : { scopeId: input.scopeId }),
    ...(input.defaultValue === undefined ? {} : { defaultValue: cloneJson(input.defaultValue) }),
  }
}

function readTopology(input: unknown): PrototypeSurfaceTopologyV1 | undefined {
  if (!isRecord(input) || !hasExactKeys(input, ['nodeOrder', 'ownerScopeIdByNodeId', 'valueScopes', 'scopedFields'])
    || !Array.isArray(input.nodeOrder) || !input.nodeOrder.every(isSafeIdentifier)
    || new Set(input.nodeOrder).size !== input.nodeOrder.length || !isRecord(input.ownerScopeIdByNodeId)
    || !Array.isArray(input.valueScopes) || !Array.isArray(input.scopedFields)) {
    return undefined
  }
  const nodeOrder = input.nodeOrder
  const ownerScopeIdByNodeId = input.ownerScopeIdByNodeId
  if (Object.keys(ownerScopeIdByNodeId).length !== nodeOrder.length
    || nodeOrder.some(nodeId => !Object.hasOwn(ownerScopeIdByNodeId, nodeId))) {
    return undefined
  }
  const valueScopes = input.valueScopes.map(readValueScope)
  const scopedFields = input.scopedFields.map(readScopedField)
  if (valueScopes.some(scope => !scope) || scopedFields.some(field => !field))
    return undefined
  const scopes = valueScopes as ConfigFormValueScopeDefinition[]
  const fields = scopedFields as ConfigFormScopedFieldDefinition[]
  const scopeIds = new Set(scopes.map(scope => scope.nodeId))
  const fieldIds = new Set(fields.map(field => field.nodeId))
  if (scopeIds.size !== scopes.length || fieldIds.size !== fields.length
    || new Set([...scopeIds, ...fieldIds]).size !== scopes.length + fields.length) {
    return undefined
  }
  if (scopes.some(scope => !nodeOrder.includes(scope.nodeId) || (scope.parentId !== undefined && !scopeIds.has(scope.parentId)))
    || fields.some(field => !nodeOrder.includes(field.nodeId) || (field.scopeId !== undefined && !scopeIds.has(field.scopeId)))) {
    return undefined
  }
  for (const scope of scopes) {
    const ancestors = new Set<string>()
    let current: ConfigFormValueScopeDefinition | undefined = scope
    while (current) {
      if (ancestors.has(current.nodeId))
        return undefined
      ancestors.add(current.nodeId)
      current = current.parentId === undefined
        ? undefined
        : scopes.find(candidate => candidate.nodeId === current!.parentId)
    }
    if (ancestors.size > 32)
      return undefined
  }
  const owners: Record<string, string | null> = Object.create(null)
  for (const nodeId of nodeOrder) {
    const owner = ownerScopeIdByNodeId[nodeId]
    if (owner !== null && !isSafeIdentifier(owner))
      return undefined
    if (owner !== null && !scopeIds.has(owner))
      return undefined
    owners[nodeId] = owner as string | null
  }
  if (fields.some(field => owners[field.nodeId] !== (field.scopeId ?? null)))
    return undefined
  return { nodeOrder: [...nodeOrder], ownerScopeIdByNodeId: owners, valueScopes: scopes, scopedFields: fields }
}

function validateSurfaceSemantics(
  surface: PrototypeSurfaceContractV1,
  surfaces: Readonly<Record<string, PrototypeSurfaceContractV1>>,
  diagnostics: PrototypeDiagnostic[],
): void {
  const nodeIds = new Set(surface.topology.nodeOrder)
  const fieldIds = new Set(surface.topology.scopedFields.map(field => field.nodeId))
  const interactionIds = new Set<string>()
  const primaryTargets = new Set<string>()
  const projectionTargets = new Set<string>()
  surface.interactions.forEach((interaction, index) => {
    const path = ['surfacesById', surface.id, 'interactions', index]
    if (interactionIds.has(interaction.id))
      diagnostics.push(invalidContract('prototype_session_invalid', 'Interaction IDs must be unique within one Surface.', [...path, 'id']))
    interactionIds.add(interaction.id)
    if (interaction.kind === 'stateProjection') {
      if (!nodeIds.has(interaction.target.nodeId))
        diagnostics.push(invalidContract('prototype_session_invalid', 'Projection target node is unknown.', [...path, 'target', 'nodeId']))
      const targetKey = interaction.target.kind === 'state'
        ? `${interaction.target.nodeId}:state:${interaction.target.key}`
        : `${interaction.target.nodeId}:property:${JSON.stringify(interaction.target.path)}`
      if (projectionTargets.has(targetKey))
        diagnostics.push(invalidContract('interaction_target_conflict', 'Projection target is configured more than once.', [...path, 'target']))
      projectionTargets.add(targetKey)
    }
    if (interaction.kind === 'valueChange') {
      const referenced = [
        ...interaction.dependencies,
        interaction.action.kind === 'copy' ? interaction.action.sourceFieldId : undefined,
        interaction.action.targetFieldId,
      ].filter((value): value is string => value !== undefined)
      if (referenced.some(nodeId => !fieldIds.has(nodeId)))
        diagnostics.push(invalidContract('prototype_session_invalid', 'Value interaction references a non-field node.', path))
    }
    if (interaction.kind === 'primaryUiAction') {
      if (!nodeIds.has(interaction.nodeId))
        diagnostics.push(invalidContract('prototype_session_invalid', 'Primary interaction node is unknown.', [...path, 'nodeId']))
      const key = `${interaction.nodeId}:${interaction.trigger}`
      if (primaryTargets.has(key))
        diagnostics.push(invalidContract('prototype_session_invalid', 'A node trigger may have only one primary action.', path))
      primaryTargets.add(key)
      if (interaction.validate?.scope === 'fields' && interaction.validate.fieldIds?.some(nodeId => !fieldIds.has(nodeId)))
        diagnostics.push(invalidContract('prototype_session_invalid', 'Validation gate references a non-field node.', [...path, 'validate']))
      if (interaction.action.kind === 'navigate' || interaction.action.kind === 'open') {
        const target = surfaces[interaction.action.targetSurfaceId]
        const expected = interaction.action.kind === 'navigate' ? 'page' : 'overlay'
        if (!target || (expected === 'page' ? target.kind !== 'page' : target.kind === 'page'))
          diagnostics.push(invalidContract('invalid_surface_kind', `Action requires a ${expected} target.`, [...path, 'action', 'targetSurfaceId']))
        if (target) {
          const boundNames = new Set(interaction.action.parameters.map(binding => binding.name))
          if (interaction.action.parameters.some(binding => !target.parameters.some(parameter => parameter.name === binding.name))
            || target.parameters.some(parameter => parameter.required && parameter.defaultValue === undefined && !boundNames.has(parameter.name))) {
            diagnostics.push(invalidContract('surface_parameter_invalid', 'Action parameters do not match the target Surface contract.', [...path, 'action', 'parameters']))
          }
          if (interaction.action.kind === 'open' && interaction.action.onResults?.some(binding => (
            !target.outputs.some(output => output.name === binding.resultName)
            || binding.assignments.some(assignment => !fieldIds.has(assignment.targetFieldId))
          ))) {
            diagnostics.push(invalidContract('surface_result_invalid', 'Result binding does not match target outputs or caller fields.', [...path, 'action', 'onResults']))
          }
        }
      }
      const action = interaction.action
      const result = action.kind === 'closeCurrent' ? action.result : undefined
      if (result && !surface.outputs.some(output => output.name === result.name)) {
        diagnostics.push(invalidContract('surface_result_invalid', 'closeCurrent result is not declared by the Surface.', [...path, 'action', 'result']))
      }
    }
  })
}

export function readPrototypeProjectContext(input: unknown): PrototypeReadResult<PrototypeProjectContextV1> {
  if (!isRecord(input) || input.version !== CONTEXT_VERSION) {
    return {
      success: false,
      diagnostics: [{
        code: 'unsupported_contract_version',
        message: `Prototype project context requires version ${CONTEXT_VERSION}.`,
        path: ['version'],
        context: {
          contract: 'PrototypeProjectContext',
          expected: CONTEXT_VERSION,
          received: isRecord(input) && isJsonValue(input.version) ? input.version : null,
        },
      }],
    }
  }
  if (!hasExactKeys(input, ['version', 'projectId', 'homeSurfaceId', 'surfacesById'])
    || !isSafeIdentifier(input.projectId) || !isSafeIdentifier(input.homeSurfaceId) || !isRecord(input.surfacesById)) {
    return { success: false, diagnostics: [invalidContract('prototype_session_invalid', 'Prototype project context has an invalid shape.')] }
  }
  const diagnostics: PrototypeDiagnostic[] = []
  const surfaces: Record<string, PrototypeSurfaceContractV1> = Object.create(null)
  for (const [surfaceId, rawSurface] of Object.entries(input.surfacesById)) {
    if (!isSafeIdentifier(surfaceId) || !isRecord(rawSurface) || typeof rawSurface.kind !== 'string') {
      diagnostics.push(invalidContract('prototype_session_invalid', 'Surface contract has an invalid shape.', ['surfacesById', surfaceId]))
      continue
    }
    const variantKey = rawSurface.kind === 'page' ? 'route' : rawSurface.kind === 'dialog' || rawSurface.kind === 'drawer' ? 'presentation' : undefined
    if (!variantKey || !hasExactKeys(rawSurface, ['id', 'kind', variantKey, 'initialValues', 'parameters', 'outputs', 'interactions', 'topology'])
      || rawSurface.id !== surfaceId || !isJsonObject(rawSurface.initialValues)) {
      diagnostics.push(invalidContract('prototype_session_invalid', 'Surface contract contains unknown, missing, or invalid fields.', ['surfacesById', surfaceId]))
      continue
    }
    const parameters = readParameters(rawSurface.parameters)
    const outputs = readOutputs(rawSurface.outputs)
    const topology = readTopology(rawSurface.topology)
    const interactions = readPrototypeInteractions(rawSurface.interactions, ['surfacesById', surfaceId, 'interactions'], diagnostics)
    if (!parameters || !outputs || !topology || !interactions) {
      diagnostics.push(invalidContract('prototype_session_invalid', 'Surface contract members are invalid.', ['surfacesById', surfaceId]))
      continue
    }
    const base = {
      id: surfaceId,
      initialValues: cloneJson(rawSurface.initialValues),
      parameters,
      outputs,
      interactions,
      topology,
    }
    if (rawSurface.kind === 'page') {
      if (typeof rawSurface.route !== 'string' || !rawSurface.route.startsWith('/') || rawSurface.route.includes('?') || rawSurface.route.includes('#')) {
        diagnostics.push(invalidContract('prototype_session_invalid', 'Page route is invalid.', ['surfacesById', surfaceId, 'route']))
        continue
      }
      surfaces[surfaceId] = { ...base, kind: 'page', route: rawSurface.route }
    }
    else if (rawSurface.kind === 'dialog') {
      const presentation = readPresentation(rawSurface.presentation, 'dialog')
      if (!presentation) {
        diagnostics.push(invalidContract('prototype_session_invalid', 'Overlay presentation is invalid.', ['surfacesById', surfaceId, 'presentation']))
        continue
      }
      surfaces[surfaceId] = { ...base, kind: 'dialog', presentation }
    }
    else {
      const presentation = readPresentation(rawSurface.presentation, 'drawer')
      if (!presentation) {
        diagnostics.push(invalidContract('prototype_session_invalid', 'Overlay presentation is invalid.', ['surfacesById', surfaceId, 'presentation']))
        continue
      }
      surfaces[surfaceId] = { ...base, kind: 'drawer', presentation }
    }
  }
  if (!surfaces[input.homeSurfaceId] || surfaces[input.homeSurfaceId].kind !== 'page')
    diagnostics.push(invalidContract('invalid_surface_kind', 'Prototype home Surface must be a Page.', ['homeSurfaceId']))
  Object.values(surfaces).forEach(surface => validateSurfaceSemantics(surface, surfaces, diagnostics))
  if (diagnostics.length > 0)
    return { success: false, diagnostics }
  return {
    success: true,
    data: deepFreeze({
      version: CONTEXT_VERSION,
      projectId: input.projectId,
      homeSurfaceId: input.homeSurfaceId,
      surfacesById: surfaces,
    }) as PrototypeProjectContextV1,
    diagnostics: [],
  }
}
