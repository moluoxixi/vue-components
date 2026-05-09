import type { ComputedRef } from 'vue'
import type { FormRuntime } from '../src/runtime'
import type { NormalizedFieldConfig, ResolvedFormNode } from '../src/types'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h } from 'vue'
import { normalizeFormRuntime, provideRuntime, useRuntime } from '../src/composables/useRuntime'
import { createFormRuntime } from '../src/runtime'
import { hasFieldBinding, isComponent, isContainer, isField } from '../src/runtime/utils'
import { applyFieldTransform, normalizeField, shouldValidateOn } from '../src/utils/field'
import {
  assertUniqueFieldConfigs,
  collectFieldConfigs,
  isDefinedFormNodeConfig,
  isFieldConfig,
  isFormNodeConfig,
  isResolvedComponent,
  isResolvedContainer,
  isResolvedField,
  isResolvedFieldConfig,
  isResolvedFormNodeConfig,
  markDefinedFormNodeConfig,
  markResolvedFormNodeConfig,
} from '../src/utils/node'

describe('runtime utilities', () => {
  it('normalizes field defaults and applies submit transforms explicitly', () => {
    const transformed = vi.fn((value: unknown) => `${String(value).trim()}!`)
    const field = normalizeField({
      component: 'input',
      field: 'name',
      transform: transformed,
      validateOn: 'blur',
    })

    expect(field).toMatchObject({
      blurTrigger: 'blur',
      props: {},
      span: 24,
      submitWhenDisabled: true,
      submitWhenHidden: false,
      trigger: 'update:modelValue',
      validateOn: ['blur', 'submit'],
      valueProp: 'modelValue',
    })
    expect(shouldValidateOn(field, 'blur')).toBe(true)
    expect(shouldValidateOn(field, 'change')).toBe(false)
    expect(applyFieldTransform(field, ' Ada ', { name: ' Ada ' })).toBe('Ada!')
    expect(applyFieldTransform({}, 'Ada', { name: 'Ada' })).toBe('Ada')
    expect(() => normalizeField({
      blurTrigger: 'change',
      component: 'input',
      field: 'bad',
      trigger: 'change',
    })).toThrow(/cannot use the same event/)
  })

  it('classifies runtime nodes by binding and label presence', () => {
    const labelled = { component: 'input', field: 'name', label: '姓名' }
    const unlabelled = { component: 'input', field: 'status' }
    const container = { component: 'section' }

    expect(hasFieldBinding(labelled)).toBe(true)
    expect(isField(labelled)).toBe(true)
    expect(isComponent(unlabelled)).toBe(true)
    expect(isContainer(container)).toBe(true)
    expect(hasFieldBinding(container)).toBe(false)
  })

  it('recognizes plain configs and resolved node shapes without hidden markers', () => {
    const container = markDefinedFormNodeConfig({ component: 'section', props: {} })
    const field = markResolvedFormNodeConfig({
      component: 'input',
      field: 'name',
      label: '姓名',
      props: {},
    } as ResolvedFormNode)
    const componentField = {
      component: 'input',
      field: 'status',
      props: {},
    } as ResolvedFormNode

    expect(isFormNodeConfig(container)).toBe(true)
    expect(isFormNodeConfig(null)).toBe(false)
    expect(isFormNodeConfig([])).toBe(false)
    expect(isFormNodeConfig(h('div'))).toBe(false)
    expect(isFieldConfig(field)).toBe(true)
    expect(isDefinedFormNodeConfig(container)).toBe(true)
    expect(isResolvedFormNodeConfig(field)).toBe(true)
    expect(isResolvedFieldConfig(field)).toBe(true)
    expect(isResolvedField(field)).toBe(true)
    expect(isResolvedComponent(componentField)).toBe(true)
    expect(isResolvedContainer(container)).toBe(true)
  })

  it('collects nested field configs and rejects duplicate field keys', () => {
    const fields = collectFieldConfigs([
      {
        component: 'section',
        slots: {
          default: [
            { component: 'input', field: 'name' },
            {
              component: 'section',
              slots: {
                default: [
                  { component: 'input', field: 'email' },
                ],
              },
            },
          ],
        },
      },
    ])

    expect(fields.map(field => field.field)).toEqual(['name', 'email'])
    expect(assertUniqueFieldConfigs(fields)).toEqual(fields)
    expect(() => collectFieldConfigs([
      {
        component: 'section',
        slots: { default: 'plain text' as never },
      },
    ])).toThrow(/Slot "component node\.slots\.default" must be a field config or an array of field configs/)
    expect(() => collectFieldConfigs([
      { component: 'input', field: 'dup' },
      { component: 'input', field: 'dup' },
    ])).toThrow(/Duplicate field key: dup/)
  })

  it('normalizes and provides runtime instances through Vue context', () => {
    const defaultRuntime = normalizeFormRuntime()
    const customRuntime = normalizeFormRuntime({
      plugins: [
        {
          name: 'binding',
          transformField: field => ({
            ...field,
            valueProp: 'value',
          }),
        },
      ],
    })

    const fallback = defaultRuntime.getFieldDefaults({ component: 'input', field: 'name' }) as NormalizedFieldConfig
    const transformed = customRuntime.transformField({ component: 'input', field: 'name' }) as NormalizedFieldConfig
    expect(fallback.valueProp).toBe('modelValue')
    expect(fallback).not.toHaveProperty('field')
    expect(transformed.valueProp).toBe('value')

    let injectedRuntime: ComputedRef<FormRuntime> | undefined
    const Child = defineComponent({
      name: 'RuntimeConsumer',
      setup() {
        injectedRuntime = useRuntime()
        return () => h('span', 'runtime')
      },
    })
    const Parent = defineComponent({
      name: 'RuntimeProvider',
      setup() {
        provideRuntime(computed(() => customRuntime))
        return () => h(Child)
      },
    })

    mount(Parent)

    expect(injectedRuntime?.value).toBe(customRuntime)
    expect(createFormRuntime().getFieldDefaults({ component: 'input', field: 'plain' }))
      .toEqual({
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
  })
})
