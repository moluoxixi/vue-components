import type { NormalizedFieldConfig, NormalizedNodeConfig } from '../src/types'
import { describe, expect, it } from 'vitest'
import { markRaw } from 'vue'
import { BUILT_IN_FIELD_DEFAULTS_PLUGIN } from '../src/plugins/builtInFieldDefaults'
import { createFormRuntime } from '../src/runtime'
import { defineField } from '../src/utils/field'

const RuntimeInput = markRaw({ name: 'RuntimeInput' })
const AlternateInput = markRaw({ name: 'AlternateInput' })

describe('form runtime', () => {
  it('returns built-in default fragments without mutating field configs or merging user config', () => {
    const runtime = createFormRuntime()
    const field = defineField({
      component: 'input',
      field: 'name',
      props: { placeholder: 'Name' },
      trigger: 'input',
    })

    const defaults = runtime.resolveField(field)

    expect(Object.getOwnPropertySymbols(field)).toEqual([])
    expect(Object.getOwnPropertySymbols(defaults)).toEqual([])
    expect(defaults).toEqual({
      blurTrigger: 'blur',
      props: {},
      rootProps: {},
      span: 24,
      submitWhenDisabled: true,
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
            rootProps: {
              ...('rootProps' in field ? field.rootProps : {}),
              'data-plugin-root': 'yes',
              'style': {
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
      rootProps: {
        'data-user-root': 'yes',
        'style': {
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
    expect(resolved.rootProps).toEqual({
      'data-plugin-root': 'yes',
      'data-user-root': 'yes',
      'style': {
        color: 'blue',
        width: '80px',
      },
    })
  })

  it('keeps built-in defaults in the runtime-local lowest-priority plugin', () => {
    const runtime = createFormRuntime({
      plugins: [
        {
          name: 'plugin-defaults',
          transformField: field => ({
            ...field,
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
    expect(runtime.resolveField(rawField)).toEqual(BUILT_IN_FIELD_DEFAULTS_PLUGIN.transformField(rawField))

    const transformed = runtime.transformField(rawField) as NormalizedFieldConfig

    expect(transformed.trigger).toBe('change')
    expect(transformed.valueProp).toBe('value')
    expect(transformed.blurTrigger).toBe('blur')
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

  it('recursively transforms raw slot configs and rejects non-field slot values', () => {
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
        suffix: {
          component: 'input',
          field: 'suffix',
        },
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
    expect(() => runtime.transformField(defineField({
      component: 'section',
      slots: { default: 'plain text' as never },
    }))).toThrow(/Slot "default" must be a field config or an array of field configs/)
    expect(() => runtime.transformField(defineField({
      component: 'section',
      slots: { default: (() => ({ component: 'input', field: 'late' })) as never },
    }))).toThrow(/Slot "default" must be a field config or an array of field configs/)
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
