import type { ConfigFormReactionError } from '../src/reaction'
import type { ConfigFormNode } from '../src/types'
import { describe, expect, it, vi } from 'vitest'
import { createConfigFormController } from '../src/controller'
import { applyConfigFormReactions } from '../src/reaction'

interface ReactionForm {
  enabled: boolean
  mode?: string
  name?: string
  summary?: string
}

function reactionFields(): ConfigFormNode<ReactionForm, string>[] {
  return [
    {
      component: 'input',
      field: 'enabled',
      reactions: [{
        id: 'enable-mode',
        when: {
          kind: 'compare',
          operator: 'eq',
          left: { kind: 'field', field: 'enabled' },
          right: { kind: 'literal', value: true },
        },
        then: [
          { kind: 'setValue', target: 'mode', value: { kind: 'literal', value: 'active' } },
          { kind: 'setState', target: 'name', state: { disabled: false, required: true } },
          { kind: 'setProps', target: 'name', props: { placeholder: { kind: 'field', field: 'mode' } } },
          { kind: 'validate', target: 'name' },
        ],
        else: [
          { kind: 'clearValue', target: 'mode' },
          { kind: 'setState', target: 'name', state: { disabled: true, required: false } },
        ],
      }],
    },
    {
      component: 'input',
      field: 'mode',
      reactions: [{
        id: 'copy-mode',
        when: {
          kind: 'compare',
          operator: 'eq',
          left: { kind: 'field', field: 'mode' },
          right: { kind: 'literal', value: 'active' },
        },
        then: [{ kind: 'setValue', target: 'summary', value: { kind: 'field', field: 'mode' } }],
        else: [{ kind: 'clearValue', target: 'summary' }],
      }],
    },
    { component: 'input', field: 'name', required: true, validateOn: 'change' },
    { component: 'input', field: 'summary' },
  ]
}

describe('configForm reactions', () => {
  it('projects chained values, branch state, props and validation targets without mutating nodes', () => {
    const fields = reactionFields()
    const result = applyConfigFormReactions(fields, { enabled: true })

    expect(result.values).toEqual({ enabled: true, mode: 'active', summary: 'active' })
    expect(result.states.name).toEqual({ disabled: false, required: true })
    expect(result.props.name).toEqual({ placeholder: 'active' })
    expect(result.validate).toEqual(['name'])
    expect(fields[0]).not.toHaveProperty('disabled')

    const disabled = applyConfigFormReactions(fields, {
      enabled: false,
      mode: 'stale',
      summary: 'stale',
    })
    expect(disabled.values).toEqual({ enabled: false })
    expect(disabled.states.name).toEqual({ disabled: true, required: false })
  })

  it('commits one stable model and exposes reaction projections from the controller', async () => {
    let model: ReactionForm = { enabled: false }
    const onChange = vi.fn()
    const onFieldChange = vi.fn()
    const controller = createConfigFormController<ReactionForm>({
      fields: reactionFields,
      model: {
        read: () => model,
        write: values => model = values,
      },
      onChange,
      onFieldChange,
    })

    controller.setValue('enabled', true)
    expect(model).toEqual({ enabled: true, mode: 'active', summary: 'active' })
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onFieldChange).toHaveBeenCalledWith({
      field: 'enabled',
      value: true,
      values: model,
    })
    expect(controller.getReactionState('name')).toEqual({ disabled: false, required: true })
    expect(controller.getReactionProps('name')).toEqual({ placeholder: 'active' })

    await vi.waitFor(() => expect(controller.getErrors()).toEqual({ name: ['必填'] }))
  })

  it('fails explicitly when value effects do not converge', () => {
    const fields: ConfigFormNode<Record<string, unknown>, string>[] = [{
      component: 'input',
      field: 'a',
      reactions: [
        {
          id: 'a-to-b',
          when: { kind: 'literal', value: true },
          then: [{ kind: 'setValue', target: 'b', value: { kind: 'field', field: 'a' } }],
        },
        {
          id: 'flip-a',
          when: {
            kind: 'compare',
            operator: 'eq',
            left: { kind: 'field', field: 'b' },
            right: { kind: 'literal', value: 1 },
          },
          then: [{ kind: 'setValue', target: 'a', value: { kind: 'literal', value: 2 } }],
          else: [{ kind: 'setValue', target: 'a', value: { kind: 'literal', value: 1 } }],
        },
      ],
    }]

    expect(() => applyConfigFormReactions(fields, { a: 1, b: 1 }))
      .toThrowError(expect.objectContaining<Partial<ConfigFormReactionError>>({
        code: 'CONFIG_FORM_REACTION_CYCLE',
      }))
  })

  it('keeps prototype-like field and prop keys as own data properties', () => {
    const fields: ConfigFormNode<Record<string, unknown>, string>[] = [{
      component: 'input',
      field: 'source',
      reactions: [{
        id: 'prototype-keys',
        when: { kind: 'literal', value: true },
        then: [
          { kind: 'setValue', target: '__proto__', value: { kind: 'literal', value: 'field' } },
          {
            kind: 'setProps',
            target: '__proto__',
            props: Object.fromEntries([['__proto__', { kind: 'literal', value: 'prop' }]]),
          },
        ],
      }],
    }]
    const result = applyConfigFormReactions(fields, { source: true })

    expect(Object.getOwnPropertyDescriptor(result.values, '__proto__')?.value).toBe('field')
    expect(Object.getOwnPropertyDescriptor(result.props, '__proto__')?.value)
      .toEqual(Object.fromEntries([['__proto__', 'prop']]))
    expect(Object.getPrototypeOf(result.props)).toBeNull()
  })

  it('refreshes reaction values and projections after a dynamic field-tree replacement', () => {
    let model: ReactionForm = { enabled: true }
    let fields: ConfigFormNode<ReactionForm, string>[] = reactionFields()
      .map(field => ({ ...field, reactions: undefined }))
    const onChange = vi.fn()
    const controller = createConfigFormController<ReactionForm>({
      fields: () => fields,
      model: {
        read: () => model,
        write: values => model = values,
      },
      onChange,
    })

    fields = reactionFields()
    controller.refreshReactions()

    expect(model).toEqual({ enabled: true, mode: 'active', summary: 'active' })
    expect(controller.getReactionProps('name')).toEqual({ placeholder: 'active' })
    expect(controller.getReactionState('name')).toEqual({ disabled: false, required: true })
    expect(onChange).toHaveBeenCalledOnce()
  })
})
