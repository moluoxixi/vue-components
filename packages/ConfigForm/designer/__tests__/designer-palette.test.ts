// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { h } from 'vue'
import DesignerPalette from '../src/components/DesignerPalette'
import { createDesignerRegistry } from '../src/registry'

const registry = createDesignerRegistry({ materials: [{
  key: 'test.input',
  version: 1,
  kind: 'field',
  category: 'Fields',
  title: 'A very long customer account identifier field',
  runtime: { component: 'input' },
  source: { configComponent: 'text', render: 'component', tag: 'input' },
  setters: [],
  createNode: ({ id, field = 'input' }) => ({ id, field, kind: 'field', component: 'test.input' }),
}] })

describe('designer palette presentation', () => {
  it('renders only a registry icon or fallback and the complete display name', () => {
    const [material] = registry.listMaterials()
    const wrapper = mount(DesignerPalette, {
      props: { materials: [material!], registry },
    })

    const row = wrapper.get('[data-material-row-key="test.input"]')
    expect(row.get('.mx-config-form-designer__palette-icon').text()).toBe('F')
    expect(row.get('.mx-config-form-designer__palette-item-name').text()).toBe(material!.title)
    expect(row.get('button').attributes('aria-label')).toBe(material!.title)
    expect(row.find('[data-specimen-node-id]').exists()).toBe(false)
    expect(row.find('input').exists()).toBe(false)
  })

  it('lets an embedding shell own the single material search input', () => {
    const wrapper = mount(DesignerPalette, {
      props: {
        materials: registry.listMaterials(),
        registry,
        showSearch: false,
      },
    })

    expect(wrapper.find('input[type="search"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-material-row-key]')).toHaveLength(1)
  })

  it('lets an embedding shell replace presentation without taking over material commands', async () => {
    const wrapper = mount(DesignerPalette, {
      props: {
        materials: registry.listMaterials(),
        registry,
        showSearch: false,
      },
      slots: {
        content: ({ getMaterialBindings, groups, materialTitle }) => h(
          'div',
          { 'data-custom-palette': '' },
          groups.flatMap(([category, materials]) => [
            h('h2', category),
            ...materials.map(material => h(
              'button',
              { ...getMaterialBindings(material), 'data-material-row-key': material.key, 'type': 'button' },
              materialTitle(material),
            )),
          ]),
        ),
      },
    })

    const command = wrapper.get('[data-custom-palette] [data-material-key="test.input"]')
    expect(command.attributes()).toMatchObject({
      'aria-label': 'A very long customer account identifier field',
      'aria-pressed': 'false',
      'data-designer-draggable': 'true',
      'data-material-kind': 'field',
      'data-material-row-key': 'test.input',
    })
    await command.trigger('click')
    await command.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('addMaterial')).toEqual([
      ['test.input'],
      ['test.input'],
    ])
  })
})
