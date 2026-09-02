import type {
  ConfigFormReaction,
  ConfigFormReactionEffect,
} from '../src/reaction'
import { describe, expect, it } from 'vitest'
import {
  appendConfigFormReactionEffect,
  changeConfigFormReactionOperandSource,
  createConfigFormReaction,
  createConfigFormReactionEffect,
  createConfigFormReactionId,
  createConfigFormReactionLiteralOperand,
  createConfigFormReactionPropKey,
  getConfigFormReactionEffects,
  getConfigFormReactionLiteralKind,
  removeConfigFormReactionEffect,
  renameConfigFormReactionProp,
  replaceConfigFormReactionEffect,
  replaceConfigFormReactionEffects,
  updateConfigFormReactionOperandValue,
  updateConfigFormReactionProp,
  updateConfigFormReactionState,
} from '../src/reaction'

describe('config-form reaction configuration primitives', () => {
  it('creates deterministic ids, reactions, and every effect shape', () => {
    expect(createConfigFormReactionId([])).toBe('reaction-1')
    expect(createConfigFormReactionId([{ id: 'reaction-1' }, { id: 'reaction-3' }])).toBe('reaction-2')
    expect(createConfigFormReactionId([], 'rule')).toBe('rule-1')
    expect(createConfigFormReactionId([], 'reaction', ['reaction-1', 'reaction-2'])).toBe('reaction-3')

    expect(createConfigFormReaction({ id: 'rule', target: 'name' })).toEqual({
      id: 'rule',
      when: { kind: 'literal', value: true },
      then: [{ kind: 'setState', target: 'name', state: { disabled: true } }],
    })
    expect(createConfigFormReactionEffect('setValue', 'name')).toEqual({
      kind: 'setValue',
      target: 'name',
      value: { kind: 'literal', value: '' },
    })
    expect(createConfigFormReactionEffect('clearValue', 'name')).toEqual({ kind: 'clearValue', target: 'name' })
    expect(createConfigFormReactionEffect('setState', 'name')).toEqual({ kind: 'setState', target: 'name', state: { disabled: true } })
    expect(createConfigFormReactionEffect('setProps', 'name')).toEqual({ kind: 'setProps', target: 'name', props: { placeholder: { kind: 'literal', value: '' } } })
    expect(createConfigFormReactionEffect('validate', 'name')).toEqual({ kind: 'validate', target: 'name' })
  })

  it('edits branches immutably and keeps then/else invariants', () => {
    const reaction = createConfigFormReaction({ id: 'rule', target: 'name' })
    const added = appendConfigFormReactionEffect(reaction, 'else', createConfigFormReactionEffect('validate', 'name'))
    expect(added).not.toBe(reaction)
    expect(getConfigFormReactionEffects(added, 'else')).toHaveLength(1)
    expect(reaction.else).toBeUndefined()

    const replaced = replaceConfigFormReactionEffect(added, 'else', 0, createConfigFormReactionEffect('clearValue', 'name'))
    expect(getConfigFormReactionEffects(replaced, 'else')[0]).toEqual({ kind: 'clearValue', target: 'name' })
    expect(replaceConfigFormReactionEffect(replaced, 'else', 4, reaction.then[0]!)).toBe(replaced)
    expect(replaceConfigFormReactionEffect(replaced, 'else', Number.NaN, reaction.then[0]!)).toBe(replaced)
    expect(removeConfigFormReactionEffect(replaced, 'else', 0.5)).toBe(replaced)

    const removedElse = removeConfigFormReactionEffect(replaced, 'else', 0)
    expect(removedElse.else).toBeUndefined()
    expect(replaceConfigFormReactionEffects(reaction, 'then', [])).toBe(reaction)
  })

  it('converts operands and preserves only supported literal values', () => {
    const stringOperand = { kind: 'literal', value: 'ready' } as const
    expect(getConfigFormReactionLiteralKind({ kind: 'field', field: 'name' })).toBe('text')
    expect(getConfigFormReactionLiteralKind(stringOperand)).toBe('text')
    expect(getConfigFormReactionLiteralKind({ kind: 'literal', value: 1 })).toBe('number')
    expect(getConfigFormReactionLiteralKind({ kind: 'literal', value: true })).toBe('boolean')
    expect(getConfigFormReactionLiteralKind({ kind: 'literal', value: { nested: true } })).toBe('complex')
    expect(createConfigFormReactionLiteralOperand('number')).toEqual({ kind: 'literal', value: 0 })
    expect(changeConfigFormReactionOperandSource(stringOperand, 'field', 'name')).toEqual({ kind: 'field', field: 'name' })
    expect(changeConfigFormReactionOperandSource({ kind: 'literal', value: 1 }, 'literal', 'name')).toEqual({ kind: 'literal', value: '' })
    expect(updateConfigFormReactionOperandValue({ kind: 'literal', value: '' }, ['a'])).toEqual({ kind: 'literal', value: ['a'] })
  })

  it('updates state and props without mutating inputs or silently colliding keys', () => {
    const stateEffect = { kind: 'setState', target: 'name', state: { disabled: true, required: true } } as const
    const state = updateConfigFormReactionState(stateEffect, 'disabled', undefined)
    expect(state).toEqual({ kind: 'setState', target: 'name', state: { required: true } })
    expect(stateEffect.state).toEqual({ disabled: true, required: true })
    expect(updateConfigFormReactionState({ kind: 'setState', target: 'name', state: { disabled: true } }, 'disabled', undefined)).toEqual({ kind: 'setState', target: 'name', state: { disabled: true } })

    const propsEffect = { kind: 'setProps', target: 'name', props: { placeholder: { kind: 'literal', value: '' } } } as const
    const withProp = updateConfigFormReactionProp(propsEffect, 'title', { kind: 'literal', value: 'Name' })
    expect(withProp.props).toEqual({ placeholder: { kind: 'literal', value: '' }, title: { kind: 'literal', value: 'Name' } })
    expect(createConfigFormReactionPropKey(withProp)).toBe('prop1')
    expect(updateConfigFormReactionProp(withProp, 'title', undefined).props).toEqual({
      placeholder: { kind: 'literal', value: '' },
    })
    expect(renameConfigFormReactionProp(withProp, 'title', 'placeholder')).toBe(withProp)
    expect(renameConfigFormReactionProp(withProp, 'title', 'displayTitle').props).toHaveProperty('displayTitle')
  })

  it('keeps helper output assignable to the portable effect union', () => {
    const effects: ConfigFormReactionEffect[] = [createConfigFormReactionEffect('validate', 'name')]
    const reaction: ConfigFormReaction = createConfigFormReaction({ id: 'rule', target: 'name' })
    expect(replaceConfigFormReactionEffects(reaction, 'else', effects).else).toEqual(effects)
  })
})
