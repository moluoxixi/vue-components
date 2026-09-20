import type { ComponentContract, SurfaceNode } from '@moluoxixi/config-form-model'
import type { DesignerMaterialDefinition, DesignerPropertySetterDefinition } from '../src/registry'
import { describe, expect, it } from 'vitest'
import { resolveInspectorCapabilities } from '../src/inspector'

function field(
  id: string,
  component: string,
  values: Partial<Extract<SurfaceNode, { kind: 'field' }>> = {},
): Extract<SurfaceNode, { kind: 'field' }> {
  return {
    id,
    component,
    kind: 'field',
    field: id,
    props: {},
    ...values,
  }
}

function layout(id: string, component: string): Extract<SurfaceNode, { kind: 'layout' }> {
  return {
    id,
    component,
    kind: 'layout',
    props: {},
    slots: { default: [] },
  }
}

function contract(key: string, kind: SurfaceNode['kind']): ComponentContract {
  return {
    key,
    version: '1',
    kind,
    props: [],
    bindings: [],
    semanticTriggers: kind === 'field' ? ['activate'] : [],
    stateProjectionProperties: [],
    datasetBindings: [],
    resourceBindings: [],
    slots: kind === 'layout' ? [{ name: 'default' }] : [],
    allowedParents: [],
    defaults: {},
  }
}

function material(
  key: string,
  setters: DesignerPropertySetterDefinition[],
  kind: SurfaceNode['kind'] = 'field',
): DesignerMaterialDefinition {
  if (kind === 'layout') {
    return {
      key,
      version: 1,
      kind,
      title: key,
      category: 'Layout',
      runtime: { component: 'section' },
      setters,
      slots: [{ name: 'default', title: 'Content' }],
      createNode: ({ id }) => ({ id, kind, component: key, slots: { default: [] } }),
    }
  }
  if (kind === 'element') {
    return {
      key,
      version: 1,
      kind,
      title: key,
      category: 'Elements',
      runtime: { component: 'div' },
      setters,
      createNode: ({ id }) => ({ id, kind: 'element', component: key, props: {} }),
    }
  }
  return {
    key,
    version: 1,
    kind,
    title: key,
    category: 'Fields',
    runtime: { component: 'input' },
    setters,
    createNode: ({ id }) => ({ id, field: id, kind, component: key }),
  }
}

describe('resolveInspectorCapabilities', () => {
  it('always exposes exactly properties and validation without projecting advanced runtime configuration', () => {
    const node = field('name', 'test.input', {
      datasetBindings: {},
      validation: { version: 2, base: { type: 'string' }, rules: [] },
      validateOn: 'blur',
    })
    const original = structuredClone(node)
    const projection = resolveInspectorCapabilities([{
      node,
      material: material('test.input', []),
      contract: contract('test.input', 'field'),
    }])

    expect(projection.sections).toEqual([
      { id: 'properties', canCreate: true, editable: true, hasStoredContent: true },
      { id: 'validation', canCreate: true, editable: true, hasStoredContent: true },
    ])
    expect(projection).not.toHaveProperty('commonEvents')
    expect(projection).not.toHaveProperty('commonBindings')
    expect(projection).not.toHaveProperty('staleItems')
    expect(node).toEqual(original)
  })

  it('intersects compatible setters and filters every path outside the lite Designer boundary', () => {
    const placeholder: DesignerPropertySetterDefinition = {
      key: 'placeholder',
      label: 'Placeholder',
      path: ['props', 'placeholder'],
      control: 'text',
    }
    const projection = resolveInspectorCapabilities([
      {
        node: field('first', 'test.first'),
        material: material('test.first', [
          placeholder,
          { key: 'condition', label: 'Condition', path: ['conditions', 'required'], control: 'custom' },
          { key: 'dynamicOptions', label: 'Dynamic options', path: ['props', 'optionSource'], control: 'custom' },
        ]),
        contract: contract('test.first', 'field'),
      },
      {
        node: field('second', 'test.second'),
        material: material('test.second', [
          { ...placeholder, label: 'Hint' },
          { key: 'condition', label: 'Condition', path: ['conditions', 'required'], control: 'custom' },
          { key: 'dynamicOptions', label: 'Dynamic options', path: ['props', 'optionSource'], control: 'custom' },
        ]),
        contract: contract('test.second', 'field'),
      },
    ])

    expect(projection.commonSetters.map(setter => setter.path)).toEqual([['props', 'placeholder']])
    expect(projection.sections.map(section => section.id)).toEqual(['properties', 'validation'])
  })

  it('keeps field-level validation editable for mixed rules without exposing a shared rule editor', () => {
    const first = field('first', 'test.first', {
      validation: { version: 2, base: { type: 'string' }, rules: [{ kind: 'minLength', value: 2 }] },
      validateOn: 'blur',
    })
    const second = field('second', 'test.second', {
      validation: { version: 2, base: { type: 'string' }, rules: [{ kind: 'maxLength', value: 20 }] },
      validateOn: ['change', 'submit'],
    })
    const projection = resolveInspectorCapabilities([
      { node: first, material: material('test.first', []), contract: contract('test.first', 'field') },
      { node: second, material: material('test.second', []), contract: contract('test.second', 'field') },
    ])

    expect(projection.sections.find(section => section.id === 'validation')).toEqual({
      id: 'validation',
      canCreate: true,
      editable: true,
      hasStoredContent: true,
    })
  })

  it.each([
    {
      name: 'missing contract',
      input: {
        node: field('name', 'test.input'),
        material: material('test.input', []),
      },
    },
    {
      name: 'missing material',
      input: {
        node: field('name', 'test.input'),
        contract: contract('test.input', 'field'),
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

    expect(projection.sections.map(section => section.id)).toEqual(['properties', 'validation'])
    expect(projection.sections.every(section => section.editable === false)).toBe(true)
    expect(projection.commonSetters).toEqual([])
  })

  it('keeps the validation section present but inapplicable for layouts', () => {
    const node = layout('section', 'test.section')
    const projection = resolveInspectorCapabilities([{
      node,
      material: material('test.section', [], 'layout'),
      contract: contract('test.section', 'layout'),
    }])

    expect(projection.sections).toEqual([
      { id: 'properties', canCreate: true, editable: true, hasStoredContent: true },
      { id: 'validation', canCreate: false, editable: false, hasStoredContent: false },
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
