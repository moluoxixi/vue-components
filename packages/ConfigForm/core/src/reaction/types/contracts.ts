import type { ConfigFormJsonValue } from '../../json'

export type ConfigFormReactionCompareOperator
  = | 'eq'
    | 'neq'
    | 'gt'
    | 'gte'
    | 'lt'
    | 'lte'
    | 'in'
    | 'contains'

export type ConfigFormReactionOperand
  = | { kind: 'field', field: string }
    | { kind: 'literal', value: ConfigFormJsonValue }

export type ConfigFormReactionCondition
  = | { kind: 'literal', value: boolean }
    | {
      kind: 'compare'
      operator: ConfigFormReactionCompareOperator
      left: ConfigFormReactionOperand
      right: ConfigFormReactionOperand
    }
    | { kind: 'and', expressions: ConfigFormReactionCondition[] }
    | { kind: 'or', expressions: ConfigFormReactionCondition[] }
    | { kind: 'not', expression: ConfigFormReactionCondition }

export type ConfigFormReactionStateKey = 'visible' | 'disabled' | 'readonly' | 'required'

export type ConfigFormReactionBranch = 'then' | 'else'
export type ConfigFormReactionLiteralKind = 'boolean' | 'number' | 'text' | 'complex'

export type ConfigFormReactionEffect
  = | { kind: 'setValue', target: string, value: ConfigFormReactionOperand }
    | { kind: 'clearValue', target: string }
    | {
      kind: 'setState'
      target: string
      state: Partial<Record<ConfigFormReactionStateKey, boolean>>
    }
    | {
      kind: 'setProps'
      target: string
      props: Record<string, ConfigFormReactionOperand>
    }
    | { kind: 'validate', target: string }

export interface CreateConfigFormReactionOptions {
  id: string
  target: string
  effectKind?: ConfigFormReactionEffect['kind']
}

/** 可序列化字段联动；条件命中时执行 then，否则执行 else。 */
export interface ConfigFormReaction {
  id: string
  enabled?: boolean
  when: ConfigFormReactionCondition
  then: ConfigFormReactionEffect[]
  else?: ConfigFormReactionEffect[]
}

export interface ConfigFormReactionProjection<TValues extends object = Record<string, unknown>> {
  values: TValues
  props: Record<string, Record<string, unknown>>
  states: Record<string, Partial<Record<ConfigFormReactionStateKey, boolean>>>
  validate: string[]
}
