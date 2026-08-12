import type { ConfigFormReactionError } from '../src/reaction'
import type { ConfigFormJsonValue, ConfigFormReaction, ConfigFormReactionCondition, ConfigFormReactionOperand } from '../src/types'
import { describe, expect, it } from 'vitest'
import {
  applyConfigFormReactionList,
  CONFIG_FORM_REACTION_MAX_DEPTH,
  evaluateConfigFormReactionCondition,
} from '../src/reaction'

const always = { kind: 'literal', value: true } as const

describe('configForm reaction core', () => {
  it('evaluates the complete serializable condition AST', () => {
    const values = { count: 3, enabled: true, list: ['a', 'b'], name: 'Ada' }
    const conditions: Array<[ConfigFormReactionCondition, boolean]> = [
      [{ kind: 'literal', value: true }, true],
      [{ kind: 'compare', operator: 'neq', left: { kind: 'field', field: 'count' }, right: { kind: 'literal', value: 4 } }, true],
      [{ kind: 'compare', operator: 'gt', left: { kind: 'field', field: 'count' }, right: { kind: 'literal', value: 2 } }, true],
      [{ kind: 'compare', operator: 'gte', left: { kind: 'field', field: 'count' }, right: { kind: 'literal', value: 3 } }, true],
      [{ kind: 'compare', operator: 'lt', left: { kind: 'field', field: 'count' }, right: { kind: 'literal', value: 4 } }, true],
      [{ kind: 'compare', operator: 'lte', left: { kind: 'field', field: 'count' }, right: { kind: 'literal', value: 3 } }, true],
      [{ kind: 'compare', operator: 'in', left: { kind: 'field', field: 'name' }, right: { kind: 'literal', value: ['Ada', 'Lin'] } }, true],
      [{ kind: 'compare', operator: 'contains', left: { kind: 'field', field: 'list' }, right: { kind: 'literal', value: 'b' } }, true],
      [{ kind: 'and', expressions: [{ kind: 'literal', value: true }, { kind: 'literal', value: true }] }, true],
      [{ kind: 'or', expressions: [{ kind: 'literal', value: false }, { kind: 'literal', value: false }] }, false],
      [{ kind: 'not', expression: { kind: 'literal', value: false } }, true],
    ]

    conditions.forEach(([condition, expected]) => {
      expect(evaluateConfigFormReactionCondition(condition, values)).toBe(expected)
    })
  })

  it('converges chained values and applies later projections in declaration order', () => {
    const reactions: ConfigFormReaction[] = [
      {
        id: 'seed',
        when: always,
        then: [
          { kind: 'setValue', target: 'middle', value: { kind: 'field', field: 'source' } },
          { kind: 'setState', target: 'target', state: { disabled: true } },
          { kind: 'setProps', target: 'target', props: { placeholder: { kind: 'literal', value: 'first' } } },
          { kind: 'validate', target: 'target' },
        ],
      },
      {
        id: 'chain',
        when: always,
        then: [
          { kind: 'setValue', target: 'result', value: { kind: 'field', field: 'middle' } },
          { kind: 'setState', target: 'target', state: { disabled: false, required: true } },
          { kind: 'setProps', target: 'target', props: { placeholder: { kind: 'literal', value: 'last' } } },
          { kind: 'validate', target: 'target' },
        ],
      },
    ]

    const projection = applyConfigFormReactionList(reactions, { source: 'ready' })
    expect(projection.values).toEqual({ source: 'ready', middle: 'ready', result: 'ready' })
    expect(projection.states.target).toEqual({ disabled: false, required: true })
    expect(projection.props.target).toEqual({ placeholder: 'last' })
    expect(projection.validate).toEqual(['target'])
  })

  it('treats an ordered overwrite back to the pass-start value as stable', () => {
    const reactions: ConfigFormReaction[] = [
      { id: 'temporary', when: always, then: [{ kind: 'setValue', target: 'value', value: { kind: 'literal', value: 'temporary' } }] },
      { id: 'final', when: always, then: [{ kind: 'setValue', target: 'value', value: { kind: 'literal', value: 'final' } }] },
    ]

    expect(applyConfigFormReactionList(reactions, { value: 'final' }).values).toEqual({ value: 'final' })
  })

  it('honors disabled and else branches and reports non-converging cycles', () => {
    const branches: ConfigFormReaction[] = [
      {
        id: 'disabled',
        enabled: false,
        when: always,
        then: [{ kind: 'setValue', target: 'ignored', value: { kind: 'literal', value: true } }],
      },
      {
        id: 'else',
        when: { kind: 'literal', value: false },
        then: [{ kind: 'setValue', target: 'branch', value: { kind: 'literal', value: 'then' } }],
        else: [{ kind: 'setValue', target: 'branch', value: { kind: 'literal', value: 'else' } }],
      },
    ]
    expect(applyConfigFormReactionList(branches, {}).values).toEqual({ branch: 'else' })

    const cycle: ConfigFormReaction[] = [{
      id: 'flip',
      when: {
        kind: 'compare',
        operator: 'eq',
        left: { kind: 'field', field: 'value' },
        right: { kind: 'literal', value: true },
      },
      then: [{ kind: 'setValue', target: 'value', value: { kind: 'literal', value: false } }],
      else: [{ kind: 'setValue', target: 'value', value: { kind: 'literal', value: true } }],
    }]
    expect(() => applyConfigFormReactionList(cycle, { value: true }))
      .toThrowError(expect.objectContaining<Partial<ConfigFormReactionError>>({ code: 'CONFIG_FORM_REACTION_CYCLE' }))
  })

  it('keeps prototype-like keys as own cloned data properties', () => {
    const props = Object.fromEntries([
      ['constructor', { kind: 'literal', value: { nested: ['safe'] } }],
      ['prototype', { kind: 'literal', value: true }],
    ]) as Record<string, ConfigFormReactionOperand>
    const reactions: ConfigFormReaction[] = [{
      id: 'safe-keys',
      when: always,
      then: [{ kind: 'setProps', target: '__proto__', props }],
    }]
    const projection = applyConfigFormReactionList(reactions, {})
    const prototypeTarget = Object.getOwnPropertyDescriptor(projection.props, '__proto__')!.value as Record<string, unknown>

    expect(Object.getPrototypeOf(projection.props)).toBeNull()
    expect(Object.hasOwn(projection.props, '__proto__')).toBe(true)
    expect(Object.hasOwn(prototypeTarget, 'constructor')).toBe(true)
    expect(Object.hasOwn(prototypeTarget, 'prototype')).toBe(true)
  })

  it('fails with a stable error when condition or value depth exceeds the public limit', () => {
    let condition: ConfigFormReactionCondition = always
    let literalValue: ConfigFormJsonValue = 'end'
    for (let index = 0; index <= CONFIG_FORM_REACTION_MAX_DEPTH; index += 1) {
      condition = { kind: 'not', expression: condition }
      literalValue = [literalValue]
    }
    const value: ConfigFormReactionOperand = { kind: 'literal', value: literalValue }

    expect(() => evaluateConfigFormReactionCondition(condition, {}))
      .toThrowError(expect.objectContaining<Partial<ConfigFormReactionError>>({
        code: 'CONFIG_FORM_REACTION_DEPTH_EXCEEDED',
      }))

    expect(() => applyConfigFormReactionList([{
      id: 'deep-value',
      when: always,
      then: [{ kind: 'setValue', target: 'target', value }],
    }], {})).toThrowError(expect.objectContaining<Partial<ConfigFormReactionError>>({
      code: 'CONFIG_FORM_REACTION_DEPTH_EXCEEDED',
    }))
  })
})
