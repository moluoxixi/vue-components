import type { ConfigFormValueInput } from '../../value-reference'
import type {
  ConfigFormFlowActionStep,
  ConfigFormFlowAuthoringDiagnostic,
  ConfigFormFlowStep,
  ConfigFormFlowStepTreeAnalysis,
} from '../types'
import {
  collectConfigFormValueReferences,
  ConfigFormValueReferenceError,
} from '../../value-reference'
import { analyzeConfigFormExpressionOutputs } from './expressions'

export const CONFIG_FORM_FLOW_AUTHORING_MAX_DEPTH = 32
export const CONFIG_FORM_FLOW_AUTHORING_MAX_STEPS = 4096
export const CONFIG_FORM_FLOW_AUTHORING_MAX_NODES = 4096

const REFERENCE_KEYS = new Set(['$field', '$event', '$output', '$expression'])
const UNSAFE_KEYS = new Set(['__proto__', 'prototype', 'constructor'])
const STEP_TYPES = new Set(['action', 'condition', 'reaction', 'terminate'])
const TERMINATE_OUTCOMES = new Set(['end', 'success', 'failure', 'blocked'])
const COMPARE_OPERATORS = new Set(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'contains'])
const EFFECT_KINDS = new Set(['setValue', 'clearValue', 'setState', 'setProps', 'validate'])
const STATE_KEYS = new Set(['visible', 'disabled', 'readonly', 'required'])

interface ShapeAnalysis {
  actions: ConfigFormFlowActionStep[]
  diagnostics: ConfigFormFlowAuthoringDiagnostic[]
  paths: Map<string, string>
}

interface SequenceState {
  available: Set<string>
  fallsThrough: boolean
}

interface OutputReference {
  outputId: string
  path: string
}

export function validateConfigFormFlowSteps(
  steps: readonly ConfigFormFlowStep[],
): ConfigFormFlowAuthoringDiagnostic[] {
  return analyzeConfigFormFlowStepTree(steps).diagnostics
}

export function analyzeConfigFormFlowStepTree(
  steps: readonly ConfigFormFlowStep[],
  options: { references?: boolean } = {},
): ConfigFormFlowStepTreeAnalysis {
  const shape = analyzeStepShapes(steps)
  const availableOutputs = new Map<string, Set<string>>()
  if (shape.diagnostics.length > 0) {
    return {
      actions: shape.actions,
      availableOutputs,
      diagnostics: shape.diagnostics,
      paths: shape.paths,
    }
  }

  const diagnostics: ConfigFormFlowAuthoringDiagnostic[] = []
  const generatedNodeCount = countGeneratedFlowNodes(steps)
  if (generatedNodeCount > CONFIG_FORM_FLOW_AUTHORING_MAX_NODES) {
    diagnostics.push({
      code: 'FLOW_AUTHORING_NODE_LIMIT_EXCEEDED',
      message: `Lowered flow cannot contain more than ${CONFIG_FORM_FLOW_AUTHORING_MAX_NODES} nodes.`,
      path: 'steps',
    })
    return {
      actions: shape.actions,
      availableOutputs,
      diagnostics,
      paths: shape.paths,
    }
  }
  analyzeSequence(
    steps,
    new Set(),
    'steps',
    availableOutputs,
    diagnostics,
    options.references !== false,
  )
  return {
    actions: shape.actions,
    availableOutputs,
    diagnostics,
    paths: shape.paths,
  }
}

function analyzeStepShapes(steps: readonly ConfigFormFlowStep[]): ShapeAnalysis {
  const diagnostics: ConfigFormFlowAuthoringDiagnostic[] = []
  const paths = new Map<string, string>()
  const actions: ConfigFormFlowActionStep[] = []
  const ids = new Set<string>()
  const activeSequences = new Set<object>()
  let stepCount = 0
  let limitReported = false

  type Frame
    = | { kind: 'sequence', value: unknown, path: string, depth: number }
      | { kind: 'step', value: unknown, path: string, depth: number }
      | { kind: 'exit', value: object }

  const stack: Frame[] = [{ kind: 'sequence', value: steps, path: 'steps', depth: 0 }]
  while (stack.length > 0) {
    const frame = stack.pop()!
    if (frame.kind === 'exit') {
      activeSequences.delete(frame.value)
      continue
    }
    if (frame.kind === 'sequence') {
      if (!Array.isArray(frame.value)) {
        diagnostics.push({
          code: 'FLOW_AUTHORING_SEQUENCE_INVALID',
          message: 'A flow step sequence must be an array.',
          path: frame.path,
        })
        continue
      }
      if (activeSequences.has(frame.value)) {
        diagnostics.push({
          code: 'FLOW_AUTHORING_CYCLE',
          message: 'Flow steps contain a circular branch reference.',
          path: frame.path,
        })
        continue
      }
      if (frame.depth > CONFIG_FORM_FLOW_AUTHORING_MAX_DEPTH) {
        diagnostics.push({
          code: 'FLOW_AUTHORING_DEPTH_EXCEEDED',
          message: `Flow steps exceed the maximum branch depth of ${CONFIG_FORM_FLOW_AUTHORING_MAX_DEPTH}.`,
          path: frame.path,
        })
        continue
      }
      activeSequences.add(frame.value)
      stack.push({ kind: 'exit', value: frame.value })
      for (let index = frame.value.length - 1; index >= 0; index -= 1) {
        stack.push({
          kind: 'step',
          value: frame.value[index],
          path: `${frame.path}.${index}`,
          depth: frame.depth,
        })
      }
      continue
    }

    stepCount += 1
    if (stepCount > CONFIG_FORM_FLOW_AUTHORING_MAX_STEPS && !limitReported) {
      diagnostics.push({
        code: 'FLOW_AUTHORING_STEP_LIMIT_EXCEEDED',
        message: `Flow steps exceed the maximum of ${CONFIG_FORM_FLOW_AUTHORING_MAX_STEPS}.`,
        path: frame.path,
      })
      limitReported = true
    }
    if (!isRecord(frame.value)) {
      diagnostics.push({
        code: 'FLOW_AUTHORING_STEP_INVALID',
        message: 'Every flow step must be an object.',
        path: frame.path,
      })
      continue
    }

    const step = frame.value
    const type = step.type
    const id = step.id
    if (typeof type !== 'string' || !STEP_TYPES.has(type)) {
      diagnostics.push({
        code: 'FLOW_AUTHORING_STEP_TYPE_INVALID',
        message: `Unsupported flow step type: ${String(type)}.`,
        path: `${frame.path}.type`,
      })
      continue
    }
    if (!isNonEmptyString(id)) {
      diagnostics.push({
        code: 'FLOW_AUTHORING_STEP_ID_REQUIRED',
        message: 'Every flow step requires a non-empty id.',
        path: `${frame.path}.id`,
      })
    }
    else {
      if (UNSAFE_KEYS.has(id)) {
        diagnostics.push({
          code: 'FLOW_AUTHORING_UNSAFE_KEY',
          message: `Unsafe flow step id: ${id}.`,
          path: `${frame.path}.id`,
          stepId: id,
        })
      }
      if (ids.has(id)) {
        diagnostics.push({
          code: 'FLOW_AUTHORING_STEP_ID_DUPLICATE',
          message: `Duplicate flow step id: ${id}.`,
          path: `${frame.path}.id`,
          stepId: id,
        })
      }
      else {
        ids.add(id)
        paths.set(id, frame.path)
      }
    }
    if (step.title !== undefined && typeof step.title !== 'string') {
      diagnostics.push({
        code: 'FLOW_AUTHORING_STEP_TITLE_INVALID',
        message: 'Flow step title must be a string.',
        path: `${frame.path}.title`,
        ...(isNonEmptyString(id) ? { stepId: id } : {}),
      })
    }

    if (type === 'action') {
      validateAllowedKeys(step, ['id', 'title', 'type', 'ref', 'input', 'output', 'policy'], frame.path, diagnostics)
      if (!isNonEmptyString(step.ref) || UNSAFE_KEYS.has(step.ref)) {
        diagnostics.push({
          code: 'FLOW_AUTHORING_ACTION_REF_REQUIRED',
          message: 'Action steps require a non-empty safe registry ref.',
          path: `${frame.path}.ref`,
          ...(isNonEmptyString(id) ? { stepId: id } : {}),
        })
      }
      if (step.input !== undefined) {
        validateSerializable(step.input, `${frame.path}.input`, diagnostics)
        validateFlowValueSyntax(step.input, `${frame.path}.input`, diagnostics)
      }
      if (step.output !== undefined) {
        validateSerializable(step.output, `${frame.path}.output`, diagnostics)
        if (!isRecord(step.output)) {
          diagnostics.push({
            code: 'FLOW_AUTHORING_ACTION_OUTPUT_INVALID',
            message: 'Action output mappings must be an object.',
            path: `${frame.path}.output`,
            ...(isNonEmptyString(id) ? { stepId: id } : {}),
          })
        }
        else {
          Object.entries(step.output).forEach(([field, value]) => {
            if (!isNonEmptyString(field) || UNSAFE_KEYS.has(field)) {
              diagnostics.push({
                code: 'FLOW_AUTHORING_ACTION_OUTPUT_FIELD_INVALID',
                message: `Invalid action output field: ${field}.`,
                path: `${frame.path}.output.${field}`,
              })
            }
            validateFlowValueSyntax(value, `${frame.path}.output.${field}`, diagnostics)
          })
        }
      }
      if (step.policy !== undefined) {
        validateSerializable(step.policy, `${frame.path}.policy`, diagnostics)
        validatePolicy(step.policy, `${frame.path}.policy`, diagnostics)
      }
      if (isNonEmptyString(id))
        actions.push(step as unknown as ConfigFormFlowActionStep)
      continue
    }

    if (type === 'condition') {
      validateAllowedKeys(step, ['id', 'title', 'type', 'when', 'then', 'else'], frame.path, diagnostics)
      validateSerializable(step.when, `${frame.path}.when`, diagnostics)
      validateReactionCondition(step.when, `${frame.path}.when`, diagnostics)
      stack.push({
        kind: 'sequence',
        value: step.else,
        path: `${frame.path}.else`,
        depth: frame.depth + 1,
      })
      stack.push({
        kind: 'sequence',
        value: step.then,
        path: `${frame.path}.then`,
        depth: frame.depth + 1,
      })
      continue
    }

    if (type === 'reaction') {
      validateAllowedKeys(step, ['id', 'title', 'type', 'reactions', 'policy'], frame.path, diagnostics)
      validateSerializable(step.reactions, `${frame.path}.reactions`, diagnostics)
      validateReactions(step.reactions, `${frame.path}.reactions`, diagnostics)
      if (step.policy !== undefined) {
        validateSerializable(step.policy, `${frame.path}.policy`, diagnostics)
        validatePolicy(step.policy, `${frame.path}.policy`, diagnostics)
      }
      continue
    }

    validateAllowedKeys(step, ['id', 'title', 'type', 'outcome'], frame.path, diagnostics)
    if (typeof step.outcome !== 'string' || !TERMINATE_OUTCOMES.has(step.outcome)) {
      diagnostics.push({
        code: 'FLOW_AUTHORING_TERMINATE_OUTCOME_INVALID',
        message: `Unsupported terminate outcome: ${String(step.outcome)}.`,
        path: `${frame.path}.outcome`,
        ...(isNonEmptyString(id) ? { stepId: id } : {}),
      })
    }
  }

  return { actions, diagnostics, paths }
}

function analyzeSequence(
  steps: readonly ConfigFormFlowStep[],
  incoming: Set<string>,
  path: string,
  availableOutputs: Map<string, Set<string>>,
  diagnostics: ConfigFormFlowAuthoringDiagnostic[],
  inspectReferences: boolean,
): SequenceState {
  let available = new Set(incoming)
  let fallsThrough = true
  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index]!
    const stepPath = `${path}.${index}`
    if (!fallsThrough) {
      diagnostics.push({
        code: 'FLOW_AUTHORING_STEP_UNREACHABLE',
        message: `Flow step ${step.id} is unreachable after all preceding paths terminate.`,
        path: stepPath,
        stepId: step.id,
      })
      continue
    }

    availableOutputs.set(step.id, new Set(available))
    if (step.type === 'action') {
      if (inspectReferences) {
        inspectFlowInputReferences(step.input, `${stepPath}.input`, available, step.id, diagnostics)
        inspectPolicyReferences(step.policy?.when, `${stepPath}.policy.when`, available, step.id, diagnostics)
        const afterAction = new Set(available).add(step.id)
        inspectFlowInputReferences(step.output, `${stepPath}.output`, afterAction, step.id, diagnostics)
        inspectPolicyReferences(step.policy?.stopWhen, `${stepPath}.policy.stopWhen`, afterAction, step.id, diagnostics)
      }
      available.add(step.id)
      continue
    }
    if (step.type === 'reaction') {
      if (inspectReferences) {
        inspectReactionReferences(step.reactions, `${stepPath}.reactions`, available, step.id, diagnostics)
        inspectPolicyReferences(step.policy?.when, `${stepPath}.policy.when`, available, step.id, diagnostics)
        inspectPolicyReferences(step.policy?.stopWhen, `${stepPath}.policy.stopWhen`, available, step.id, diagnostics)
      }
      continue
    }
    if (step.type === 'terminate') {
      fallsThrough = false
      continue
    }

    if (inspectReferences)
      inspectReactionReferences(step.when, `${stepPath}.when`, available, step.id, diagnostics)
    const thenState = analyzeSequence(
      step.then,
      new Set(available),
      `${stepPath}.then`,
      availableOutputs,
      diagnostics,
      inspectReferences,
    )
    const elseState = analyzeSequence(
      step.else,
      new Set(available),
      `${stepPath}.else`,
      availableOutputs,
      diagnostics,
      inspectReferences,
    )
    if (thenState.fallsThrough && elseState.fallsThrough) {
      available = intersectSets(thenState.available, elseState.available)
    }
    else if (thenState.fallsThrough) {
      available = thenState.available
    }
    else if (elseState.fallsThrough) {
      available = elseState.available
    }
    else {
      fallsThrough = false
    }
  }
  return { available, fallsThrough }
}

function validateFlowValueSyntax(
  value: unknown,
  path: string,
  diagnostics: ConfigFormFlowAuthoringDiagnostic[],
): void {
  try {
    collectConfigFormValueReferences(value as ConfigFormValueInput)
  }
  catch (cause) {
    diagnostics.push({
      code: cause instanceof ConfigFormValueReferenceError ? cause.code : 'FLOW_AUTHORING_REFERENCE_INVALID',
      message: cause instanceof Error ? cause.message : 'Flow value reference is invalid.',
      path: cause instanceof ConfigFormValueReferenceError ? prefixValuePath(path, cause.path) : path,
    })
    return
  }
  const stack: Array<{ value: unknown, path: string }> = [{ value, path }]
  const seen = new Set<object>()
  while (stack.length > 0) {
    const current = stack.pop()!
    if (typeof current.value !== 'object' || current.value === null)
      continue
    if (seen.has(current.value))
      continue
    seen.add(current.value)
    if (Array.isArray(current.value)) {
      for (let index = current.value.length - 1; index >= 0; index -= 1)
        stack.push({ value: current.value[index], path: `${current.path}.${index}` })
      continue
    }
    if (!isRecord(current.value))
      continue
    const keys = Object.keys(current.value)
    if (keys.length === 1 && keys[0] === '$ref')
      continue
    const specialKeys = keys.filter(key => key.startsWith('$'))
    if (specialKeys.length > 0) {
      const key = keys[0]
      const reference = key === undefined ? undefined : current.value[key]
      if (
        keys.length !== 1
        || key === undefined
        || !REFERENCE_KEYS.has(key)
        || !isNonEmptyString(reference)
        || UNSAFE_KEYS.has(reference)
      ) {
        diagnostics.push({
          code: 'FLOW_AUTHORING_REFERENCE_INVALID',
          message: 'Flow references require exactly one supported non-empty string key.',
          path: current.path,
        })
      }
      else if (key === '$expression') {
        validateExpression(reference, `${current.path}.$expression`, diagnostics)
      }
      continue
    }
    for (let index = keys.length - 1; index >= 0; index -= 1) {
      const key = keys[index]!
      stack.push({ value: current.value[key], path: `${current.path}.${key}` })
    }
  }
}

function inspectFlowInputReferences(
  value: unknown,
  path: string,
  available: ReadonlySet<string>,
  stepId: string,
  diagnostics: ConfigFormFlowAuthoringDiagnostic[],
): void {
  if (value === undefined)
    return
  const references: OutputReference[] = []
  try {
    collectConfigFormValueReferences(value as ConfigFormValueInput).forEach((reference) => {
      if (reference.kind === 'output') {
        references.push({
          outputId: reference.id,
          path: prefixValuePath(path, reference.path),
        })
      }
    })
  }
  catch (cause) {
    diagnostics.push({
      code: cause instanceof ConfigFormValueReferenceError ? cause.code : 'FLOW_AUTHORING_REFERENCE_INVALID',
      message: cause instanceof Error ? cause.message : 'Flow value reference is invalid.',
      path: cause instanceof ConfigFormValueReferenceError ? prefixValuePath(path, cause.path) : path,
      stepId,
    })
    return
  }
  const stack: Array<{ value: unknown, path: string }> = [{ value, path }]
  while (stack.length > 0) {
    const current = stack.pop()!
    if (Array.isArray(current.value)) {
      for (let index = current.value.length - 1; index >= 0; index -= 1)
        stack.push({ value: current.value[index], path: `${current.path}.${index}` })
      continue
    }
    if (!isRecord(current.value))
      continue
    const keys = Object.keys(current.value)
    if (keys.length === 1 && keys[0] === '$ref')
      continue
    if (keys.length === 1 && keys[0] === '$output' && typeof current.value.$output === 'string') {
      references.push({ outputId: current.value.$output, path: `${current.path}.$output` })
      continue
    }
    if (keys.length === 1 && keys[0] === '$expression' && typeof current.value.$expression === 'string') {
      const analysis = analyzeConfigFormExpressionOutputs(current.value.$expression, `${current.path}.$expression`)
      diagnostics.push(...analysis.diagnostics.map(diagnostic => ({ ...diagnostic, stepId })))
      references.push(...analysis.references)
      continue
    }
    for (let index = keys.length - 1; index >= 0; index -= 1) {
      const key = keys[index]!
      stack.push({ value: current.value[key], path: `${current.path}.${key}` })
    }
  }
  reportUnavailableReferences(references, available, stepId, diagnostics)
}

function inspectPolicyReferences(
  condition: unknown,
  path: string,
  available: ReadonlySet<string>,
  stepId: string,
  diagnostics: ConfigFormFlowAuthoringDiagnostic[],
): void {
  if (condition !== undefined)
    inspectReactionReferences(condition, path, available, stepId, diagnostics)
}

function inspectReactionReferences(
  value: unknown,
  path: string,
  available: ReadonlySet<string>,
  stepId: string,
  diagnostics: ConfigFormFlowAuthoringDiagnostic[],
): void {
  const references: OutputReference[] = []
  const stack: Array<{ value: unknown, path: string }> = [{ value, path }]
  while (stack.length > 0) {
    const current = stack.pop()!
    if (Array.isArray(current.value)) {
      for (let index = current.value.length - 1; index >= 0; index -= 1)
        stack.push({ value: current.value[index], path: `${current.path}.${index}` })
      continue
    }
    if (!isRecord(current.value))
      continue
    const expressionNode = current.value.kind === 'expression' && typeof current.value.expression === 'string'
    if (expressionNode) {
      const analysis = analyzeConfigFormExpressionOutputs(current.value.expression as string, `${current.path}.expression`)
      diagnostics.push(...analysis.diagnostics.map(diagnostic => ({ ...diagnostic, stepId })))
      references.push(...analysis.references)
    }
    if (current.value.kind === 'literal' || current.value.kind === 'field')
      continue
    const keys = Object.keys(current.value)
    for (let index = keys.length - 1; index >= 0; index -= 1) {
      const key = keys[index]!
      if (!expressionNode || key !== 'expression')
        stack.push({ value: current.value[key], path: `${current.path}.${key}` })
    }
  }
  reportUnavailableReferences(references, available, stepId, diagnostics)
}

function reportUnavailableReferences(
  references: readonly OutputReference[],
  available: ReadonlySet<string>,
  stepId: string,
  diagnostics: ConfigFormFlowAuthoringDiagnostic[],
): void {
  for (const reference of references) {
    if (available.has(reference.outputId))
      continue
    diagnostics.push({
      code: 'FLOW_AUTHORING_OUTPUT_UNAVAILABLE',
      message: `Action output ${reference.outputId} is not available on every path to step ${stepId}.`,
      path: reference.path,
      stepId,
    })
  }
}

function validatePolicy(
  value: unknown,
  path: string,
  diagnostics: ConfigFormFlowAuthoringDiagnostic[],
): void {
  if (!isRecord(value)) {
    diagnostics.push({ code: 'FLOW_AUTHORING_POLICY_INVALID', message: 'Step policy must be an object.', path })
    return
  }
  validateAllowedKeys(value, ['when', 'stopWhen', 'onError', 'timeoutMs'], path, diagnostics)
  if (value.when !== undefined)
    validateReactionCondition(value.when, `${path}.when`, diagnostics)
  if (value.stopWhen !== undefined)
    validateReactionCondition(value.stopWhen, `${path}.stopWhen`, diagnostics)
  if (value.onError !== undefined && value.onError !== 'continue' && value.onError !== 'failure') {
    diagnostics.push({
      code: 'FLOW_AUTHORING_POLICY_ON_ERROR_INVALID',
      message: 'Step policy onError must be "continue" or "failure".',
      path: `${path}.onError`,
    })
  }
  if (value.timeoutMs !== undefined && (!Number.isInteger(value.timeoutMs) || (value.timeoutMs as number) < 0)) {
    diagnostics.push({
      code: 'FLOW_AUTHORING_POLICY_TIMEOUT_INVALID',
      message: 'Step policy timeoutMs must be a non-negative integer.',
      path: `${path}.timeoutMs`,
    })
  }
}

function validateReactionCondition(
  value: unknown,
  path: string,
  diagnostics: ConfigFormFlowAuthoringDiagnostic[],
): void {
  const stack: Array<{ value: unknown, path: string }> = [{ value, path }]
  const seen = new Set<object>()
  while (stack.length > 0) {
    const current = stack.pop()!
    if (!isRecord(current.value)) {
      diagnostics.push({
        code: 'FLOW_AUTHORING_CONDITION_INVALID',
        message: 'Reaction conditions must be objects.',
        path: current.path,
      })
      continue
    }
    if (seen.has(current.value))
      continue
    seen.add(current.value)
    switch (current.value.kind) {
      case 'literal':
        validateAllowedKeys(current.value, ['kind', 'value'], current.path, diagnostics)
        if (typeof current.value.value !== 'boolean')
          diagnostics.push({ code: 'FLOW_AUTHORING_CONDITION_INVALID', message: 'Literal conditions require a boolean value.', path: `${current.path}.value` })
        break
      case 'compare':
        validateAllowedKeys(current.value, ['kind', 'operator', 'left', 'right'], current.path, diagnostics)
        if (typeof current.value.operator !== 'string' || !COMPARE_OPERATORS.has(current.value.operator))
          diagnostics.push({ code: 'FLOW_AUTHORING_CONDITION_INVALID', message: 'Compare condition operator is invalid.', path: `${current.path}.operator` })
        validateReactionOperand(current.value.left, `${current.path}.left`, diagnostics)
        validateReactionOperand(current.value.right, `${current.path}.right`, diagnostics)
        break
      case 'and':
      case 'or':
        validateAllowedKeys(current.value, ['kind', 'expressions'], current.path, diagnostics)
        if (!Array.isArray(current.value.expressions)) {
          diagnostics.push({ code: 'FLOW_AUTHORING_CONDITION_INVALID', message: 'Logical conditions require an expressions array.', path: `${current.path}.expressions` })
        }
        else {
          for (let index = current.value.expressions.length - 1; index >= 0; index -= 1)
            stack.push({ value: current.value.expressions[index], path: `${current.path}.expressions.${index}` })
        }
        break
      case 'not':
        validateAllowedKeys(current.value, ['kind', 'expression'], current.path, diagnostics)
        stack.push({ value: current.value.expression, path: `${current.path}.expression` })
        break
      case 'expression':
        validateAllowedKeys(current.value, ['kind', 'expression'], current.path, diagnostics)
        validateExpression(current.value.expression, `${current.path}.expression`, diagnostics)
        break
      default:
        diagnostics.push({
          code: 'FLOW_AUTHORING_CONDITION_INVALID',
          message: `Unsupported reaction condition kind: ${String(current.value.kind)}.`,
          path: `${current.path}.kind`,
        })
    }
  }
}

function validateReactionOperand(
  value: unknown,
  path: string,
  diagnostics: ConfigFormFlowAuthoringDiagnostic[],
): void {
  if (!isRecord(value)) {
    diagnostics.push({ code: 'FLOW_AUTHORING_OPERAND_INVALID', message: 'Reaction operands must be objects.', path })
    return
  }
  if (value.kind === 'field') {
    validateAllowedKeys(value, ['kind', 'field'], path, diagnostics)
    if (!isNonEmptyString(value.field) || UNSAFE_KEYS.has(value.field))
      diagnostics.push({ code: 'FLOW_AUTHORING_OPERAND_INVALID', message: 'Field operands require a safe field name.', path: `${path}.field` })
    return
  }
  if (value.kind === 'literal') {
    validateAllowedKeys(value, ['kind', 'value'], path, diagnostics)
    return
  }
  if (value.kind === 'expression') {
    validateAllowedKeys(value, ['kind', 'expression'], path, diagnostics)
    validateExpression(value.expression, `${path}.expression`, diagnostics)
    return
  }
  diagnostics.push({
    code: 'FLOW_AUTHORING_OPERAND_INVALID',
    message: `Unsupported reaction operand kind: ${String(value.kind)}.`,
    path: `${path}.kind`,
  })
}

function validateReactions(
  value: unknown,
  path: string,
  diagnostics: ConfigFormFlowAuthoringDiagnostic[],
): void {
  if (!Array.isArray(value)) {
    diagnostics.push({ code: 'FLOW_AUTHORING_REACTIONS_INVALID', message: 'Reaction steps require a reactions array.', path })
    return
  }
  value.forEach((reaction, index) => {
    const reactionPath = `${path}.${index}`
    if (!isRecord(reaction)) {
      diagnostics.push({ code: 'FLOW_AUTHORING_REACTION_INVALID', message: 'Every reaction must be an object.', path: reactionPath })
      return
    }
    validateAllowedKeys(reaction, ['id', 'enabled', 'when', 'then', 'else'], reactionPath, diagnostics)
    if (!isNonEmptyString(reaction.id) || UNSAFE_KEYS.has(reaction.id))
      diagnostics.push({ code: 'FLOW_AUTHORING_REACTION_INVALID', message: 'Every reaction requires a safe id.', path: `${reactionPath}.id` })
    if (reaction.enabled !== undefined && typeof reaction.enabled !== 'boolean')
      diagnostics.push({ code: 'FLOW_AUTHORING_REACTION_INVALID', message: 'Reaction enabled must be a boolean.', path: `${reactionPath}.enabled` })
    validateReactionCondition(reaction.when, `${reactionPath}.when`, diagnostics)
    validateReactionEffects(reaction.then, `${reactionPath}.then`, diagnostics)
    if (reaction.else !== undefined)
      validateReactionEffects(reaction.else, `${reactionPath}.else`, diagnostics)
  })
}

function validateReactionEffects(
  value: unknown,
  path: string,
  diagnostics: ConfigFormFlowAuthoringDiagnostic[],
): void {
  if (!Array.isArray(value)) {
    diagnostics.push({ code: 'FLOW_AUTHORING_REACTION_EFFECTS_INVALID', message: 'Reaction effects must be an array.', path })
    return
  }
  value.forEach((effect, index) => {
    const effectPath = `${path}.${index}`
    if (!isRecord(effect) || typeof effect.kind !== 'string' || !EFFECT_KINDS.has(effect.kind)) {
      diagnostics.push({ code: 'FLOW_AUTHORING_REACTION_EFFECT_INVALID', message: 'Reaction effect is invalid.', path: effectPath })
      return
    }
    if (!isNonEmptyString(effect.target) || UNSAFE_KEYS.has(effect.target))
      diagnostics.push({ code: 'FLOW_AUTHORING_REACTION_EFFECT_INVALID', message: 'Reaction effects require a safe target.', path: `${effectPath}.target` })
    if (effect.kind === 'setValue') {
      validateAllowedKeys(effect, ['kind', 'target', 'value'], effectPath, diagnostics)
      validateReactionOperand(effect.value, `${effectPath}.value`, diagnostics)
    }
    else if (effect.kind === 'setState') {
      validateAllowedKeys(effect, ['kind', 'target', 'state'], effectPath, diagnostics)
      if (!isRecord(effect.state)) {
        diagnostics.push({ code: 'FLOW_AUTHORING_REACTION_EFFECT_INVALID', message: 'setState requires a state object.', path: `${effectPath}.state` })
      }
      else {
        validateAllowedKeys(effect.state, [...STATE_KEYS], `${effectPath}.state`, diagnostics)
        Object.entries(effect.state).forEach(([key, state]) => {
          if (typeof state !== 'boolean')
            diagnostics.push({ code: 'FLOW_AUTHORING_REACTION_EFFECT_INVALID', message: `Reaction state ${key} must be boolean.`, path: `${effectPath}.state.${key}` })
        })
      }
    }
    else if (effect.kind === 'setProps') {
      validateAllowedKeys(effect, ['kind', 'target', 'props'], effectPath, diagnostics)
      if (!isRecord(effect.props)) {
        diagnostics.push({ code: 'FLOW_AUTHORING_REACTION_EFFECT_INVALID', message: 'setProps requires a props object.', path: `${effectPath}.props` })
      }
      else {
        Object.entries(effect.props).forEach(([key, operand]) => validateReactionOperand(operand, `${effectPath}.props.${key}`, diagnostics))
      }
    }
    else {
      validateAllowedKeys(effect, ['kind', 'target'], effectPath, diagnostics)
    }
  })
}

function validateExpression(
  value: unknown,
  path: string,
  diagnostics: ConfigFormFlowAuthoringDiagnostic[],
): void {
  if (typeof value !== 'string') {
    diagnostics.push({ code: 'FLOW_AUTHORING_EXPRESSION_INVALID', message: 'Expression must be a string.', path })
    return
  }
  diagnostics.push(...analyzeConfigFormExpressionOutputs(value, path).diagnostics)
}

function validateSerializable(
  value: unknown,
  path: string,
  diagnostics: ConfigFormFlowAuthoringDiagnostic[],
): void {
  interface Frame { value: unknown, path: string, depth: number, exit?: object }
  const active = new Set<object>()
  const stack: Frame[] = [{ value, path, depth: 0 }]
  while (stack.length > 0) {
    const frame = stack.pop()!
    if (frame.exit) {
      active.delete(frame.exit)
      continue
    }
    const current = frame.value
    if (current === null || typeof current === 'string' || typeof current === 'boolean')
      continue
    if (typeof current === 'number') {
      if (!Number.isFinite(current))
        diagnostics.push({ code: 'FLOW_AUTHORING_NON_JSON_VALUE', message: 'Flow step data must contain finite numbers.', path: frame.path })
      continue
    }
    if (typeof current !== 'object') {
      diagnostics.push({ code: 'FLOW_AUTHORING_NON_JSON_VALUE', message: 'Flow step data must be JSON-compatible.', path: frame.path })
      continue
    }
    if (frame.depth > CONFIG_FORM_FLOW_AUTHORING_MAX_DEPTH) {
      diagnostics.push({
        code: 'FLOW_AUTHORING_DATA_DEPTH_EXCEEDED',
        message: `Flow step data exceeds the maximum depth of ${CONFIG_FORM_FLOW_AUTHORING_MAX_DEPTH}.`,
        path: frame.path,
      })
      continue
    }
    if (active.has(current)) {
      diagnostics.push({ code: 'FLOW_AUTHORING_CYCLE', message: 'Flow step data contains a circular reference.', path: frame.path })
      continue
    }
    if (!Array.isArray(current) && Object.getPrototypeOf(current) !== Object.prototype && Object.getPrototypeOf(current) !== null) {
      diagnostics.push({ code: 'FLOW_AUTHORING_NON_JSON_VALUE', message: 'Flow step data contains an unsupported object.', path: frame.path })
      continue
    }
    active.add(current)
    stack.push({ value: null, path: frame.path, depth: frame.depth, exit: current })
    if (Array.isArray(current)) {
      for (let index = current.length - 1; index >= 0; index -= 1)
        stack.push({ value: current[index], path: `${frame.path}.${index}`, depth: frame.depth + 1 })
    }
    else {
      const keys = Object.keys(current)
      for (let index = keys.length - 1; index >= 0; index -= 1) {
        const key = keys[index]!
        if (UNSAFE_KEYS.has(key)) {
          diagnostics.push({
            code: 'FLOW_AUTHORING_UNSAFE_KEY',
            message: `Unsafe flow step data key: ${key}.`,
            path: `${frame.path}.${key}`,
          })
          continue
        }
        stack.push({
          value: (current as Record<string, unknown>)[key],
          path: `${frame.path}.${key}`,
          depth: frame.depth + 1,
        })
      }
    }
  }
}

function validateAllowedKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
  diagnostics: ConfigFormFlowAuthoringDiagnostic[],
): void {
  const allowedKeys = new Set(allowed)
  for (const key of Object.keys(value)) {
    if (UNSAFE_KEYS.has(key)) {
      diagnostics.push({ code: 'FLOW_AUTHORING_UNSAFE_KEY', message: `Unsafe key: ${key}.`, path: `${path}.${key}` })
    }
    else if (!allowedKeys.has(key)) {
      diagnostics.push({
        code: 'FLOW_AUTHORING_PROPERTY_UNSUPPORTED',
        message: `Unsupported flow authoring property: ${key}.`,
        path: `${path}.${key}`,
      })
    }
  }
}

function countGeneratedFlowNodes(steps: readonly ConfigFormFlowStep[]): number {
  function visit(sequence: readonly ConfigFormFlowStep[]): { count: number, fallsThrough: boolean } {
    let count = 0
    let fallsThrough = true
    for (const step of sequence) {
      count += 1
      if (step.type === 'terminate') {
        fallsThrough = false
      }
      else if (step.type === 'condition') {
        const thenResult = visit(step.then)
        const elseResult = visit(step.else)
        count += thenResult.count + elseResult.count
        const branchFallsThrough = thenResult.fallsThrough || elseResult.fallsThrough
        if (branchFallsThrough)
          count += 1
        if (fallsThrough)
          fallsThrough = branchFallsThrough
      }
    }
    return { count, fallsThrough }
  }

  const result = visit(steps)
  return 1 + result.count + (result.fallsThrough ? 1 : 0)
}

function intersectSets(left: ReadonlySet<string>, right: ReadonlySet<string>): Set<string> {
  return new Set([...left].filter(value => right.has(value)))
}

function prefixValuePath(prefix: string, path: string): string {
  if (path === '$')
    return prefix
  if (path.startsWith('$.'))
    return `${prefix}${path.slice(1)}`
  if (path.startsWith('$['))
    return `${prefix}${path.slice(1)}`
  return prefix
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}
