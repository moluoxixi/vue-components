import type { ComponentContract, PageNode } from '@moluoxixi/config-form-model'
import type { DesignerMaterialDefinition, DesignerPropertySetterDefinition } from '../src/registry'
import { describe, expect, it } from 'vitest'
import { resolveInspectorCapabilities } from '../src/inspector'

function field(
  id: string,
  component: string,
  values: Partial<Extract<PageNode, { kind: 'field' }>> = {},
): Extract<PageNode, { kind: 'field' }> {
  return {
    id,
    component,
    kind: 'field',
    field: id,
    props: {},
    events: {},
    bindings: {},
    ...values,
  } as Extract<PageNode, { kind: 'field' }>
}

function layout(
  id: string,
  component: string,
  values: Partial<Extract<PageNode, { kind: 'layout' }>> = {},
): Extract<PageNode, { kind: 'layout' }> {
  return {
    id,
    component,
    kind: 'layout',
    props: {},
    events: {},
    bindings: {},
    slots: { default: [] },
    ...values,
  } as Extract<PageNode, { kind: 'layout' }>
}

function contract(
  key: string,
  kind: PageNode['kind'],
  values: Partial<ComponentContract> = {},
): ComponentContract {
  return {
    key,
    version: '1',
    kind,
    props: [],
    events: [],
    bindings: [],
    slots: [],
    allowedParents: [],
    defaults: {},
    ...values,
  }
}

function material(
  key: string,
  setters: DesignerPropertySetterDefinition[],
): DesignerMaterialDefinition {
  return {
    key,
    version: 1,
    kind: 'field',
    title: key,
    category: 'Fields',
    runtime: { component: 'input' },
    setters,
    createNode: ({ id }) => ({ id, field: id, kind: 'field', component: key }),
  }
}

describe('resolveInspectorCapabilities', () => {
  it('combines declared capabilities with stored content without hiding unknown values', () => {
    const node = field('name', 'test.input', {
      events: {
        change: [{ action: 'save' }],
        legacy: [{ action: 'legacy', args: { nested: true } }],
      },
      bindings: {
        value: { source: 'profile.name' },
        legacyValue: { source: 'legacy.name' },
      },
      conditions: { required: { kind: 'literal', value: true } },
      reactions: [{ id: 'reaction-1', enabled: true, when: { kind: 'literal', value: true }, then: [] }],
      validation: { version: 1, base: { type: 'string' }, rules: [] },
    })
    const projection = resolveInspectorCapabilities([{
      node,
      material: material('test.input', []),
      contract: contract('test.input', 'field', {
        events: [{ name: 'change' }],
        bindings: [{ name: 'value', valueProp: 'modelValue', trigger: 'update:modelValue' }],
      }),
    }])

    expect(projection.sections.map(section => section.id)).toEqual([
      'properties',
      'validation',
      'events',
      'bindings',
      'conditions',
      'reactions',
    ])
    expect(projection.commonEvents.map(event => event.name)).toEqual(['change'])
    expect(projection.commonBindings.map(binding => binding.name)).toEqual(['value'])
    expect(projection.sections.every(section => section.editable)).toBe(true)
    expect(projection.staleItems).toMatchObject([
      { kind: 'event-unknown', nodeId: 'name', key: 'legacy', path: ['events', 'legacy'] },
      { kind: 'binding-unknown', nodeId: 'name', key: 'legacyValue', path: ['bindings', 'legacyValue'] },
    ])
    expect(projection.staleItems[0]?.value).toEqual([{ action: 'legacy', args: { nested: true } }])
    expect(projection.staleItems[0]?.removal).toEqual({
      kind: 'delete-path',
      path: ['events', 'legacy'],
    })
  })

  it('uses safe intersections for heterogeneous multi-selection and stored-data unions for visibility', () => {
    const placeholder = { key: 'placeholder', label: 'Placeholder', path: ['props', 'placeholder'], control: 'text' as const }
    const first = field('first', 'test.first', {
      events: { blur: [{ action: 'touch' }] },
    })
    const second = field('second', 'test.second', {
      reactions: [{ id: 'sync', enabled: true, when: { kind: 'literal', value: true }, then: [] }],
    })
    const projection = resolveInspectorCapabilities([
      {
        node: first,
        material: material('test.first', [
          placeholder,
          { key: 'disabled', label: 'Disabled', path: ['props', 'disabled'], control: 'boolean' },
        ]),
        contract: contract('test.first', 'field', {
          events: [{ name: 'change' }, { name: 'blur' }],
          bindings: [{ name: 'value', valueProp: 'modelValue', trigger: 'update:modelValue' }],
        }),
      },
      {
        node: second,
        material: material('test.second', [
          { ...placeholder, label: 'Hint' },
          {
            key: 'disabled',
            label: 'Disabled mode',
            path: ['props', 'disabled'],
            control: 'select',
            options: [{ label: 'No', value: false }, { label: 'Yes', value: true }],
          },
        ]),
        contract: contract('test.second', 'field', {
          events: [{ name: 'change' }],
          bindings: [{ name: 'value', valueProp: 'modelValue', trigger: 'update:modelValue' }],
        }),
      },
    ])

    expect(projection.commonSetters.map(setter => setter.key)).toEqual(['placeholder'])
    expect(projection.commonEvents.map(event => event.name)).toEqual(['change'])
    expect(projection.commonBindings.map(binding => binding.name)).toEqual(['value'])
    expect(projection.sections.map(section => section.id)).toEqual([
      'properties',
      'validation',
      'events',
      'bindings',
      'conditions',
      'reactions',
    ])
    expect(projection.sections.find(section => section.id === 'reactions')).toMatchObject({
      canCreate: false,
      editable: false,
      hasStoredContent: true,
    })
    expect(projection.staleItems).toMatchObject([
      { kind: 'selection-incompatible', nodeId: 'first', key: 'blur', section: 'events' },
      { kind: 'selection-incompatible', nodeId: 'second', key: 'sync', section: 'reactions' },
    ])
    expect(projection.staleItems.at(-1)?.removal).toBeNull()
  })

  it('keeps stored data visible when Registry metadata is missing and flags layout-only condition mismatches', () => {
    const node = layout('section', 'test.missing', {
      events: { removed: [{ action: 'audit' }] },
      bindings: { removed: { source: 'legacy' } },
      conditions: { required: { kind: 'literal', value: true } },
    })
    const projection = resolveInspectorCapabilities([{ node }])

    expect(projection.sections.map(section => section.id)).toEqual([
      'properties',
      'events',
      'bindings',
      'conditions',
      'reactions',
    ])
    expect(projection.commonSetters).toEqual([])
    expect(projection.sections.every(section => section.editable === false)).toBe(true)
    expect(projection.staleItems).toMatchObject([
      { kind: 'event-unknown', key: 'removed', reason: 'metadata-missing' },
      { kind: 'binding-unknown', key: 'removed', reason: 'metadata-missing' },
      { kind: 'condition-inapplicable', key: 'required', reason: 'not-applicable' },
    ])
    expect(projection.staleItems.every(item => item.removal === null)).toBe(true)
  })

  it('projects mixed validation values per node instead of presenting an empty shared editor', () => {
    const first = field('first', 'test.first', {
      validation: { version: 1, base: { type: 'string' }, rules: [{ kind: 'minLength', value: 2 }] },
      validateOn: 'blur',
    })
    const second = field('second', 'test.second', {
      validation: { version: 1, base: { type: 'string' }, rules: [{ kind: 'maxLength', value: 20 }] },
      validateOn: ['change', 'submit'],
    })
    const projection = resolveInspectorCapabilities([
      {
        node: first,
        material: material('test.first', []),
        contract: contract('test.first', 'field'),
      },
      {
        node: second,
        material: material('test.second', []),
        contract: contract('test.second', 'field'),
      },
    ])

    expect(projection.sections.find(section => section.id === 'validation')).toMatchObject({
      canCreate: true,
      editable: false,
      hasStoredContent: true,
    })
    expect(projection.staleItems.filter(item => item.section === 'validation')).toMatchObject([
      { nodeId: 'first', key: 'validation', value: first.validation, removal: { path: ['validation'] } },
      { nodeId: 'first', key: 'validateOn', value: 'blur', removal: { path: ['validateOn'] } },
      { nodeId: 'second', key: 'validation', value: second.validation, removal: { path: ['validation'] } },
      { nodeId: 'second', key: 'validateOn', value: ['change', 'submit'], removal: { path: ['validateOn'] } },
    ])
  })

  it.each([
    {
      name: 'missing contract',
      input: {
        node: field('name', 'test.input'),
        material: material('test.input', [
          { key: 'placeholder', label: 'Placeholder', path: ['props', 'placeholder'], control: 'text' },
        ]),
      },
    },
    {
      name: 'missing material',
      input: {
        node: field('name', 'test.input'),
        contract: contract('test.input', 'field', { events: [{ name: 'change' }] }),
      },
    },
    {
      name: 'kind mismatch',
      input: {
        node: field('name', 'test.input'),
        material: material('test.input', []),
        contract: contract('test.input', 'layout'),
      },
    },
    {
      name: 'component mismatch',
      input: {
        node: field('name', 'test.input'),
        material: material('test.other', []),
        contract: contract('test.other', 'field'),
      },
    },
  ])('keeps $name selections conservatively read-only', ({ input }) => {
    const projection = resolveInspectorCapabilities([input])

    expect(projection.sections.find(section => section.id === 'properties')).toMatchObject({
      canCreate: true,
      editable: false,
    })
    expect(projection.sections.find(section => section.id === 'validation')).toMatchObject({
      canCreate: true,
      editable: false,
    })
    expect(projection.sections.find(section => section.id === 'conditions')).toMatchObject({
      canCreate: true,
      editable: false,
    })
    expect(projection.sections.find(section => section.id === 'reactions')).toMatchObject({
      canCreate: true,
      editable: false,
    })
    expect(projection.commonSetters).toEqual([])
    expect(projection.sections.every(section => section.editable === false)).toBe(true)
    if (input.contract?.events.length) {
      expect(projection.sections.find(section => section.id === 'events')).toMatchObject({
        canCreate: true,
        editable: false,
      })
    }
  })

  it('requires binding valueProp and trigger compatibility in the common capability', () => {
    const first = field('first', 'test.first')
    const second = field('second', 'test.second', { bindings: { value: { source: 'state.value' } } })
    const projection = resolveInspectorCapabilities([
      {
        node: first,
        contract: contract('test.first', 'field', {
          bindings: [{ name: 'value', valueProp: 'modelValue', trigger: 'update:modelValue' }],
        }),
      },
      {
        node: second,
        contract: contract('test.second', 'field', {
          bindings: [{ name: 'value', valueProp: 'checked', trigger: 'change' }],
        }),
      },
    ])

    expect(projection.commonBindings).toEqual([])
    expect(projection.staleItems).toMatchObject([
      { kind: 'selection-incompatible', nodeId: 'second', key: 'value', section: 'bindings' },
    ])
  })

  it('requires option labels as well as values to match across common setters', () => {
    const projection = resolveInspectorCapabilities([
      {
        node: field('first', 'test.first'),
        material: material('test.first', [{
          key: 'mode',
          label: 'Mode',
          path: ['props', 'mode'],
          control: 'select',
          options: [{ label: 'Automatic', value: 'auto' }],
        }]),
        contract: contract('test.first', 'field'),
      },
      {
        node: field('second', 'test.second'),
        material: material('test.second', [{
          key: 'mode',
          label: 'Mode',
          path: ['props', 'mode'],
          control: 'select',
          options: [{ label: 'Inherited', value: 'auto' }],
        }]),
        contract: contract('test.second', 'field'),
      },
    ])

    expect(projection.commonSetters).toEqual([])
  })
})
