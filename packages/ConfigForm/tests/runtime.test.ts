import type { NormalizedFieldConfig, NormalizedNodeConfig } from '../src/types'
import { describe, expect, it } from 'vitest'
import { markRaw } from 'vue'
import { createFormRuntime } from '../src/runtime'
import { defineField } from '../src/utils/field'

const RuntimeInput = markRaw({ name: 'RuntimeInput' })
const AlternateInput = markRaw({ name: 'AlternateInput' })

describe('form runtime', () => {
  it('resolves built-in defaults without mutating field configs or adding hidden brands', () => {
    const runtime = createFormRuntime()
    const field = defineField({
      component: 'input',
      field: 'name',
      props: { placeholder: 'Name' },
    })

    const resolved = runtime.resolveField(field) as NormalizedFieldConfig

    expect(Object.getOwnPropertySymbols(field)).toEqual([])
    expect(Object.getOwnPropertySymbols(resolved)).toEqual([])
    expect(resolved).toMatchObject({
      blurTrigger: 'blur',
      component: 'input',
      field: 'name',
      props: { placeholder: 'Name' },
      span: 24,
      submitWhenDisabled: true,
      submitWhenHidden: false,
      trigger: 'update:modelValue',
      validateOn: ['submit'],
      valueProp: 'modelValue',
    })
    expect(field).not.toHaveProperty('valueProp')
  })

  it('applies priority as user values over plugins over built-in defaults', () => {
    const runtime = createFormRuntime({
      plugins: [
        {
          name: 'ui-defaults',
          transformField: field => ({
            ...field,
            props: {
              ...field.props,
              addon: 'plugin',
              style: {
                color: 'blue',
                width: '44px',
              },
            },
            trigger: 'update:value',
            valueProp: 'value',
          }),
        },
      ],
    })

    const resolved = runtime.transformField(defineField({
      component: 'input',
      field: 'name',
      props: {
        style: {
          width: '80px',
        },
      },
      valueProp: 'customValue',
    })) as NormalizedFieldConfig

    expect(resolved.valueProp).toBe('customValue')
    expect(resolved.trigger).toBe('update:value')
    expect(resolved.props).toEqual({
      addon: 'plugin',
      style: {
        color: 'blue',
        width: '80px',
      },
    })
  })

  it('resolves registered components and rejects missing uppercase component keys', () => {
    const runtime = createFormRuntime({
      components: {
        RuntimeInput,
      },
    })

    const resolved = runtime.transformField(defineField({
      component: 'RuntimeInput',
      field: 'name',
    })) as NormalizedFieldConfig
    const container = runtime.transformField(defineField({
      component: 'section',
    }))

    expect(resolved.component).toBe(RuntimeInput)
    expect(container).toMatchObject({ component: 'section', props: {} })
    expect(() => runtime.transformField(defineField({
      component: 'MissingInput',
      field: 'missing',
    }))).toThrow(/Unknown component key: MissingInput/)
  })

  it('recursively transforms raw slot configs and scoped slot return values', () => {
    const runtime = createFormRuntime()
    const resolved = runtime.transformField(defineField({
      component: 'section',
      slots: {
        default: [
          {
            component: 'input',
            field: 'child',
          },
        ],
        suffix: scope => ({
          component: 'input',
          field: `suffix-${String(scope?.id ?? 'none')}`,
        }),
      },
    })) as NormalizedNodeConfig

    const defaultSlot = resolved.slots?.default as NormalizedFieldConfig[]
    const suffixSlot = resolved.slots?.suffix as (scope?: Record<string, unknown>) => NormalizedFieldConfig

    expect(defaultSlot[0]).toMatchObject({
      field: 'child',
      valueProp: 'modelValue',
    })
    expect(suffixSlot({ id: 'scoped' })).toMatchObject({
      field: 'suffix-scoped',
      trigger: 'update:modelValue',
    })
  })

  it('enforces plugin name and component registration conflicts', () => {
    expect(() => createFormRuntime({
      plugins: [{ name: 'dup' }, { name: 'dup' }],
    })).toThrow(/Duplicate plugin name: dup/)

    expect(() => createFormRuntime({
      components: { RuntimeInput },
      plugins: [{ components: { RuntimeInput: AlternateInput }, name: 'ui' }],
    })).toThrow(/Component key conflict: RuntimeInput/)
  })

  it('rejects transforms that return invalid values or change field keys', () => {
    expect(() => createFormRuntime({
      plugins: [
        {
          name: 'bad-return',
          transformField: () => null as never,
        },
      ],
    }).transformField(defineField({ component: 'input', field: 'name' })))
      .toThrow(/Plugin bad-return transformField must return a field object or undefined/)

    expect(() => createFormRuntime({
      plugins: [
        {
          name: 'bad-field-key',
          transformField: field => ({
            ...field,
            field: 'changed',
          }),
        },
      ],
    }).transformField(defineField({ component: 'input', field: 'name' })))
      .toThrow(/Plugin bad-field-key cannot change field key from "name" to "changed"/)
  })
})
