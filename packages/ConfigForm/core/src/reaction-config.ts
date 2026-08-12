import type {
  ConfigFormJsonValue,
  ConfigFormReaction,
  ConfigFormReactionEffect,
  ConfigFormReactionOperand,
  ConfigFormReactionStateKey,
} from './types'

export type ConfigFormReactionBranch = 'then' | 'else'
export type ConfigFormReactionLiteralKind = 'boolean' | 'number' | 'text' | 'complex'

type SetStateReactionEffect = Extract<ConfigFormReactionEffect, { kind: 'setState' }>
type SetPropsReactionEffect = Extract<ConfigFormReactionEffect, { kind: 'setProps' }>

export interface CreateConfigFormReactionOptions {
  id: string
  target: string
  effectKind?: ConfigFormReactionEffect['kind']
}

export function createConfigFormReactionId(
  reactions: readonly Pick<ConfigFormReaction, 'id'>[],
  prefix = 'reaction',
  reservedIds: readonly string[] = [],
): string {
  const ids = new Set([
    ...reactions.map(reaction => reaction.id),
    ...reservedIds,
  ])
  let index = 1
  while (ids.has(`${prefix}-${index}`))
    index += 1
  return `${prefix}-${index}`
}

export function createConfigFormReaction(
  options: CreateConfigFormReactionOptions,
): ConfigFormReaction {
  return {
    id: options.id,
    when: { kind: 'literal', value: true },
    then: [createConfigFormReactionEffect(options.effectKind ?? 'setState', options.target)],
  }
}

export function createConfigFormReactionEffect(
  kind: ConfigFormReactionEffect['kind'],
  target: string,
): ConfigFormReactionEffect {
  switch (kind) {
    case 'setValue':
      return { kind, target, value: { kind: 'literal', value: '' } }
    case 'clearValue':
    case 'validate':
      return { kind, target }
    case 'setState':
      return { kind, target, state: { disabled: true } }
    case 'setProps':
      return { kind, target, props: { placeholder: { kind: 'literal', value: '' } } }
  }
}

export function getConfigFormReactionEffects(
  reaction: ConfigFormReaction,
  branch: ConfigFormReactionBranch,
): readonly ConfigFormReactionEffect[] {
  return branch === 'then' ? reaction.then : (reaction.else ?? [])
}

export function replaceConfigFormReactionEffects(
  reaction: ConfigFormReaction,
  branch: ConfigFormReactionBranch,
  effects: readonly ConfigFormReactionEffect[],
): ConfigFormReaction {
  if (branch === 'then')
    return effects.length ? { ...reaction, then: [...effects] } : reaction

  if (effects.length)
    return { ...reaction, else: [...effects] }

  if (!reaction.else)
    return reaction

  const { else: _removed, ...nextReaction } = reaction
  return nextReaction
}

export function appendConfigFormReactionEffect(
  reaction: ConfigFormReaction,
  branch: ConfigFormReactionBranch,
  effect: ConfigFormReactionEffect,
): ConfigFormReaction {
  return replaceConfigFormReactionEffects(reaction, branch, [
    ...getConfigFormReactionEffects(reaction, branch),
    effect,
  ])
}

export function replaceConfigFormReactionEffect(
  reaction: ConfigFormReaction,
  branch: ConfigFormReactionBranch,
  index: number,
  effect: ConfigFormReactionEffect,
): ConfigFormReaction {
  const effects = getConfigFormReactionEffects(reaction, branch)
  if (!Number.isInteger(index) || index < 0 || index >= effects.length)
    return reaction
  return replaceConfigFormReactionEffects(
    reaction,
    branch,
    effects.map((item, itemIndex) => itemIndex === index ? effect : item),
  )
}

export function removeConfigFormReactionEffect(
  reaction: ConfigFormReaction,
  branch: ConfigFormReactionBranch,
  index: number,
): ConfigFormReaction {
  const effects = getConfigFormReactionEffects(reaction, branch)
  if (!Number.isInteger(index) || index < 0 || index >= effects.length)
    return reaction
  return replaceConfigFormReactionEffects(
    reaction,
    branch,
    effects.filter((_, itemIndex) => itemIndex !== index),
  )
}

export function getConfigFormReactionLiteralKind(
  operand: ConfigFormReactionOperand,
): ConfigFormReactionLiteralKind {
  if (operand.kind === 'field')
    return 'text'
  if (typeof operand.value === 'boolean')
    return 'boolean'
  if (typeof operand.value === 'number')
    return 'number'
  return typeof operand.value === 'string' ? 'text' : 'complex'
}

export function createConfigFormReactionLiteralOperand(
  kind: Exclude<ConfigFormReactionLiteralKind, 'complex'>,
): ConfigFormReactionOperand {
  return {
    kind: 'literal',
    value: kind === 'boolean' ? false : kind === 'number' ? 0 : '',
  }
}

export function changeConfigFormReactionOperandSource(
  operand: ConfigFormReactionOperand,
  source: ConfigFormReactionOperand['kind'],
  defaultField: string,
): ConfigFormReactionOperand {
  if (source === 'field')
    return { kind: 'field', field: defaultField }
  return {
    kind: 'literal',
    value: operand.kind === 'literal' && typeof operand.value === 'string' ? operand.value : '',
  }
}

export function updateConfigFormReactionOperandValue(
  operand: ConfigFormReactionOperand,
  value: ConfigFormJsonValue,
): ConfigFormReactionOperand {
  return operand.kind === 'field'
    ? { kind: 'field', field: String(value) }
    : { kind: 'literal', value }
}

export function updateConfigFormReactionState(
  effect: SetStateReactionEffect,
  key: ConfigFormReactionStateKey,
  value: boolean | undefined,
): SetStateReactionEffect {
  const state = { ...effect.state }
  if (value === undefined)
    delete state[key]
  else
    state[key] = value
  return Object.keys(state).length ? { ...effect, state } : effect
}

export function createConfigFormReactionPropKey(
  effect: SetPropsReactionEffect,
  prefix = 'prop',
): string {
  let index = 1
  while (Object.hasOwn(effect.props, `${prefix}${index}`))
    index += 1
  return `${prefix}${index}`
}

export function updateConfigFormReactionProp(
  effect: SetPropsReactionEffect,
  key: string,
  operand: ConfigFormReactionOperand | undefined,
): SetPropsReactionEffect {
  const props = copyReactionProps(effect.props)
  if (operand)
    defineReactionProp(props, key, operand)
  else
    delete props[key]
  return Object.keys(props).length ? { ...effect, props } : effect
}

export function renameConfigFormReactionProp(
  effect: SetPropsReactionEffect,
  key: string,
  nextKey: string,
): SetPropsReactionEffect {
  const normalizedKey = nextKey.trim()
  if (!normalizedKey || normalizedKey === key || !Object.hasOwn(effect.props, key))
    return effect
  if (Object.hasOwn(effect.props, normalizedKey))
    return effect

  const props: Record<string, ConfigFormReactionOperand> = {}
  Object.entries(effect.props).forEach(([entryKey, operand]) => {
    defineReactionProp(props, entryKey === key ? normalizedKey : entryKey, operand)
  })
  return { ...effect, props }
}

function copyReactionProps(
  props: Record<string, ConfigFormReactionOperand>,
): Record<string, ConfigFormReactionOperand> {
  const copied: Record<string, ConfigFormReactionOperand> = {}
  Object.entries(props).forEach(([key, operand]) => defineReactionProp(copied, key, operand))
  return copied
}

function defineReactionProp(
  props: Record<string, ConfigFormReactionOperand>,
  key: string,
  operand: ConfigFormReactionOperand,
): void {
  Object.defineProperty(props, key, {
    configurable: true,
    enumerable: true,
    value: operand,
    writable: true,
  })
}
