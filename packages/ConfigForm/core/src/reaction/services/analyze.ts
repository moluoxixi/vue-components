import type { ConfigFormExpressionNode } from '../../expression'
import type {
  ConfigFormReaction,
  ConfigFormReactionCondition,
  ConfigFormReactionConfigDiagnostic,
  ConfigFormReactionEffect,
  ConfigFormReactionOperand,
} from '../types'
import {
  CONFIG_FORM_EXPRESSION_FUNCTIONS,
  ConfigFormExpressionError,
  parseConfigFormExpression,
} from '../../expression'
import { CONFIG_FORM_REACTION_MAX_DEPTH } from './evaluate'

const COMPARE_OPERATORS = new Set(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'contains'])
const CONDITION_KINDS = new Set(['literal', 'compare', 'and', 'or', 'not', 'expression'])
const EFFECT_KINDS = new Set(['setValue', 'clearValue', 'setState', 'setProps', 'validate'])
const STATE_KEYS = new Set(['visible', 'disabled', 'readonly', 'required'])
const UNSAFE_KEYS = new Set(['__proto__', 'prototype', 'constructor'])

export function analyzeConfigFormReactionCondition(
  input: unknown,
  path = 'condition',
): ConfigFormReactionConfigDiagnostic[] {
  const diagnostics: ConfigFormReactionConfigDiagnostic[] = []
  analyzeCondition(input, path, diagnostics, 0)
  return diagnostics
}

export function analyzeConfigFormReactionList(
  input: unknown,
  path = 'reactions',
): ConfigFormReactionConfigDiagnostic[] {
  const diagnostics: ConfigFormReactionConfigDiagnostic[] = []
  if (!Array.isArray(input)) {
    diagnostics.push({
      code: 'CONFIG_FORM_REACTION_LIST_INVALID',
      message: 'Reactions must be an array.',
      path,
    })
    return diagnostics
  }

  const ids = new Set<string>()
  input.forEach((reaction, index) => {
    const reactionPath = `${path}.${index}`
    if (!isRecord(reaction)) {
      diagnostics.push({
        code: 'CONFIG_FORM_REACTION_INVALID',
        message: 'A reaction must be an object.',
        path: reactionPath,
      })
      return
    }
    checkKeys(reaction, ['id', 'enabled', 'when', 'then', 'else'], reactionPath, diagnostics)
    if (!isIdentifier(reaction.id)) {
      diagnostics.push({
        code: 'CONFIG_FORM_REACTION_ID_INVALID',
        message: 'A reaction requires a non-empty safe id.',
        path: `${reactionPath}.id`,
      })
    }
    else if (ids.has(reaction.id)) {
      diagnostics.push({
        code: 'CONFIG_FORM_REACTION_ID_DUPLICATE',
        message: `Duplicate reaction id: ${reaction.id}`,
        path: `${reactionPath}.id`,
      })
    }
    else {
      ids.add(reaction.id)
    }
    if (reaction.enabled !== undefined && typeof reaction.enabled !== 'boolean') {
      diagnostics.push({
        code: 'CONFIG_FORM_REACTION_ENABLED_INVALID',
        message: 'Reaction enabled must be a boolean.',
        path: `${reactionPath}.enabled`,
      })
    }
    analyzeCondition(reaction.when, `${reactionPath}.when`, diagnostics, 0)
    analyzeEffects(reaction.then, `${reactionPath}.then`, diagnostics)
    if (reaction.else !== undefined)
      analyzeEffects(reaction.else, `${reactionPath}.else`, diagnostics)
  })
  return diagnostics
}

export function collectConfigFormReactionExpressions(
  conditionOrReactions: ConfigFormReactionCondition | readonly ConfigFormReaction[],
): string[] {
  const expressions: string[] = []
  if (Array.isArray(conditionOrReactions)) {
    conditionOrReactions.forEach((reaction) => {
      collectConditionExpressions(reaction.when, expressions)
      collectEffectExpressions(reaction.then, expressions)
      collectEffectExpressions(reaction.else ?? [], expressions)
    })
  }
  else {
    collectConditionExpressions(conditionOrReactions as ConfigFormReactionCondition, expressions)
  }
  return expressions
}

function analyzeCondition(
  input: unknown,
  path: string,
  diagnostics: ConfigFormReactionConfigDiagnostic[],
  depth: number,
): void {
  if (depth > CONFIG_FORM_REACTION_MAX_DEPTH) {
    diagnostics.push({
      code: 'CONFIG_FORM_REACTION_DEPTH_EXCEEDED',
      message: `ConfigForm reaction data exceeded the maximum depth of ${CONFIG_FORM_REACTION_MAX_DEPTH}.`,
      path,
    })
    return
  }
  if (!isRecord(input) || typeof input.kind !== 'string' || !CONDITION_KINDS.has(input.kind)) {
    diagnostics.push({
      code: 'CONFIG_FORM_REACTION_CONDITION_INVALID',
      message: 'Reaction condition kind is invalid.',
      path,
    })
    return
  }

  if (input.kind === 'literal') {
    checkKeys(input, ['kind', 'value'], path, diagnostics)
    if (typeof input.value !== 'boolean') {
      diagnostics.push({
        code: 'CONFIG_FORM_REACTION_CONDITION_INVALID',
        message: 'Literal conditions require a boolean value.',
        path: `${path}.value`,
      })
    }
    return
  }
  if (input.kind === 'compare') {
    checkKeys(input, ['kind', 'operator', 'left', 'right'], path, diagnostics)
    if (typeof input.operator !== 'string' || !COMPARE_OPERATORS.has(input.operator)) {
      diagnostics.push({
        code: 'CONFIG_FORM_REACTION_OPERATOR_INVALID',
        message: 'Reaction comparison operator is invalid.',
        path: `${path}.operator`,
      })
    }
    analyzeOperand(input.left, `${path}.left`, diagnostics)
    analyzeOperand(input.right, `${path}.right`, diagnostics)
    return
  }
  if (input.kind === 'and' || input.kind === 'or') {
    checkKeys(input, ['kind', 'expressions'], path, diagnostics)
    if (!Array.isArray(input.expressions)) {
      diagnostics.push({
        code: 'CONFIG_FORM_REACTION_CONDITION_INVALID',
        message: `${input.kind} conditions require an expressions array.`,
        path: `${path}.expressions`,
      })
      return
    }
    input.expressions.forEach((condition, index) => analyzeCondition(
      condition,
      `${path}.expressions.${index}`,
      diagnostics,
      depth + 1,
    ))
    return
  }
  if (input.kind === 'not') {
    checkKeys(input, ['kind', 'expression'], path, diagnostics)
    analyzeCondition(input.expression, `${path}.expression`, diagnostics, depth + 1)
    return
  }

  checkKeys(input, ['kind', 'expression'], path, diagnostics)
  analyzeExpression(input.expression, `${path}.expression`, diagnostics)
}

function analyzeOperand(
  input: unknown,
  path: string,
  diagnostics: ConfigFormReactionConfigDiagnostic[],
): void {
  if (!isRecord(input)) {
    diagnostics.push({
      code: 'CONFIG_FORM_REACTION_OPERAND_INVALID',
      message: 'Reaction operand must be an object.',
      path,
    })
    return
  }
  if (input.kind === 'field') {
    checkKeys(input, ['kind', 'field'], path, diagnostics)
    if (!isIdentifier(input.field)) {
      diagnostics.push({
        code: 'CONFIG_FORM_REACTION_OPERAND_INVALID',
        message: 'Field operands require a non-empty safe field.',
        path: `${path}.field`,
      })
    }
    return
  }
  if (input.kind === 'literal') {
    checkKeys(input, ['kind', 'value'], path, diagnostics)
    if (!Object.hasOwn(input, 'value')) {
      diagnostics.push({
        code: 'CONFIG_FORM_REACTION_OPERAND_INVALID',
        message: 'Literal operands require a value.',
        path: `${path}.value`,
      })
    }
    return
  }
  if (input.kind === 'expression') {
    checkKeys(input, ['kind', 'expression'], path, diagnostics)
    analyzeExpression(input.expression, `${path}.expression`, diagnostics)
    return
  }
  diagnostics.push({
    code: 'CONFIG_FORM_REACTION_OPERAND_INVALID',
    message: 'Reaction operand kind is invalid.',
    path: `${path}.kind`,
  })
}

function analyzeEffects(
  input: unknown,
  path: string,
  diagnostics: ConfigFormReactionConfigDiagnostic[],
): void {
  if (!Array.isArray(input)) {
    diagnostics.push({
      code: 'CONFIG_FORM_REACTION_EFFECTS_INVALID',
      message: 'Reaction effects must be an array.',
      path,
    })
    return
  }
  input.forEach((effect, index) => analyzeEffect(effect, `${path}.${index}`, diagnostics))
}

function analyzeEffect(
  input: unknown,
  path: string,
  diagnostics: ConfigFormReactionConfigDiagnostic[],
): void {
  if (!isRecord(input) || typeof input.kind !== 'string' || !EFFECT_KINDS.has(input.kind)) {
    diagnostics.push({
      code: 'CONFIG_FORM_REACTION_EFFECT_INVALID',
      message: 'Reaction effect kind is invalid.',
      path,
    })
    return
  }
  if (!isIdentifier(input.target)) {
    diagnostics.push({
      code: 'CONFIG_FORM_REACTION_TARGET_INVALID',
      message: 'Reaction effects require a non-empty safe target.',
      path: `${path}.target`,
    })
  }
  if (input.kind === 'setValue') {
    checkKeys(input, ['kind', 'target', 'value'], path, diagnostics)
    analyzeOperand(input.value, `${path}.value`, diagnostics)
  }
  else if (input.kind === 'setState') {
    checkKeys(input, ['kind', 'target', 'state'], path, diagnostics)
    if (!isRecord(input.state)) {
      diagnostics.push({
        code: 'CONFIG_FORM_REACTION_STATE_INVALID',
        message: 'setState requires a state object.',
        path: `${path}.state`,
      })
    }
    else {
      checkKeys(input.state, [...STATE_KEYS], `${path}.state`, diagnostics)
      Object.entries(input.state).forEach(([key, value]) => {
        if (STATE_KEYS.has(key) && typeof value !== 'boolean') {
          diagnostics.push({
            code: 'CONFIG_FORM_REACTION_STATE_INVALID',
            message: `Reaction state ${key} must be a boolean.`,
            path: `${path}.state.${key}`,
          })
        }
      })
    }
  }
  else if (input.kind === 'setProps') {
    checkKeys(input, ['kind', 'target', 'props'], path, diagnostics)
    if (!isRecord(input.props)) {
      diagnostics.push({
        code: 'CONFIG_FORM_REACTION_PROPS_INVALID',
        message: 'setProps requires a props object.',
        path: `${path}.props`,
      })
    }
    else {
      Object.entries(input.props).forEach(([key, operand]) => {
        if (UNSAFE_KEYS.has(key)) {
          diagnostics.push({
            code: 'CONFIG_FORM_REACTION_KEY_UNSAFE',
            message: `Unsafe reaction property key: ${key}`,
            path: `${path}.props.${key}`,
          })
        }
        analyzeOperand(operand, `${path}.props.${key}`, diagnostics)
      })
    }
  }
  else {
    checkKeys(input, ['kind', 'target'], path, diagnostics)
  }
}

function analyzeExpression(
  input: unknown,
  path: string,
  diagnostics: ConfigFormReactionConfigDiagnostic[],
): ConfigFormExpressionNode | undefined {
  if (typeof input !== 'string') {
    diagnostics.push({
      code: 'CONFIG_FORM_REACTION_EXPRESSION_INVALID',
      message: 'Reaction expression must be a string.',
      path,
    })
    return undefined
  }
  try {
    const expression = parseConfigFormExpression(input)
    validateExpressionFunctions(expression, path, diagnostics)
    return expression
  }
  catch (cause) {
    diagnostics.push({
      code: cause instanceof ConfigFormExpressionError ? cause.code : 'CONFIG_FORM_REACTION_EXPRESSION_INVALID',
      message: cause instanceof Error ? cause.message : 'Reaction expression is invalid.',
      path,
    })
    return undefined
  }
}

function validateExpressionFunctions(
  node: ConfigFormExpressionNode,
  path: string,
  diagnostics: ConfigFormReactionConfigDiagnostic[],
): void {
  if (node.kind === 'call') {
    const supported = Object.keys(CONFIG_FORM_EXPRESSION_FUNCTIONS)
      .some(name => name.toUpperCase() === node.callee.toUpperCase())
    if (!supported) {
      diagnostics.push({
        code: 'CONFIG_FORM_EXPRESSION_UNKNOWN_FUNCTION',
        message: `Unknown function "${node.callee}".`,
        path,
      })
    }
    node.args.forEach(argument => validateExpressionFunctions(argument, path, diagnostics))
  }
  else if (node.kind === 'member') {
    validateExpressionFunctions(node.object, path, diagnostics)
  }
  else if (node.kind === 'index') {
    validateExpressionFunctions(node.object, path, diagnostics)
    validateExpressionFunctions(node.index, path, diagnostics)
  }
  else if (node.kind === 'array') {
    node.items.forEach(item => validateExpressionFunctions(item, path, diagnostics))
  }
  else if (node.kind === 'unary') {
    validateExpressionFunctions(node.operand, path, diagnostics)
  }
  else if (node.kind === 'binary') {
    validateExpressionFunctions(node.left, path, diagnostics)
    validateExpressionFunctions(node.right, path, diagnostics)
  }
  else if (node.kind === 'conditional') {
    validateExpressionFunctions(node.test, path, diagnostics)
    validateExpressionFunctions(node.consequent, path, diagnostics)
    validateExpressionFunctions(node.alternate, path, diagnostics)
  }
}

function collectConditionExpressions(condition: ConfigFormReactionCondition, target: string[]): void {
  if (condition.kind === 'expression') {
    target.push(condition.expression)
  }
  else if (condition.kind === 'compare') {
    collectOperandExpression(condition.left, target)
    collectOperandExpression(condition.right, target)
  }
  else if (condition.kind === 'and' || condition.kind === 'or') {
    condition.expressions.forEach(item => collectConditionExpressions(item, target))
  }
  else if (condition.kind === 'not') {
    collectConditionExpressions(condition.expression, target)
  }
}

function collectEffectExpressions(effects: readonly ConfigFormReactionEffect[], target: string[]): void {
  effects.forEach((effect) => {
    if (effect.kind === 'setValue')
      collectOperandExpression(effect.value, target)
    else if (effect.kind === 'setProps')
      Object.values(effect.props).forEach(operand => collectOperandExpression(operand, target))
  })
}

function collectOperandExpression(operand: ConfigFormReactionOperand, target: string[]): void {
  if (operand.kind === 'expression')
    target.push(operand.expression)
}

function checkKeys(
  input: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
  diagnostics: ConfigFormReactionConfigDiagnostic[],
): void {
  const allowedKeys = new Set(allowed)
  Object.keys(input).forEach((key) => {
    if (!allowedKeys.has(key)) {
      diagnostics.push({
        code: UNSAFE_KEYS.has(key) ? 'CONFIG_FORM_REACTION_KEY_UNSAFE' : 'CONFIG_FORM_REACTION_PROPERTY_UNEXPECTED',
        message: UNSAFE_KEYS.has(key) ? `Unsafe reaction key: ${key}` : `Unexpected reaction property: ${key}`,
        path: `${path}.${key}`,
      })
    }
  })
}

function isIdentifier(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && !UNSAFE_KEYS.has(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
