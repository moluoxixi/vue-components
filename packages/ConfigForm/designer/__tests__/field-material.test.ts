import { pageGraphSchema } from '@moluoxixi/config-form-model'
import { describe, expect, it } from 'vitest'
import {
  createDesignerRegistry,
  defineDesignerFieldMaterial,
} from '../src'

describe('designer field material', () => {
  it('derives a field node, runtime binding, and ordered setters from one declaration', () => {
    const material = defineDesignerFieldMaterial({
      key: 'project.input',
      title: 'Project input',
      category: 'Fields',
      component: 'input',
      defaultProps: { autocomplete: 'off' },
      runtime: {
        readonlyProp: 'readonly',
        trigger: 'change',
        valueProp: 'value',
      },
      value: { kind: 'text', default: 'Initial value' },
      props: {
        placeholder: { label: 'Placeholder', control: 'text', default: 'Enter a value' },
        clearable: { label: 'Clearable', control: 'boolean', default: true },
        maxlength: { label: 'Max length', control: 'number', integer: true, min: 0, max: 200, step: 1 },
        size: {
          label: 'Size',
          control: 'select',
          default: 'default',
          options: [
            { label: 'Large', value: 'large' },
            { label: 'Default', value: 'default' },
          ],
        },
      },
      setters: [{ key: 'advanced', label: 'Advanced', path: ['extensions', 'advanced'], control: 'text' }],
    })

    expect(material).toMatchObject({
      key: 'project.input',
      version: 1,
      kind: 'field',
      runtime: {
        component: 'input',
        readonlyProp: 'readonly',
        trigger: 'change',
        valueProp: 'value',
      },
    })
    expect(material.setters.map(setter => [setter.key, setter.path, setter.control])).toEqual([
      ['defaultValue', ['defaultValue'], 'defaultValue'],
      ['placeholder', ['props', 'placeholder'], 'text'],
      ['clearable', ['props', 'clearable'], 'boolean'],
      ['maxlength', ['props', 'maxlength'], 'number'],
      ['size', ['props', 'size'], 'select'],
      ['advanced', ['extensions', 'advanced'], 'text'],
    ])
    expect(material.setters[3]).toMatchObject({ integer: true, min: 0, max: 200, step: 1 })

    const node = material.createNode({ id: 'node-1', field: 'customer_name' })
    expect(node).toEqual({
      id: 'node-1',
      kind: 'field',
      component: 'project.input',
      field: 'customer_name',
      label: 'Project input',
      defaultValue: 'Initial value',
      props: {
        autocomplete: 'off',
        placeholder: 'Enter a value',
        clearable: true,
        size: 'default',
      },
    })
  })

  it('infers defaults and deep-clones JSON values for every created node', () => {
    const defaultProps = { metadata: { roles: ['admin'] } }
    const defaultValue = ['admin']
    const material = defineDesignerFieldMaterial({
      key: 'project.profile-data',
      title: 'Profile data',
      category: 'Fields',
      component: 'textarea',
      defaultLabel: 'Profile',
      defaultProps,
      value: { kind: 'multiselect', default: defaultValue },
    })
    defaultProps.metadata.roles.push('owner')
    defaultValue.push('owner')
    const first = material.createNode({ id: 'first' })
    const second = material.createNode({ id: 'second' })

    expect(first).toMatchObject({ field: 'profile_data', label: 'Profile' })
    ;(first.props!.metadata as { roles: string[] }).roles.push('editor')
    ;(first.defaultValue as string[]).push('editor')
    expect(second.props).toEqual({ metadata: { roles: ['admin'] } })
    expect(second.defaultValue).toEqual(['admin'])

    const registry = createDesignerRegistry({ materials: [material] })
    const subgraph = registry.createSubgraph(material.key, { id: 'registered', field: 'profile' })
    expect(() => pageGraphSchema.parse({
      version: 2,
      props: {},
      form: {},
      root: subgraph.root,
      nodesById: subgraph.nodesById,
    })).not.toThrow()
  })

  it('prioritizes direct materials above advanced layers and rejects duplicates', () => {
    const direct = defineDesignerFieldMaterial({
      key: 'project.input',
      title: 'Direct input',
      category: 'Fields',
      component: 'input',
    })
    const layered = { ...direct, title: 'Layered input' }
    const registry = createDesignerRegistry({
      materials: [direct],
      layers: [{ name: 'advanced', materials: [layered] }],
    })

    expect(registry.getMaterial(direct.key)?.title).toBe('Direct input')
    expect(() => createDesignerRegistry({ materials: [direct, direct] }))
      .toThrow(/Duplicate designer material in materials/)
  })
})
