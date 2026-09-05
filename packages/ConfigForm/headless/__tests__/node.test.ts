import type { ConfigFormNode } from '../index'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { collectAllConfigFormFields, collectConfigFormFields, defineFields, resolveConfigFormFieldStates } from '../index'

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
        id: 'name',
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
      id: 'circular',
      slots: {},
    }
    ;(node.slots as Record<string, unknown>).default = node

    expect(() => collectAllConfigFormFields([node as never])).toThrow(
      'ConfigForm node slots must not contain circular references.',
    )
  })

  it('never lets a field reaction make a hidden parent subtree visible', () => {
    const nodes: ConfigFormNode<AccountForm, string>[] = [{
      component: 'section',
      hidden: true,
      id: 'hidden-section',
      slots: {
        default: [{ component: 'input', field: 'name', hidden: true, id: 'name' }],
      },
    }]
    const values = { age: 18, name: 'Ada' }

    expect(resolveConfigFormFieldStates(nodes, values, false, {
      name: { visible: true },
    })[0]?.visible).toBe(false)

    const visibleParent = [{ ...nodes[0]!, hidden: false }]
    expect(resolveConfigFormFieldStates(visibleParent, values, false, {
      name: { visible: true },
    })[0]?.visible).toBe(true)
  })

  it('accepts specifically typed readonly fields inside heterogeneous component slots', () => {
    interface NamedCellAttrs {
      region?: string
    }

    interface NamedFieldAttrs {
      compact?: boolean
    }

    const Container = defineComponent(() => () => h('section'))
    const Description = defineComponent({
      props: { label: { default: '', type: String } },
      setup: props => () => h('span', props.label),
    })
    const Input = defineComponent({
      props: { modelValue: { default: '', type: String } },
      setup: () => () => h('input'),
    })
    const { defineField } = defineFields<AccountForm>()
    const typedAttrsField = defineField<typeof Input, NamedFieldAttrs, NamedCellAttrs>({
      cellAttrs: { region: 'main' },
      component: Input,
      field: 'name',
      fieldAttrs: { compact: true },
      id: 'typed-name',
    })
    const exactFieldAttrs: NamedFieldAttrs | undefined = typedAttrsField.fieldAttrs
    const exactCellAttrs: NamedCellAttrs | undefined = typedAttrsField.cellAttrs
    const nodes = [defineField({
      component: Container,
      id: 'container',
      slots: {
        default: [
          defineField({
            component: Description,
            id: 'description',
            props: { label: 'Account name' },
          }),
          defineField({
            component: Input,
            field: 'name',
            id: 'name',
            readonlyRender: ({ value }) => {
              const exactValue: string = value
              return exactValue
            },
          }),
        ],
      },
    })]

    expect(collectAllConfigFormFields(nodes).map(field => field.field)).toEqual(['name'])
    expect(exactFieldAttrs).toEqual({ compact: true })
    expect(exactCellAttrs).toEqual({ region: 'main' })

    if (false) {
      // @ts-expect-error Attribute generics must be object-shaped.
      defineField<typeof Input, string>({ component: Input, field: 'name', id: 'invalid-attrs' })
    }
  })
})
