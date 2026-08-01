import { describe, expect, it } from 'vitest'
import { collectAllConfigFormFields, collectConfigFormFields, defineFields } from '../index'

interface AccountForm {
  age: number
  name: string
}

describe('collectConfigFormFields', () => {
  it('evaluates dynamic conditions against the required model', () => {
    const { defineField } = defineFields<AccountForm>()
    const fields = [
      defineField({
        component: 'input',
        disabled: values => values.age < 18,
        field: 'name',
      }),
    ]

    expect(collectConfigFormFields(fields, { age: 17, name: 'Ada' })).toEqual([])
    expect(collectConfigFormFields(fields, { age: 18, name: 'Ada' })).toEqual(fields)

    if (false) {
      // @ts-expect-error Dynamic conditions require the current model.
      collectConfigFormFields(fields)
    }
  })

  it('fails fast for circular configured slots', () => {
    const node: Record<string, unknown> = {
      component: 'div',
      slots: {},
    }
    ;(node.slots as Record<string, unknown>).default = node

    expect(() => collectAllConfigFormFields([node as never])).toThrow(
      'ConfigForm node slots must not contain circular references.',
    )
  })
})
