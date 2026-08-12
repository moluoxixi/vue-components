import type {
  ConfigFormReaction,
  ConfigFormReactionCondition,
  ConfigFormReactionEffect,
  ConfigFormReactionOperand,
  ConfigFormReactionProjection,
  ConfigFormReactionStateKey,
} from './types'

export const CONFIG_FORM_REACTION_MAX_DEPTH = 64

export class ConfigFormReactionError<Context extends Record<string, unknown> = Record<string, unknown>> extends Error {
  readonly code: string
  readonly context: Context

  constructor(code: string, message: string, context: Context = {} as Context) {
    super(message)
    Object.setPrototypeOf(this, new.target.prototype)
    this.name = new.target.name
    this.code = code
    this.context = context
  }
}

export function evaluateConfigFormReactionCondition(
  condition: ConfigFormReactionCondition,
  values: Record<string, unknown>,
): boolean {
  return evaluateReactionCondition(condition, values, 0)
}

function evaluateReactionCondition(
  condition: ConfigFormReactionCondition,
  values: Record<string, unknown>,
  depth: number,
): boolean {
  assertReactionDepth(depth)
  switch (condition.kind) {
    case 'literal': return condition.value
    case 'compare':
      return compareValues(
        resolveOperand(condition.left, values),
        resolveOperand(condition.right, values),
        condition.operator,
      )
    case 'and': return condition.expressions.every(item => evaluateReactionCondition(item, values, depth + 1))
    case 'or': return condition.expressions.some(item => evaluateReactionCondition(item, values, depth + 1))
    case 'not': return !evaluateReactionCondition(condition.expression, values, depth + 1)
  }
}

/** 对已按声明顺序收集的 reaction 列表执行同步稳定事务。 */
export function applyConfigFormReactionList<TValues extends object>(
  reactions: ConfigFormReaction[],
  inputValues: TValues,
): ConfigFormReactionProjection<TValues> {
  const values = { ...inputValues } as TValues & Record<string, unknown>
  const seen: Array<Record<string, unknown>> = [{ ...values }]
  const maxPasses = Math.max(16, reactions.length * 4)

  for (let pass = 0; pass < maxPasses; pass += 1) {
    const passStart = { ...values }
    reactions.forEach((reaction) => {
      if (reaction.enabled === false)
        return
      const effects = evaluateConfigFormReactionCondition(reaction.when, values)
        ? reaction.then
        : (reaction.else ?? [])
      effects.forEach((effect) => {
        if (effect.kind === 'setValue') {
          const nextValue = cloneReactionValue(resolveOperand(effect.value, values))
          if (!equalReactionValues(values[effect.target], nextValue) || !Object.hasOwn(values, effect.target)) {
            defineValue(values, effect.target, nextValue)
          }
        }
        else if (effect.kind === 'clearValue' && Object.hasOwn(values, effect.target)) {
          delete values[effect.target]
        }
      })
    })

    if (equalReactionValues(passStart, values))
      return projectReactions(reactions, values as TValues & Record<string, unknown>)

    if (seen.some(snapshot => equalReactionValues(snapshot, values))) {
      throw new ConfigFormReactionError(
        'CONFIG_FORM_REACTION_CYCLE',
        'ConfigForm reactions did not converge because their value effects form a cycle.',
        { pass: pass + 1 },
      )
    }
    seen.push({ ...values })
  }

  throw new ConfigFormReactionError(
    'CONFIG_FORM_REACTION_CYCLE',
    `ConfigForm reactions exceeded the ${maxPasses}-pass convergence limit.`,
    { maxPasses },
  )
}

function projectReactions<TValues extends object>(
  reactions: ConfigFormReaction[],
  values: TValues & Record<string, unknown>,
): ConfigFormReactionProjection<TValues> {
  const props: Record<string, Record<string, unknown>> = Object.create(null)
  const states: Record<string, Partial<Record<ConfigFormReactionStateKey, boolean>>> = Object.create(null)
  const validate = new Set<string>()

  reactions.forEach((reaction) => {
    if (reaction.enabled === false)
      return
    const effects = evaluateConfigFormReactionCondition(reaction.when, values)
      ? reaction.then
      : (reaction.else ?? [])
    effects.forEach(effect => projectEffect(effect, values, props, states, validate))
  })

  return { values: { ...values } as TValues, props, states, validate: [...validate] }
}

function projectEffect(
  effect: ConfigFormReactionEffect,
  values: Record<string, unknown>,
  props: Record<string, Record<string, unknown>>,
  states: Record<string, Partial<Record<ConfigFormReactionStateKey, boolean>>>,
  validate: Set<string>,
): void {
  if (effect.kind === 'setState') {
    defineValue(states, effect.target, { ...states[effect.target], ...effect.state })
  }
  else if (effect.kind === 'setProps') {
    const nextProps = { ...props[effect.target] }
    Object.entries(effect.props).forEach(([key, operand]) => {
      defineValue(nextProps, key, cloneReactionValue(resolveOperand(operand, values)))
    })
    defineValue(props, effect.target, nextProps)
  }
  else if (effect.kind === 'validate') {
    validate.add(effect.target)
  }
}

function resolveOperand(operand: ConfigFormReactionOperand, values: Record<string, unknown>): unknown {
  return operand.kind === 'field' ? values[operand.field] : operand.value
}

function compareValues(
  left: unknown,
  right: unknown,
  operator: Extract<ConfigFormReactionCondition, { kind: 'compare' }>['operator'],
): boolean {
  switch (operator) {
    case 'eq': return equalReactionValues(left, right)
    case 'neq': return !equalReactionValues(left, right)
    case 'gt': return compareOrdered(left, right, value => value > 0)
    case 'gte': return compareOrdered(left, right, value => value >= 0)
    case 'lt': return compareOrdered(left, right, value => value < 0)
    case 'lte': return compareOrdered(left, right, value => value <= 0)
    case 'in': return Array.isArray(right) && right.some(value => equalReactionValues(left, value))
    case 'contains':
      if (typeof left === 'string' && typeof right === 'string')
        return left.includes(right)
      return Array.isArray(left) && left.some(value => equalReactionValues(value, right))
  }
}

function compareOrdered(left: unknown, right: unknown, compare: (order: number) => boolean): boolean {
  const comparableLeft = left instanceof Date ? left.getTime() : left
  const comparableRight = right instanceof Date ? right.getTime() : right
  if (
    (typeof comparableLeft !== 'number' && typeof comparableLeft !== 'string')
    || typeof comparableLeft !== typeof comparableRight
  ) {
    return false
  }
  const normalizedRight = comparableRight as number | string
  if (comparableLeft === normalizedRight)
    return compare(0)
  return compare(comparableLeft > normalizedRight ? 1 : -1)
}

function equalReactionValues(left: unknown, right: unknown, depth = 0): boolean {
  assertReactionDepth(depth)
  if (Object.is(left, right))
    return true
  if (left instanceof Date && right instanceof Date)
    return left.getTime() === right.getTime()
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length
      && left.every((value, index) => equalReactionValues(value, right[index], depth + 1))
  }
  if (isRecord(left) && isRecord(right)) {
    const leftKeys = Object.keys(left)
    const rightKeys = Object.keys(right)
    return leftKeys.length === rightKeys.length
      && leftKeys.every(key => Object.hasOwn(right, key) && equalReactionValues(left[key], right[key], depth + 1))
  }
  return false
}

function cloneReactionValue(value: unknown, depth = 0): unknown {
  assertReactionDepth(depth)
  if (Array.isArray(value))
    return value.map(item => cloneReactionValue(item, depth + 1))
  if (isRecord(value)) {
    const cloned: Record<string, unknown> = {}
    Object.entries(value).forEach(([key, item]) => defineValue(cloned, key, cloneReactionValue(item, depth + 1)))
    return cloned
  }
  return value
}

function assertReactionDepth(depth: number): void {
  if (depth <= CONFIG_FORM_REACTION_MAX_DEPTH)
    return
  throw new ConfigFormReactionError(
    'CONFIG_FORM_REACTION_DEPTH_EXCEEDED',
    `ConfigForm reaction data exceeded the maximum depth of ${CONFIG_FORM_REACTION_MAX_DEPTH}.`,
    { depth, maxDepth: CONFIG_FORM_REACTION_MAX_DEPTH },
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date)
}

function defineValue(target: Record<string, unknown>, key: string, value: unknown): void {
  Object.defineProperty(target, key, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  })
}
