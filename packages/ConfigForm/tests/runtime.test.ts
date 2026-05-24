import type { NormalizedFieldConfig, NormalizedNodeConfig } from '../src/types'
import { describe, expect, it } from 'vitest'
import { markRaw } from 'vue'
import { BUILT_IN_FIELD_DEFAULTS_PLUGIN } from '../src/plugins/builtInFieldDefaults'
import { createFormRuntime } from '../src/runtime'
import { defineField } from '../src/utils/field'

const RuntimeInput = markRaw({ name: 'RuntimeInput' })
const AlternateInput = markRaw({ name: 'AlternateInput' })

/** 断言 runtime 返回真实字段节点，同时让后续断言通过守卫完成类型收窄。 */
function expectResolvedField(node: ReturnType<ReturnType<typeof createFormRuntime>['transformField']>) {
  if (!('field' in node))
    throw new Error('Expected resolved field node')

  return node
}

describe('form runtime', () => {
  it('returns built-in default fragments without mutating field configs or merging user config', () => {
    const runtime = createFormRuntime()
    const field = defineField({
      component: 'input',
      field: 'name',
      props: { placeholder: 'Name' },
      trigger: 'input',
    })

    const defaults = runtime.getFieldDefaults(field)

    expect(Object.getOwnPropertySymbols(field)).toEqual([])
    expect(Object.getOwnPropertySymbols(defaults)).toEqual([])
    expect(defaults).toEqual({
      blurTrigger: 'blur',
      props: {},
      required: false,
      requiredMessage: '必填',
      span: 24,
      submitWhenDisabled: false,
      submitWhenHidden: false,
      trigger: 'update:modelValue',
      validateOn: ['submit'],
      valueProp: 'modelValue',
    })
    expect(defaults).not.toHaveProperty('component')
    expect(defaults).not.toHaveProperty('field')
    expect(defaults).not.toHaveProperty('label')
    expect(field).not.toHaveProperty('valueProp')
  })

  it('applies priority as user values over plugins over built-in defaults', () => {
    const runtime = createFormRuntime({
      plugins: [
        {
          name: 'ui-defaults',
          getDefaultField: () => ({
            props: {
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

  it('runs default hooks before transform hooks with merged field input', () => {
    const calls: string[] = []
    const runtime = createFormRuntime({
      plugins: [
        {
          name: 'defaults',
          getDefaultField: () => {
            calls.push('getDefaultField')
            return {
              props: {
                addon: 'plugin',
                style: {
                  color: 'blue',
                  width: '44px',
                },
              },
              trigger: 'update:value',
              valueProp: 'value',
            }
          },
          transformField: (field) => {
            const normalizedField = field as NormalizedFieldConfig
            calls.push(`transformField:${normalizedField.valueProp}:${(normalizedField.props.style as Record<string, unknown>).width}`)
            return {
              ...normalizedField,
              props: {
                ...normalizedField.props,
                transformed: true,
              },
            }
          },
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

    expect(calls).toEqual(['getDefaultField', 'transformField:customValue:80px'])
    expect(resolved.valueProp).toBe('customValue')
    expect(resolved.trigger).toBe('update:value')
    expect(resolved.props).toEqual({
      addon: 'plugin',
      style: {
        color: 'blue',
        width: '80px',
      },
      transformed: true,
    })
  })

  it('restores user-declared top-level values after transform hooks', () => {
    const runtime = createFormRuntime({
      plugins: [
        {
          name: 'binding-transform',
          transformField: field => ({
            ...field,
            props: {
              ...field.props,
              placeholder: 'plugin placeholder',
              size: 'middle',
            },
            trigger: 'update:value',
            valueProp: 'value',
          }),
        },
      ],
    })

    const resolved = expectResolvedField(runtime.transformField(defineField({
      component: 'input',
      field: 'name',
      props: {
        placeholder: 'user placeholder',
      },
      valueProp: 'customValue',
    })))

    expect(resolved.valueProp).toBe('customValue')
    expect(resolved.trigger).toBe('update:value')
    expect(resolved.props).toEqual({
      placeholder: 'user placeholder',
      size: 'middle',
    })
  })

  it('keeps built-in defaults in the runtime-local lowest-priority plugin', () => {
    const runtime = createFormRuntime({
      plugins: [
        {
          name: 'plugin-defaults',
          getDefaultField: () => ({
            trigger: 'change',
            valueProp: 'value',
          }),
        },
      ],
    })
    const rawField = defineField({
      component: 'input',
      field: 'name',
    })

    expect(BUILT_IN_FIELD_DEFAULTS_PLUGIN.name).toBe('config-form:built-in-field-defaults')
    expect(runtime.getFieldDefaults(rawField)).toEqual({
      ...BUILT_IN_FIELD_DEFAULTS_PLUGIN.getDefaultField(rawField),
      trigger: 'change',
      valueProp: 'value',
    })

    const transformed = runtime.transformField(rawField) as NormalizedFieldConfig

    expect(transformed.trigger).toBe('change')
    expect(transformed.valueProp).toBe('value')
    expect(transformed.blurTrigger).toBe('blur')
  })

  it('rejects default-field hooks that return node identity or topology fields', () => {
    const cases = [
      ['field', 'other'],
      ['component', 'section'],
      ['slots', { default: { component: 'input', field: 'child' } }],
    ] as const

    for (const [key, value] of cases) {
      expect(() => createFormRuntime({
        plugins: [
          {
            name: `bad-${key}`,
            getDefaultField: () => ({ [key]: value } as never),
          },
        ],
      }).transformField(defineField({ component: 'input', field: 'name' })))
        .toThrow(`Plugin bad-${key} getDefaultField cannot return "${key}"`)
    }
  })

  it('resolves registered components and rejects unknown non-native string component keys', () => {
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
    expect(() => runtime.transformField(defineField({
      component: 'runtimeInput',
      field: 'missingLowercase',
    }))).toThrow(/Unknown component key: runtimeInput/)
  })

  it('recursively transforms raw slot configs and preserves render slot functions', () => {
    const runtime = createFormRuntime()
    const renderSlot = () => ({ component: 'input', field: 'late' })
    const resolved = runtime.transformField(defineField({
      component: 'section',
      slots: {
        default: [
          {
            component: 'input',
            field: 'child',
          },
        ],
        suffix: {
          component: 'input',
          field: 'suffix',
        },
        footer: renderSlot,
      },
    })) as NormalizedNodeConfig

    const defaultSlot = resolved.slots?.default as NormalizedFieldConfig[]
    const suffixSlot = resolved.slots?.suffix as NormalizedFieldConfig

    expect(defaultSlot[0]).toMatchObject({
      field: 'child',
      valueProp: 'modelValue',
    })
    expect(suffixSlot).toMatchObject({
      field: 'suffix',
      trigger: 'update:modelValue',
    })
    expect(resolved.slots?.footer).toBe(renderSlot)
    expect(() => runtime.transformField(defineField({
      component: 'section',
      slots: { default: 'plain text' as never },
    }))).toThrow(/Slot "default" must be a field config, render function, or an array of them/)
  })

  it('enforces plugin name and component registration conflicts', () => {
    expect(() => createFormRuntime({
      plugins: [{ name: 'dup' }, { name: 'dup' }],
    })).toThrow(/Duplicate plugin name: dup/)

    expect(() => createFormRuntime({
      components: { RuntimeInput },
      plugins: [{ components: { RuntimeInput: AlternateInput }, name: 'ui' }],
    })).toThrow(/Component key conflict: RuntimeInput/)

    expect(() => createFormRuntime({
      plugins: [{ components: { FormLayout: AlternateInput }, name: 'built-in-conflict' }],
    })).toThrow(/Component key conflict: FormLayout/)
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
