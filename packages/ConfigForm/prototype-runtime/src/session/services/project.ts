import type { ProjectCompilation } from '@moluoxixi/config-form-compiler'
import type {
  ConfigFormJsonValue,
  ConfigFormScopedFieldDefinition,
  ConfigFormValueScopeDefinition,
} from '@moluoxixi/config-form-core'
import type {
  PrototypeDiagnostic,
  PrototypeProjectContextV1,
  PrototypeProjectSessionInitializationInput,
  PrototypeReadResult,
  PrototypeSessionV1,
} from '../types'
import { createConfigFormValueScopeStore } from '@moluoxixi/config-form-core'
import { readPrototypeProjectContext } from '../schemas'
import { isSafeIdentifier } from '../utils'
import { createPrototypeInstanceRuntimeSnapshot } from './runtime-snapshot'
import { readPrototypeSession } from './session-reader'
import { initializePrototypeSession } from './reducer'

type CompiledSurface = ProjectCompilation['ir']['surfacesById'][string]

function failed<T>(message: string, path: readonly (string | number)[] = []): PrototypeReadResult<T> {
  const diagnostic: PrototypeDiagnostic = {
    code: 'prototype_session_invalid',
    message,
    ...(path.length > 0 ? { path } : {}),
  }
  return { success: false, diagnostics: [diagnostic] }
}

function mutableValue(
  value: Exclude<CompiledSurface['scopedFields'][number]['defaultValue'], undefined>,
): ConfigFormJsonValue {
  return structuredClone(value) as ConfigFormJsonValue
}

function valueScopes(surface: CompiledSurface): ConfigFormValueScopeDefinition[] {
  return surface.valueScopes.map(scope => ({ ...scope }))
}

function scopedFields(surface: CompiledSurface): ConfigFormScopedFieldDefinition[] {
  return surface.scopedFields.map(field => ({
    nodeId: field.nodeId,
    field: field.field,
    ...(field.scopeId === undefined ? {} : { scopeId: field.scopeId }),
    ...(field.defaultValue === undefined
      ? {}
      : { defaultValue: mutableValue(field.defaultValue) }),
  }))
}

function initialValues(surface: CompiledSurface) {
  return createConfigFormValueScopeStore({
    scopes: valueScopes(surface),
    fields: scopedFields(surface),
  }).getValues()
}

function ownerScopeIdByNodeId(surface: CompiledSurface): Record<string, string | null> {
  const fieldOwners = new Map(surface.scopedFields.map(field => [field.nodeId, field.scopeId ?? null]))
  return Object.fromEntries(Object.keys(surface.nodesById).map((nodeId) => {
    const fieldOwner = fieldOwners.get(nodeId)
    if (fieldOwner !== undefined)
      return [nodeId, fieldOwner]

    const visited = new Set<string>([nodeId])
    let parentId = surface.nodesById[nodeId]?.placement.parentId ?? null
    while (parentId) {
      if (visited.has(parentId))
        throw new Error(`Compiled Surface node placement contains a cycle at ${parentId}.`)
      visited.add(parentId)
      const parent = surface.nodesById[parentId]
      if (!parent)
        throw new Error(`Compiled Surface node ${nodeId} references missing parent ${parentId}.`)
      if (parent.kind === 'layout' && parent.valueScope)
        return [nodeId, parent.id]
      parentId = parent.placement.parentId
    }
    return [nodeId, null]
  }))
}

/** Project the compiler envelope into the strict, DOM-free Prototype contract. */
export function createPrototypeProjectContext(
  compilation: ProjectCompilation,
): PrototypeReadResult<PrototypeProjectContextV1> {
  try {
    const surfacesById = Object.fromEntries(
      Object.entries(compilation.ir.surfacesById).map(([surfaceId, surface]) => {
        const base = {
          id: surface.id,
          initialValues: initialValues(surface),
          parameters: structuredClone(surface.parameters),
          outputs: structuredClone(surface.outputs),
          interactions: structuredClone(surface.interactions),
          topology: {
            nodeOrder: Object.keys(surface.nodesById),
            ownerScopeIdByNodeId: ownerScopeIdByNodeId(surface),
            valueScopes: valueScopes(surface),
            scopedFields: scopedFields(surface),
          },
        }
        return [surfaceId, surface.kind === 'page'
          ? { ...base, kind: 'page' as const, route: surface.route }
          : {
              ...base,
              kind: surface.kind,
              presentation: structuredClone(surface.presentation),
            }]
      }),
    )
    return readPrototypeProjectContext({
      version: 1,
      projectId: compilation.key.projectId,
      homeSurfaceId: compilation.ir.homeSurfaceId,
      surfacesById,
    })
  }
  catch (error) {
    return failed(
      error instanceof Error
        ? error.message
        : 'ProjectCompilation cannot be projected into a Prototype project context.',
    )
  }
}

/** Build the parent-owned initial snapshot used by an Experience sync. */
export function initializePrototypeProjectSession(
  input: PrototypeProjectSessionInitializationInput,
): PrototypeReadResult<PrototypeSessionV1> {
  if (!isSafeIdentifier(input.homeInstanceId))
    return failed('Prototype home instance ID is invalid.', ['homeInstanceId'])
  const context = createPrototypeProjectContext(input.compilation)
  if (!context.success)
    return context
  const home = context.data.surfacesById[context.data.homeSurfaceId]
  if (!home)
    return failed('Prototype home Surface does not exist.', ['homeSurfaceId'])
  const runtime = createPrototypeInstanceRuntimeSnapshot(
    home,
    structuredClone(home.initialValues),
    input.createRowId,
  )
  if (!runtime.success)
    return runtime
  const initialized = initializePrototypeSession({
    projectId: context.data.projectId,
    homeInstance: {
      instanceId: input.homeInstanceId,
      runtime: runtime.data,
    },
  }, context.data)
  if (initialized.diagnostics.length > 0)
    return { success: false, diagnostics: initialized.diagnostics }
  return readPrototypeSession(initialized.session, context.data)
}
