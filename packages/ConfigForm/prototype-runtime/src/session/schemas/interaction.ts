import type {
  NamedResultBinding,
  PrimaryUiAction,
  PrimaryUiActionBinding,
  PrototypeDiagnostic,
  PrototypeInteraction,
  SafeExpressionNode,
  SafeExpressionReferenceScope,
  SafeExpressionV1,
  StateProjectionRule,
  SurfaceParameterBinding,
  ValidationGate,
  ValueAction,
  ValueChangeRule,
} from '../types'
import { hasExactKeys, isRecord, isSafeIdentifier } from '../utils'
import { invalidContract } from './common'
import { readSafeExpression } from './expression'

const TRIGGERS = new Set(['activate', 'submit', 'rowActivate', 'itemActivate'])
const STATE_KEYS = new Set(['visible', 'disabled', 'readonly', 'required'])

function readExpression(
  input: unknown,
  path: readonly (string | number)[],
  diagnostics: PrototypeDiagnostic[],
  scopes: ReadonlySet<SafeExpressionReferenceScope>,
): SafeExpressionV1 | undefined {
  const result = readSafeExpression(input)
  if (!result.success) {
    diagnostics.push(...result.diagnostics.map(diagnostic => ({
      ...diagnostic,
      path: [...path, ...(diagnostic.path ?? [])],
    })))
    return undefined
  }
  const usedScopes = collectReferenceScopes(result.data.ast)
  const unsupported = [...usedScopes].find(scope => !scopes.has(scope))
  if (unsupported) {
    diagnostics.push(invalidContract(
      'interaction_expression_invalid',
      `Expression scope ${unsupported} is not available at this location.`,
      path,
    ))
    return undefined
  }
  return result.data
}

function collectReferenceScopes(node: SafeExpressionNode, target = new Set<SafeExpressionReferenceScope>()): Set<SafeExpressionReferenceScope> {
  switch (node.kind) {
    case 'reference':
      target.add(node.scope)
      break
    case 'array':
      node.items.forEach(item => collectReferenceScopes(item, target))
      break
    case 'unary':
      collectReferenceScopes(node.operand, target)
      break
    case 'binary':
      collectReferenceScopes(node.left, target)
      collectReferenceScopes(node.right, target)
      break
    case 'conditional':
      collectReferenceScopes(node.test, target)
      collectReferenceScopes(node.consequent, target)
      collectReferenceScopes(node.alternate, target)
      break
    case 'call':
      node.args.forEach(argument => collectReferenceScopes(argument, target))
      break
  }
  return target
}

function readStateProjection(
  input: Record<string, unknown>,
  path: readonly (string | number)[],
  diagnostics: PrototypeDiagnostic[],
): StateProjectionRule | undefined {
  if (!hasExactKeys(input, ['kind', 'id', 'target', 'value']) || !isSafeIdentifier(input.id) || !isRecord(input.target))
    return undefined
  let target: StateProjectionRule['target'] | undefined
  if (input.target.kind === 'state'
    && hasExactKeys(input.target, ['kind', 'nodeId', 'key'])
    && isSafeIdentifier(input.target.nodeId) && STATE_KEYS.has(String(input.target.key))) {
    target = { kind: 'state', nodeId: input.target.nodeId, key: input.target.key as Extract<StateProjectionRule['target'], { kind: 'state' }>['key'] }
  }
  if (input.target.kind === 'property'
    && hasExactKeys(input.target, ['kind', 'nodeId', 'path'])
    && isSafeIdentifier(input.target.nodeId) && Array.isArray(input.target.path)
    && input.target.path.length > 0 && input.target.path.every(isSafeIdentifier)) {
    target = { kind: 'property', nodeId: input.target.nodeId, path: [...input.target.path] as string[] }
  }
  const value = readExpression(input.value, [...path, 'value'], diagnostics, new Set(['values', 'parameters']))
  return target && value ? { kind: 'stateProjection', id: input.id, target, value } : undefined
}

function readValueAction(
  input: unknown,
  path: readonly (string | number)[],
  diagnostics: PrototypeDiagnostic[],
): ValueAction | undefined {
  if (!isRecord(input) || typeof input.kind !== 'string')
    return undefined
  if (input.kind === 'set' && hasExactKeys(input, ['kind', 'targetFieldId', 'value']) && isSafeIdentifier(input.targetFieldId)) {
    const value = readExpression(input.value, [...path, 'value'], diagnostics, new Set(['values', 'parameters']))
    return value ? { kind: 'set', targetFieldId: input.targetFieldId, value } : undefined
  }
  if (input.kind === 'copy' && hasExactKeys(input, ['kind', 'sourceFieldId', 'targetFieldId'])
    && isSafeIdentifier(input.sourceFieldId) && isSafeIdentifier(input.targetFieldId)) {
    return { kind: 'copy', sourceFieldId: input.sourceFieldId, targetFieldId: input.targetFieldId }
  }
  if (input.kind === 'clear' && hasExactKeys(input, ['kind', 'targetFieldId']) && isSafeIdentifier(input.targetFieldId))
    return { kind: 'clear', targetFieldId: input.targetFieldId }
  return undefined
}

function readValueChange(
  input: Record<string, unknown>,
  path: readonly (string | number)[],
  diagnostics: PrototypeDiagnostic[],
): ValueChangeRule | undefined {
  if (!hasExactKeys(input, ['kind', 'id', 'dependencies', 'action'], ['when'])
    || !isSafeIdentifier(input.id) || !Array.isArray(input.dependencies)
    || input.dependencies.length === 0 || !input.dependencies.every(isSafeIdentifier)
    || new Set(input.dependencies).size !== input.dependencies.length) {
    return undefined
  }
  const when = input.when === undefined
    ? undefined
    : readExpression(input.when, [...path, 'when'], diagnostics, new Set(['values', 'parameters']))
  const action = readValueAction(input.action, [...path, 'action'], diagnostics)
  if (!action || (input.when !== undefined && !when))
    return undefined
  return {
    kind: 'valueChange',
    id: input.id,
    dependencies: [...input.dependencies] as string[],
    ...(when ? { when } : {}),
    action,
  }
}

function readValidationGate(input: unknown): ValidationGate | undefined {
  if (!isRecord(input) || !hasExactKeys(input, ['scope'], ['fieldIds'])
    || (input.scope !== 'surface' && input.scope !== 'fields')) {
    return undefined
  }
  if (input.scope === 'surface' && input.fieldIds !== undefined)
    return undefined
  if (input.scope === 'fields'
    && (!Array.isArray(input.fieldIds) || input.fieldIds.length === 0
      || !input.fieldIds.every(isSafeIdentifier) || new Set(input.fieldIds).size !== input.fieldIds.length)) {
    return undefined
  }
  return input.scope === 'surface'
    ? { scope: 'surface' }
    : { scope: 'fields', fieldIds: [...input.fieldIds as string[]] }
}

function readParameters(
  input: unknown,
  path: readonly (string | number)[],
  diagnostics: PrototypeDiagnostic[],
): SurfaceParameterBinding[] | undefined {
  if (!Array.isArray(input))
    return undefined
  const names = new Set<string>()
  const result: SurfaceParameterBinding[] = []
  for (let index = 0; index < input.length; index += 1) {
    const binding = input[index]
    if (!isRecord(binding) || !hasExactKeys(binding, ['name', 'value']) || !isSafeIdentifier(binding.name) || names.has(binding.name))
      return undefined
    const value = readExpression(binding.value, [...path, index, 'value'], diagnostics, new Set(['values', 'parameters', 'item']))
    if (!value)
      return undefined
    names.add(binding.name)
    result.push({ name: binding.name, value })
  }
  return result
}

function readOnResults(
  input: unknown,
  path: readonly (string | number)[],
  diagnostics: PrototypeDiagnostic[],
): NamedResultBinding[] | undefined {
  if (!Array.isArray(input))
    return undefined
  const names = new Set<string>()
  const result: NamedResultBinding[] = []
  for (let index = 0; index < input.length; index += 1) {
    const binding = input[index]
    if (!isRecord(binding) || !hasExactKeys(binding, ['resultName', 'assignments'])
      || !isSafeIdentifier(binding.resultName) || names.has(binding.resultName) || !Array.isArray(binding.assignments)) {
      return undefined
    }
    const assignments: NamedResultBinding['assignments'][number][] = []
    const targets = new Set<string>()
    for (let assignmentIndex = 0; assignmentIndex < binding.assignments.length; assignmentIndex += 1) {
      const assignment = binding.assignments[assignmentIndex]
      if (!isRecord(assignment) || !hasExactKeys(assignment, ['targetFieldId', 'value'])
        || !isSafeIdentifier(assignment.targetFieldId) || targets.has(assignment.targetFieldId)) {
        return undefined
      }
      const value = readExpression(
        assignment.value,
        [...path, index, 'assignments', assignmentIndex, 'value'],
        diagnostics,
        new Set(['values', 'parameters', 'result']),
      )
      if (!value)
        return undefined
      targets.add(assignment.targetFieldId)
      assignments.push({ targetFieldId: assignment.targetFieldId, value })
    }
    names.add(binding.resultName)
    result.push({ resultName: binding.resultName, assignments })
  }
  return result
}

function readPrimaryAction(
  input: unknown,
  path: readonly (string | number)[],
  diagnostics: PrototypeDiagnostic[],
): PrimaryUiAction | undefined {
  if (!isRecord(input) || typeof input.kind !== 'string')
    return undefined
  switch (input.kind) {
    case 'navigate':
    case 'open': {
      const open = input.kind === 'open'
      if (!hasExactKeys(input, ['kind', 'targetSurfaceId', 'parameters'], open ? ['onResults'] : []) || !isSafeIdentifier(input.targetSurfaceId))
        return undefined
      const parameters = readParameters(input.parameters, [...path, 'parameters'], diagnostics)
      const onResults = open && input.onResults !== undefined
        ? readOnResults(input.onResults, [...path, 'onResults'], diagnostics)
        : undefined
      if (!parameters || (open && input.onResults !== undefined && !onResults))
        return undefined
      return open
        ? { kind: 'open', targetSurfaceId: input.targetSurfaceId, parameters, ...(onResults ? { onResults } : {}) }
        : { kind: 'navigate', targetSurfaceId: input.targetSurfaceId, parameters }
    }
    case 'back': return hasExactKeys(input, ['kind']) ? { kind: 'back' } : undefined
    case 'closeAll': return hasExactKeys(input, ['kind']) ? { kind: 'closeAll' } : undefined
    case 'closeCurrent': {
      if (!hasExactKeys(input, ['kind'], ['result']))
        return undefined
      if (input.result === undefined)
        return { kind: 'closeCurrent' }
      if (!isRecord(input.result) || !hasExactKeys(input.result, ['name', 'value']) || !isSafeIdentifier(input.result.name))
        return undefined
      const value = readExpression(input.result.value, [...path, 'result', 'value'], diagnostics, new Set(['values', 'parameters', 'item']))
      return value ? { kind: 'closeCurrent', result: { name: input.result.name, value } } : undefined
    }
    default: return undefined
  }
}

function readPrimaryBinding(
  input: Record<string, unknown>,
  path: readonly (string | number)[],
  diagnostics: PrototypeDiagnostic[],
): PrimaryUiActionBinding | undefined {
  if (!hasExactKeys(input, ['kind', 'id', 'nodeId', 'trigger', 'action'], ['validate'])
    || !isSafeIdentifier(input.id) || !isSafeIdentifier(input.nodeId) || !TRIGGERS.has(String(input.trigger))) {
    return undefined
  }
  const validate = input.validate === undefined ? undefined : readValidationGate(input.validate)
  const action = readPrimaryAction(input.action, [...path, 'action'], diagnostics)
  if (!action || (input.validate !== undefined && !validate))
    return undefined
  return {
    kind: 'primaryUiAction',
    id: input.id,
    nodeId: input.nodeId,
    trigger: input.trigger as PrimaryUiActionBinding['trigger'],
    ...(validate ? { validate } : {}),
    action,
  }
}

export function readPrototypeInteractions(
  input: unknown,
  path: readonly (string | number)[],
  diagnostics: PrototypeDiagnostic[],
): PrototypeInteraction[] | undefined {
  if (!Array.isArray(input))
    return undefined
  const result: PrototypeInteraction[] = []
  for (let index = 0; index < input.length; index += 1) {
    const interaction = input[index]
    if (!isRecord(interaction) || typeof interaction.kind !== 'string')
      return undefined
    const itemPath = [...path, index]
    const read = interaction.kind === 'stateProjection'
      ? readStateProjection(interaction, itemPath, diagnostics)
      : interaction.kind === 'valueChange'
        ? readValueChange(interaction, itemPath, diagnostics)
        : interaction.kind === 'primaryUiAction'
          ? readPrimaryBinding(interaction, itemPath, diagnostics)
          : undefined
    if (!read)
      return undefined
    result.push(read)
  }
  return result
}
