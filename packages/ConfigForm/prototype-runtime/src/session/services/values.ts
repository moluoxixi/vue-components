import type {
  ConfigFormScopePath,
  ConfigFormValueScopePatchInstance,
} from '@moluoxixi/config-form-core'
import type {
  ModelJsonObject,
  PrototypeDiagnostic,
  PrototypeInstanceRuntimeSnapshotV1,
  PrototypeNodeAddressV1,
  PrototypeReadResult,
  PrototypeSurfaceContractV1,
  PrototypeValueSettlement,
  ValueChangeRule,
} from '../types'
import { ConfigFormValueScopeError } from '@moluoxixi/config-form-core'
import { cloneJson, deepJsonEqual, scopeStartsWith } from '../utils'
import { evaluatePrototypeExpression } from './projection'
import {
  preparePrototypeRuntime,
  resolvePrototypeFieldAddress,
  runtimeAddressKey,
} from './runtime-snapshot'

function invalid(
  code: string,
  message: string,
  surfaceId: string,
  context: Record<string, string> = {},
): PrototypeDiagnostic {
  return { code, message, context: { surfaceId, ...context } }
}

function reachableCycle(
  rules: readonly ValueChangeRule[],
  changedNodeIds: ReadonlySet<string>,
): string[] | undefined {
  const edges = new Map<string, { target: string, ruleId: string }[]>()
  rules.forEach((rule) => {
    rule.dependencies.forEach((dependency) => {
      const target = rule.action.targetFieldId
      edges.set(dependency, [...(edges.get(dependency) ?? []), { target, ruleId: rule.id }])
    })
  })
  const reachable = new Set<string>()
  const queue = [...changedNodeIds]
  while (queue.length > 0) {
    const current = queue.shift()!
    if (reachable.has(current))
      continue
    reachable.add(current)
    edges.get(current)?.forEach(edge => queue.push(edge.target))
  }
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const rulePath: string[] = []
  const visit = (nodeId: string): string[] | undefined => {
    if (visiting.has(nodeId))
      return [...rulePath]
    if (visited.has(nodeId) || !reachable.has(nodeId))
      return undefined
    visiting.add(nodeId)
    for (const edge of edges.get(nodeId) ?? []) {
      rulePath.push(edge.ruleId)
      const cycle = visit(edge.target)
      if (cycle)
        return cycle
      rulePath.pop()
    }
    visiting.delete(nodeId)
    visited.add(nodeId)
    return undefined
  }
  for (const nodeId of changedNodeIds) {
    const cycle = visit(nodeId)
    if (cycle)
      return cycle
  }
  return undefined
}

function expressionAddress(
  rule: ValueChangeRule,
  runtime: PrototypeInstanceRuntimeSnapshotV1,
  originScope: ConfigFormScopePath,
  changedNodeIds: ReadonlySet<string>,
): PrototypeNodeAddressV1 | undefined {
  const orderedDependencies = [
    ...rule.dependencies.filter(nodeId => changedNodeIds.has(nodeId)),
    ...rule.dependencies.filter(nodeId => !changedNodeIds.has(nodeId)),
  ]
  for (const nodeId of orderedDependencies) {
    const candidates = runtime.fieldInstances
      .map(field => field.address)
      .filter(address => address.nodeId === nodeId && scopeStartsWith(originScope, address.scope))
      .sort((left, right) => right.scope.length - left.scope.length)
    if (candidates.length > 0)
      return candidates[0]
  }
  return undefined
}

export function settlePrototypeValues(
  surface: PrototypeSurfaceContractV1,
  parameters: Readonly<ModelJsonObject>,
  inputValues: ModelJsonObject,
  runtime: PrototypeInstanceRuntimeSnapshotV1,
  originScope: ConfigFormScopePath,
  initialChanged: readonly PrototypeNodeAddressV1[],
): PrototypeReadResult<PrototypeValueSettlement> {
  const prepared = preparePrototypeRuntime(surface, inputValues, runtime)
  if (!prepared.success)
    return prepared
  const rules = surface.interactions.filter((interaction): interaction is ValueChangeRule => interaction.kind === 'valueChange')
  const changedNodeIds = new Set(initialChanged.map(address => address.nodeId))
  const cycle = reachableCycle(rules, changedNodeIds)
  if (cycle) {
    return {
      success: false,
      diagnostics: [invalid('interaction_cycle', 'Value interactions contain a reachable cycle.', surface.id, { ruleIds: cycle.join(',') })],
    }
  }

  const changedAddresses: PrototypeNodeAddressV1[] = initialChanged.map(address => ({
    nodeId: address.nodeId,
    scope: address.scope.map(entry => ({ ...entry })),
  }))
  const changedAddressKeys = new Set(changedAddresses.map(runtimeAddressKey))
  const executed = new Set<string>()
  let progress = true
  try {
    while (progress) {
      progress = false
      for (const rule of rules) {
        if (executed.has(rule.id) || !rule.dependencies.some(nodeId => changedNodeIds.has(nodeId)))
          continue
        const address = expressionAddress(rule, runtime, originScope, changedNodeIds)
        if (!address) {
          return {
            success: false,
            diagnostics: [invalid('prototype_action_invalid', 'Value interaction cannot resolve its dependency in the origin scope.', surface.id, { ruleId: rule.id })],
          }
        }
        executed.add(rule.id)
        progress = true
        const values = prepared.data.store.getValues()
        if (rule.when) {
          const when = evaluatePrototypeExpression({
            surface,
            values,
            parameters,
            runtime,
            address,
            expression: rule.when,
            prepared: prepared.data,
          })
          if (!when.success)
            return { success: false, diagnostics: [{ ...when.diagnostic, context: { surfaceId: surface.id, ruleId: rule.id } }] }
          if (typeof when.value !== 'boolean') {
            return {
              success: false,
              diagnostics: [invalid('interaction_expression_invalid', 'Value interaction conditions must return a boolean.', surface.id, { ruleId: rule.id })],
            }
          }
          if (!when.value)
            continue
        }
        const targetAddress = resolvePrototypeFieldAddress(surface, runtime, address, rule.action.targetFieldId)
        if (!targetAddress) {
          return {
            success: false,
            diagnostics: [invalid('prototype_action_invalid', 'Value interaction target is not resolvable from the origin scope.', surface.id, { ruleId: rule.id })],
          }
        }
        const before = prepared.data.store.getValue(targetAddress.nodeId, targetAddress.scope)
        if (rule.action.kind === 'clear') {
          const operation: ConfigFormValueScopePatchInstance = {
            nodeId: targetAddress.nodeId,
            scope: targetAddress.scope,
            remove: true,
          }
          prepared.data.store.applyPatch({ instances: [operation] })
        }
        else {
          let nextValue
          if (rule.action.kind === 'copy') {
            const sourceAddress = resolvePrototypeFieldAddress(surface, runtime, address, rule.action.sourceFieldId)
            if (!sourceAddress) {
              return {
                success: false,
                diagnostics: [invalid('prototype_action_invalid', 'Value interaction source is not resolvable from the origin scope.', surface.id, { ruleId: rule.id })],
              }
            }
            nextValue = prepared.data.store.getValue(sourceAddress.nodeId, sourceAddress.scope)
            if (nextValue === undefined) {
              return {
                success: false,
                diagnostics: [invalid('interaction_expression_invalid', 'Value copy cannot consume a missing source.', surface.id, { ruleId: rule.id })],
              }
            }
          }
          else {
            const evaluated = evaluatePrototypeExpression({
              surface,
              values,
              parameters,
              runtime,
              address,
              expression: rule.action.value,
              prepared: prepared.data,
            })
            if (!evaluated.success)
              return { success: false, diagnostics: [{ ...evaluated.diagnostic, context: { surfaceId: surface.id, ruleId: rule.id } }] }
            nextValue = evaluated.value
          }
          prepared.data.store.setValue(targetAddress.nodeId, cloneJson(nextValue), targetAddress.scope)
        }
        const after = prepared.data.store.getValue(targetAddress.nodeId, targetAddress.scope)
        if (before === undefined ? after !== undefined : after === undefined || !deepJsonEqual(before, after)) {
          changedNodeIds.add(targetAddress.nodeId)
          const key = runtimeAddressKey(targetAddress)
          if (!changedAddressKeys.has(key)) {
            changedAddressKeys.add(key)
            changedAddresses.push(targetAddress)
          }
        }
      }
    }
  }
  catch (error) {
    return {
      success: false,
      diagnostics: [invalid(
        'prototype_action_invalid',
        error instanceof ConfigFormValueScopeError || error instanceof Error ? error.message : 'Value interaction transaction failed.',
        surface.id,
      )],
    }
  }
  return {
    success: true,
    data: { values: prepared.data.store.getValues(), changedAddresses },
    diagnostics: [],
  }
}
