import type {
  ModelJsonObject,
  ModelJsonValue,
  PrototypeExpressionInput,
  PrototypeInstanceProjectionV1,
  PrototypeInstanceRuntimeSnapshotV1,
  PrototypeNodeAddressV1,
  PrototypeNodeProjectionV1,
  PrototypeReadResult,
  PrototypeSurfaceContractV1,
} from '../types'
import type { preparePrototypeRuntime } from './runtime-snapshot'
import { cloneJson, deepFreeze } from '../utils'
import { evaluateSafeExpression } from './expression'
import {
  preparePrototypeRuntime as prepareRuntime,
  resolvePrototypeScopeValues,
  runtimeAddressKey,
} from './runtime-snapshot'

type PreparedRuntime = Extract<ReturnType<typeof preparePrototypeRuntime>, { success: true }>['data']

type PrototypeExpressionEvaluationInput = PrototypeExpressionInput & { prepared?: PreparedRuntime }

export function evaluatePrototypeExpression(input: PrototypeExpressionEvaluationInput) {
  const preparedResult = input.prepared
    ? { success: true as const, data: input.prepared, diagnostics: [] as const }
    : prepareRuntime(input.surface, input.values, input.runtime)
  if (!preparedResult.success)
    return { success: false as const, diagnostic: preparedResult.diagnostics[0]! }
  const scopeValues = resolvePrototypeScopeValues(
    input.surface,
    input.values,
    preparedResult.data,
    input.address,
  )
  if (!scopeValues.success)
    return { success: false as const, diagnostic: scopeValues.diagnostics[0]! }
  return evaluateSafeExpression(input.expression, {
    values: input.values,
    parameters: input.parameters,
    scopeValues: scopeValues.data,
    ...(input.result === undefined ? {} : { result: input.result }),
    ...(input.item === undefined ? {} : { item: input.item }),
  })
}

export function projectPrototypeInstance(
  surface: PrototypeSurfaceContractV1,
  values: ModelJsonObject,
  parameters: Readonly<ModelJsonObject>,
  runtime: PrototypeInstanceRuntimeSnapshotV1,
): PrototypeReadResult<PrototypeInstanceProjectionV1> {
  const prepared = prepareRuntime(surface, values, runtime)
  if (!prepared.success)
    return prepared
  const projections = new Map<string, {
    address: PrototypeNodeAddressV1
    states: Record<string, boolean>
    properties: { path: readonly string[], value: ModelJsonValue }[]
  }>()
  const rules = surface.interactions.filter(interaction => interaction.kind === 'stateProjection')
  for (const rule of rules) {
    const addresses = runtime.nodeAddresses.filter(address => address.nodeId === rule.target.nodeId)
    for (const address of addresses) {
      const evaluated = evaluatePrototypeExpression({
        surface,
        values,
        parameters,
        runtime,
        address,
        expression: rule.value,
        prepared: prepared.data,
      })
      if (!evaluated.success) {
        return {
          success: false,
          diagnostics: [{
            ...evaluated.diagnostic,
            context: { ...(evaluated.diagnostic.context ?? {}), surfaceId: surface.id, ruleId: rule.id },
          }],
        }
      }
      const key = runtimeAddressKey(address)
      const projection = projections.get(key) ?? { address, states: {}, properties: [] }
      if (rule.target.kind === 'state') {
        if (typeof evaluated.value !== 'boolean') {
          return {
            success: false,
            diagnostics: [{
              code: 'interaction_expression_invalid',
              message: 'State projection expressions must return a boolean.',
              context: { surfaceId: surface.id, ruleId: rule.id },
            }],
          }
        }
        projection.states[rule.target.key] = evaluated.value
      }
      else {
        projection.properties.push({ path: [...rule.target.path], value: cloneJson(evaluated.value) })
      }
      projections.set(key, projection)
    }
  }
  const ordered: PrototypeNodeProjectionV1[] = runtime.nodeAddresses.flatMap((address) => {
    const projection = projections.get(runtimeAddressKey(address))
    return projection
      ? [{
          address: { nodeId: address.nodeId, scope: address.scope.map(entry => ({ ...entry })) },
          states: { ...projection.states },
          properties: projection.properties.map(property => ({ path: [...property.path], value: cloneJson(property.value) })),
        }]
      : []
  })
  return {
    success: true,
    data: deepFreeze(ordered) as PrototypeInstanceProjectionV1,
    diagnostics: [],
  }
}
