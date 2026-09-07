import type { FieldConfig, FormNodeConfig, ResolvedFormNode, ResolvedSlotContent } from '../../types'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { z } from 'zod'
import { ConfigFormError } from '../../errors'
import { createConfigFormBem } from '../bem'
import {
  applyFieldTransform,
  defineField,
  defineFields,
  normalizeField,
  shouldValidateOn,
} from '../field'
import {
  assertUniqueFieldConfigs,
  collectFieldConfigs,
  hasFieldBinding,
  isComponent,
  isContainer,
  isField,
  isFieldConfig,
  isFormNodeConfig,
  isResolvedComponent,
  isResolvedContainer,
  isResolvedField,
  isResolvedFieldConfig,
} from '../node'
import {
  assertSafeRecordKey,
  cloneRecordWithChildren,
  isPlainRecord,
  mergeRecords,
  readPlainRecord,
} from '../object'
import { getResolvedNodeRenderKey, resolveSlotNodes } from '../slot'
import { mergeStyle, mergeStyleValues, readStyleValue, resolveLabelWidth } from '../style'
import { validateField, validateFieldRules, validateForm } from '../validate'
import { asVueFunctionalComponent } from '../vueComponent'

function expectConfigFormError(action: () => unknown, code: string): void {
  try {
    action()
    throw new Error(`Expected ${code}`)
  }
  catch (error) {
    expect(error).toBeInstanceOf(ConfigFormError)
    expect(error).toMatchObject({ code })
  }
}

describe('runtime utility contracts', () => {
  it('creates namespace-aware BEM class names', () => {
    let namespace = 'cf'
    const bem = createConfigFormBem(() => namespace)

    expect(bem.b('form')).toBe('cf-form')
    expect(bem.e('form', 'label')).toBe('cf-form__label')
    namespace = 'custom'
    expect(bem.m('form', 'inline')).toBe('custom-form--inline')
  })

  it('normalizes fields and applies validation and submit transforms', () => {
    const transform = vi.fn((value: unknown, values: Record<string, unknown>) => `${String(value)}:${values.suffix}`)
    const normalized = normalizeField({ component: 'input', field: 'name', transform, validateOn: 'blur' })

    expect(normalized).toMatchObject({
      blurTrigger: 'blur',
      props: {},
      required: false,
      span: 24,
      trigger: 'update:modelValue',
      validateOn: ['blur', 'submit'],
      valueProp: 'modelValue',
    })
    expect(shouldValidateOn(normalized, 'blur')).toBe(true)
    expect(shouldValidateOn(normalized, 'change')).toBe(false)
    expect(applyFieldTransform(normalized, 'value', { suffix: 'done' })).toBe('value:done')
    expect(transform).toHaveBeenCalledWith('value', { suffix: 'done' })
    expect(applyFieldTransform({ transform: undefined }, 3, {})).toBe(3)
  })

  it('keeps defineField and defineFields as shallow configuration factories', () => {
    const props = { placeholder: 'Name' }
    const input = { component: 'input', field: 'name', id: 'name-field', props }
    const direct = defineField(input)
    const factory = defineFields<{ name: string }>()
    const bound = factory.defineField(input)

    expect(direct).toEqual(input)
    expect(direct).not.toBe(input)
    expect(direct.props).toBe(props)
    expect(bound).toEqual(input)
  })

  it('classifies declared and resolved form nodes without treating VNodes as configs', () => {
    const field = { component: 'input', field: 'name', label: 'Name' }
    const component = { component: 'input', field: 'summary' }
    const container = { component: 'section' }

    expect(isFormNodeConfig(field)).toBe(true)
    expect(isFormNodeConfig(null)).toBe(false)
    expect(isFormNodeConfig([])).toBe(false)
    expect(isFormNodeConfig({ field: 'missing-component' })).toBe(false)
    expect(isFormNodeConfig(h('div'))).toBe(false)
    expect(isFieldConfig(field)).toBe(true)
    expect(isFieldConfig({ component: 'input', field: 1 })).toBe(false)
    expect(hasFieldBinding(field)).toBe(true)
    expect(hasFieldBinding(container)).toBe(false)
    expect(isField(field)).toBe(true)
    expect(isComponent(component)).toBe(true)
    expect(isContainer(container)).toBe(true)

    expect(isResolvedField(field as ResolvedFormNode)).toBe(true)
    expect(isResolvedComponent(component as ResolvedFormNode)).toBe(true)
    expect(isResolvedContainer(container as ResolvedFormNode)).toBe(true)
    expect(isResolvedFieldConfig(field as ResolvedFormNode)).toBe(true)
  })

  it('collects nested fields in declaration order and rejects duplicate keys', () => {
    const first: FieldConfig = { component: 'input', field: 'first' }
    const nested: FieldConfig = { component: 'input', field: 'nested' }
    const container: FormNodeConfig = {
      component: 'section',
      slots: {
        default: [nested, () => null],
      },
    }

    expect(collectFieldConfigs([first, container])).toEqual([first, nested])
    expect(assertUniqueFieldConfigs([first])).toEqual([first])
    expectConfigFormError(
      () => collectFieldConfigs([first, { ...first }]),
      'CONFIG_FORM_DUPLICATE_FIELD_KEY',
    )
  })

  it.each([
    [{ component: 'section', field: 'field', slots: { default: 42 } }, 'field.slots.default'],
    [{ component: 'section', id: 'layout', slots: { default: 42 } }, 'component#layout.slots.default'],
    [{ component: 'section', slots: { default: 42 } }, 'component:section.slots.default'],
    [{ component: defineComponent({ name: 'NamedLayout' }), slots: { default: 42 } }, 'component:NamedLayout.slots.default'],
    [{ component: defineComponent({}), slots: { default: 42 } }, 'component node.slots.default'],
  ])('reports the owning node path for invalid slot content', (node, path) => {
    expect(() => collectFieldConfigs([node as unknown as FormNodeConfig])).toThrow(`Slot "${path}"`)
  })

  it('creates stable slot keys and flattens nested slot declarations', () => {
    const field = { component: 'input', field: 'name' } as ResolvedFormNode
    const identified = { component: 'section', id: 'layout' } as ResolvedFormNode
    const anonymous = { component: 'section' } as ResolvedFormNode

    expect(getResolvedNodeRenderKey(field, '0')).toBe('field:name:path:0')
    expect(getResolvedNodeRenderKey(identified, '1')).toBe('node:layout:path:1')
    expect(getResolvedNodeRenderKey(anonymous, '2')).toBe('node:path:2')
    const nestedSlot = [field, [() => null, identified]] as unknown as ResolvedSlotContent
    expect(resolveSlotNodes(nestedSlot, 'default')).toEqual([
      { field, key: 'field:name:path:default.default.0' },
      { field: identified, key: 'node:layout:path:default.default.1.1' },
    ])
    expect(resolveSlotNodes(() => null, 'default')).toEqual([])
    expectConfigFormError(
      () => resolveSlotNodes('invalid' as unknown as ResolvedSlotContent, 'footer'),
      'CONFIG_FORM_INVALID_SLOT_NODE',
    )
  })

  it('normalizes, validates, and merges Vue style values', () => {
    const base = { color: 'red' }
    const override = { color: 'blue', display: 'block' }

    expect(resolveLabelWidth()).toBeUndefined()
    expect(resolveLabelWidth('')).toBeUndefined()
    expect(resolveLabelWidth(120)).toBe('120px')
    expect(resolveLabelWidth('25%')).toBe('25%')
    expect(readStyleValue(null)).toBeUndefined()
    expect(readStyleValue(false)).toBeUndefined()
    expect(readStyleValue('color:red')).toBe('color:red')
    expect(readStyleValue(base)).toBe(base)
    expect(readStyleValue([base, 'display:block'])).toEqual([base, 'display:block'])
    expectConfigFormError(() => readStyleValue(1, 'field.props.style'), 'CONFIG_FORM_INVALID_STYLE_VALUE')
    expect(mergeStyle(undefined, override)).toBe(override)
    expect(mergeStyle(base, undefined)).toBe(base)
    expect(mergeStyle(base, override)).toEqual({ color: 'blue', display: 'block' })
    expect(mergeStyle(base, 'display:block')).toEqual([base, 'display:block'])
    expect(mergeStyleValues()).toBeUndefined()
    expect(mergeStyleValues(base, undefined, override)).toEqual({ color: 'blue', display: 'block' })
    expect(mergeStyleValues(base, 'display:block')).toEqual([base, 'display:block'])
  })

  it('guards, clones, and merges plain records without traversing Vue values', () => {
    const nullPrototype = Object.assign(Object.create(null), { value: 1 })
    expect(isPlainRecord({})).toBe(true)
    expect(isPlainRecord(nullPrototype)).toBe(true)
    expect(isPlainRecord([])).toBe(false)
    expect(isPlainRecord(new Date())).toBe(false)
    expect(readPlainRecord(nullPrototype, 'options')).toBe(nullPrototype)
    expectConfigFormError(() => readPlainRecord([], 'options'), 'CONFIG_FORM_INVALID_PLAIN_OBJECT')
    expect(() => assertSafeRecordKey('safe', 'options')).not.toThrow()
    expectConfigFormError(() => assertSafeRecordKey('__proto__', 'options'), 'CONFIG_FORM_UNSAFE_OBJECT_KEY')

    const component = defineComponent({
      name: 'FixtureComponent',
      setup: () => () => h('span'),
    })
    const vnode = h('span')
    const child = { array: [{ value: 1 }], component, date: new Date(0), vnode }
    const source = { child, untouched: child }
    const clone = cloneRecordWithChildren(source, ['child'])
    expect(clone).not.toBe(source)
    expect(clone.child).not.toBe(child)
    expect(clone.child.array).not.toBe(child.array)
    expect(clone.child.array[0]).not.toBe(child.array[0])
    expect(clone.child.component).toBe(component)
    expect(clone.child.date).toBe(child.date)
    expect(clone.child.vnode).toBe(vnode)
    expect(clone.untouched).toBe(child)

    expect(mergeRecords(undefined, {
      nested: { left: 1 },
      replace: [1],
    }, {
      nested: { right: 2 },
      replace: [2],
    })).toEqual({
      nested: { left: 1, right: 2 },
      replace: [2],
    })
    expect(mergeRecords({ component: { setup: () => null } }, { component })).toEqual({ component })
    expectConfigFormError(
      () => mergeRecords(JSON.parse('{"__proto__":{"polluted":true}}')),
      'CONFIG_FORM_UNSAFE_OBJECT_KEY',
    )
  })

  it('rejects circular child structures while cloning', () => {
    const array: unknown[] = []
    array.push(array)
    const record: Record<string, unknown> = {}
    record.self = record

    expectConfigFormError(
      () => cloneRecordWithChildren({ child: array }, ['child']),
      'CONFIG_FORM_CIRCULAR_ARRAY_REFERENCE',
    )
    expectConfigFormError(
      () => cloneRecordWithChildren({ child: record }, ['child']),
      'CONFIG_FORM_CIRCULAR_PLAIN_OBJECT_REFERENCE',
    )
  })

  it('runs Zod, required, and custom field validation in order', async () => {
    expect(validateField('ok', z.string())).toEqual([])
    expect(validateField(1, z.string({ invalid_type_error: 'Expected text' }))).toEqual(['Expected text'])

    for (const empty of [undefined, null, '', '  ', []]) {
      await expect(validateFieldRules(empty, undefined, {}, undefined, true, 'Required')).resolves.toEqual(['Required'])
    }
    for (const present of [0, false, ['value']]) {
      await expect(validateFieldRules(present, undefined, {}, undefined, true)).resolves.toEqual([])
    }

    const validator = vi.fn((value: unknown) => value === 'ready' ? ['Custom', ''] : undefined)
    await expect(validateFieldRules(
      ' ready ',
      z.string().transform(value => value.trim()),
      { enabled: true },
      validator,
      values => values.enabled === true,
    )).resolves.toEqual(['Custom'])
    expect(validator).toHaveBeenCalledWith('ready', { enabled: true })
    await expect(validateFieldRules(1, z.string(), {})).resolves.toEqual(['Expected string, received number'])
    await expect(validateFieldRules('value', undefined, {}, () => 'Invalid')).resolves.toEqual(['Invalid'])
  })

  it('filters form validation by visibility, disabled state, and trigger', async () => {
    const values = {
      change: '',
      disabled: '',
      forcedDisabled: '',
      forcedHidden: '',
      hidden: '',
      plain: '',
    }
    const fields: FieldConfig[] = [
      { component: 'input', field: 'plain' },
      { component: 'input', field: 'hidden', required: true, visible: false },
      { component: 'input', field: 'disabled', disabled: true, required: true },
      { component: 'input', field: 'forcedHidden', required: true, submitWhenHidden: true, visible: false },
      { component: 'input', field: 'forcedDisabled', disabled: true, required: true, submitWhenDisabled: true },
      { component: 'input', field: 'change', required: true, validateOn: 'change' },
    ]

    await expect(validateForm(values, fields)).resolves.toEqual({
      change: ['必填'],
      forcedDisabled: ['必填'],
      forcedHidden: ['必填'],
    })
    await expect(validateForm(values, fields, 'change')).resolves.toEqual({ change: ['必填'] })
    await expect(validateForm({ change: 'ok' }, [fields.at(-1)!], 'change')).resolves.toEqual({})
  })

  it('wraps functional Vue components without forwarding wrapper props', () => {
    const Functional = (props: { label?: string }) => h('button', props.label)
    Functional.displayName = 'FixtureFunctional'
    const adapted = asVueFunctionalComponent(Functional)
    const wrapper = mount(adapted, { attrs: { label: 'Run' } })

    expect((adapted as { name?: string }).name).toBe('FixtureFunctional')
    expect(wrapper.get('button').text()).toBe('Run')

    const NamedFunctional = function NamedFunctional() {
      return h('span')
    }
    expect((asVueFunctionalComponent(NamedFunctional) as { name?: string }).name).toBe(NamedFunctional.name)
    Object.defineProperty(NamedFunctional, 'name', { value: '' })
    expect((asVueFunctionalComponent(NamedFunctional) as { name?: string }).name).toBe('ConfigFormFunctionalComponent')
  })
})
