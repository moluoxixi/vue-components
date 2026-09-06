import { describe, expect, it } from 'vitest'
import {
  applyConfigFormReactionList,
  cloneConfigFormJsonValue,
  createConfigFormReaction,
  createConfigFormReactionEffect,
  evaluateConfigFormReactionCondition,
} from '../index'

describe('config-form-core reaction API', () => {
  it('evaluates and reduces portable reactions without Headless or Vue', () => {
    const condition = {
      kind: 'compare' as const,
      operator: 'eq' as const,
      left: { kind: 'field' as const, field: 'enabled' },
      right: { kind: 'literal' as const, value: true },
    }
    expect(evaluateConfigFormReactionCondition(condition, { enabled: true })).toBe(true)

    const result = applyConfigFormReactionList([{
      id: 'status',
      when: condition,
      then: [{ kind: 'setValue', target: 'status', value: { kind: 'literal', value: 'ready' } }],
    }], { enabled: true })
    expect(result.values).toEqual({ enabled: true, status: 'ready' })

    expect(createConfigFormReaction({ id: 'portable', target: 'status' })).toEqual({
      id: 'portable',
      when: { kind: 'literal', value: true },
      then: [createConfigFormReactionEffect('setState', 'status')],
    })
  })

  it('exports a defensive JSON clone shared by higher layers', () => {
    const source = { nested: { values: ['before'] } }
    const copy = cloneConfigFormJsonValue(source)

    copy.nested.values[0] = 'after'
    expect(source.nested.values).toEqual(['before'])
  })
})
