import type { ComputedRef } from 'vue'
import type { FormContext } from '../src/composables/useFormContext'
import type { FormRuntime } from '../src/runtime'
import type { NormalizedFieldConfig, ResolvedBoundNode, ResolvedFormNode } from '../src/types'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h } from 'vue'
import { FORM_CONTEXT_KEY, useFormContext } from '../src/composables/useFormContext'
import { normalizeFormRuntime, provideRuntime, useRuntime } from '../src/composables/useRuntime'
import { createFormRuntime } from '../src/runtime'
import {
  createReadonlyRenderContext,
  renderReadonlyFallback,
  resolveReadonlyAdapter,
  resolveReadonlyAdapterKey,
} from '../src/runtime/readonly'
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
import { cloneRecordWithChildren, mergeRecords, readPlainRecord } from '../src/utils/object'
import { getResolvedNodeRenderKey, resolveSlotNodes } from '../src/utils/slot'

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
      required: false,
      requiredMessage: '必填',
      span: 24,
      submitWhenDisabled: false,
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

  it('deep merges plain objects while replacing arrays and vnode-shaped values as whole units', () => {
    const PluginComponent = { name: 'PluginComponent' }
    const UserComponent = { name: 'UserComponent' }
    const PluginIcon = { name: 'PluginIcon', setup: () => () => h('span', 'plugin') }
    const UserIcon = { name: 'UserIcon', setup: () => () => h('span', 'user') }
    const merged = mergeRecords(
      {
        component: PluginComponent,
        nested: {
          color: 'blue',
          list: ['left'],
        },
        props: {
          icon: PluginIcon,
        },
        renderer: h('span', 'left'),
      },
      {
        component: UserComponent,
        nested: {
          width: '80px',
          list: ['right'],
        },
        props: {
          icon: UserIcon,
        },
        renderer: h('span', 'right'),
      },
    )

    expect(merged).toEqual({
      component: UserComponent,
      nested: {
        color: 'blue',
        width: '80px',
        list: ['right'],
      },
      props: {
        icon: UserIcon,
      },
      renderer: expect.objectContaining({
        children: 'right',
      }),
    })
    expect(merged.component).toBe(UserComponent)
    expect((merged.props as Record<string, unknown>).icon).toBe(UserIcon)
  })

  it('clones nested child records recursively while preserving component references', () => {
    const component = { name: 'RuntimeInput', setup: () => () => h('input') }
    const field = {
      component,
      field: 'name',
      props: { nested: { placeholder: 'Name' } },
      slots: { suffix: { component: 'span', props: { style: { color: 'red' }, text: '!' } } },
    }

    const cloned = cloneRecordWithChildren(field, ['props', 'slots'])

    expect(cloned).toEqual(field)
    expect(cloned).not.toBe(field)
    expect(cloned.component).toBe(component)
    expect(cloned.props).not.toBe(field.props)
    expect((cloned.props as { nested: object }).nested).not.toBe((field.props as { nested: object }).nested)
    expect(cloned.slots).not.toBe(field.slots)
    expect((cloned.slots as { suffix: { props: object } }).suffix.props).not.toBe((field.slots as { suffix: { props: object } }).suffix.props)

    const cyclicProps: Record<string, unknown> = {}
    cyclicProps.self = cyclicProps

    expect(() => cloneRecordWithChildren({ component, props: cyclicProps }, ['props']))
      .toThrow(/contains a circular plain-object reference/)
  })

  it('keeps cyclic plain objects as opaque replacements when no deep merge is required', () => {
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic

    const merged = mergeRecords(
      { props: { nested: cyclic } },
      { props: { list: ['right'] } },
    )

    expect((merged.props as { nested?: object }).nested).toBe(cyclic)
    expect((merged.props as { list?: string[] }).list).toEqual(['right'])
  })

  it('keeps invalid object inputs and circular arrays explicit', () => {
    const cyclicItems: unknown[] = []
    cyclicItems.push(cyclicItems)

    expect(() => readPlainRecord([], 'plugin options'))
      .toThrow(/plugin options must be a plain object/)
    expect(() => cloneRecordWithChildren({ props: cyclicItems }, ['props']))
      .toThrow(/cloneRecordWithChildren\(props\)\[0\] contains a circular array reference/)
  })

  it('classifies runtime nodes by binding and label presence', () => {
    const labelled = { component: 'input', field: 'name', label: '姓名' }
    const unlabelled = { component: 'input', field: 'status' }
    const identified = { component: 'input', field: 'email', id: 'source-email' }
    const container = { component: 'section' }

    expect(hasFieldBinding(labelled)).toBe(true)
    expect(isField(labelled)).toBe(true)
    expect(isField(identified)).toBe(false)
    expect(isComponent(unlabelled)).toBe(true)
    expect(isComponent(identified)).toBe(true)
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
    const identifiedField = {
      component: 'input',
      field: 'email',
      id: 'source-email',
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
    expect(isResolvedField(identifiedField)).toBe(false)
    expect(isResolvedComponent(identifiedField)).toBe(true)
    expect(isResolvedFieldConfig(componentField)).toBe(true)
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
        id: 'profile-card',
        slots: { default: 'plain text' as never },
      },
    ])).toThrow(/Slot "component#profile-card\.slots\.default" must be a field config, render function, or an array of them/)
    expect(() => collectFieldConfigs([
      { component: 'input', field: 'dup' },
      { component: 'input', field: 'dup' },
    ])).toThrow(/Duplicate field key: dup/)
  })

  it('resolves runtime slot nodes into recursive render entries', () => {
    const runtime = createFormRuntime()
    const field = runtime.transformField({ component: 'input', field: 'name' })
    const identifiedNode = runtime.transformField({ component: 'section', id: 'profile-card' })
    const plainNode = runtime.transformField({ component: 'section' })
    const renderSlot = () => h('span', 'rendered')

    expect(getResolvedNodeRenderKey(field, 'root.0')).toBe('field:name:path:root.0')
    expect(getResolvedNodeRenderKey(identifiedNode, 'root.1')).toBe('node:profile-card:path:root.1')
    expect(getResolvedNodeRenderKey(plainNode, 'root.2')).toBe('node:path:root.2')

    const resolved = resolveSlotNodes([
      field,
      [renderSlot, identifiedNode],
    ], 'default')

    expect(resolved).toEqual([
      {
        field,
        key: 'field:name:path:default.default.0',
      },
      {
        field: identifiedNode,
        key: 'node:profile-card:path:default.default.1.1',
      },
    ])
    expect(resolveSlotNodes(renderSlot, 'suffix')).toEqual([])
    expect(() => resolveSlotNodes('plain text' as never, 'footer'))
      .toThrow(/Slot "footer" must be a field config/)
  })

  it('builds readonly render helpers from resolved field nodes', () => {
    const adapter = vi.fn(({ value }) => h('strong', String(value)))
    const namedComponent = { name: 'NamedInput' }
    const anonymousComponent = {}
    const node = createFormRuntime({
      readonlyAdapters: {
        input: adapter,
      },
    }).transformField({ component: 'input', field: 'name' }) as ResolvedBoundNode
    const values = { name: 'Ada' }

    expect(resolveReadonlyAdapterKey(node.component)).toBe('input')
    expect(resolveReadonlyAdapterKey(namedComponent)).toBe('NamedInput')
    expect(resolveReadonlyAdapterKey(anonymousComponent)).toBeUndefined()
    expect(resolveReadonlyAdapter({ input: adapter }, node)).toBe(adapter)
    expect(resolveReadonlyAdapter({}, { ...node, component: anonymousComponent })).toBeUndefined()

    expect(createReadonlyRenderContext(node, values)).toEqual({
      field: 'name',
      node,
      value: 'Ada',
      values,
    })

    const fallback = renderReadonlyFallback('Ada')
    expect(fallback).toEqual(expect.objectContaining({
      children: 'Ada',
      type: 'span',
    }))
  })

  it('throws a config-form error when form context is missing', () => {
    const MissingContextConsumer = defineComponent({
      name: 'MissingContextConsumer',
      render: () => h('span'),
      setup() {
        useFormContext()
      },
    })

    expect(() => mount(MissingContextConsumer, {
      global: {
        provide: {
          [FORM_CONTEXT_KEY]: undefined as unknown as FormContext,
        },
      },
    }))
      .toThrow(/FormContext not provided/)
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
        required: false,
        requiredMessage: '必填',
        span: 24,
        submitWhenDisabled: false,
        submitWhenHidden: false,
        trigger: 'update:modelValue',
        validateOn: ['submit'],
        valueProp: 'modelValue',
      })
  })
})
