// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createDesignerDragController } from '../src/components/DesignerCanvas/services'
import DesignerPalette from '../src/components/DesignerPalette'
import { useDesignerPaletteDrag } from '../src/components/DesignerPalette/composables'
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

  it('cancels an active pointer material drag with Escape and swallows the release click', async () => {
    const onAddMaterial = vi.fn()
    const dragController = createDesignerDragController({
      commitMaterial: vi.fn(),
      commitNode: vi.fn(),
    })
    const cancel = vi.spyOn(dragController, 'cancel')
    const [material] = registry.listMaterials()
    const Harness = defineComponent({
      setup() {
        const drag = useDesignerPaletteDrag({
          dragController,
          materialTitle: () => material!.title,
          onAddMaterial,
          readonly: () => false,
        })
        return () => h('button', drag.getMaterialBindings(material!))
      },
    })
    const wrapper = mount(Harness, { attachTo: document.body })
    const command = wrapper.get('button')

    command.element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 31 }))
    cancel.mockClear()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(cancel).toHaveBeenCalledTimes(1)

    // The listener leaves with the session, so a second Escape is a no-op.
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(cancel).toHaveBeenCalledTimes(1)

    // Releasing the pointer right after Escape must not add the material.
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 31 }))
    await command.trigger('click')
    expect(onAddMaterial).not.toHaveBeenCalled()

    await new Promise(resolve => setTimeout(resolve, 0))
    await command.trigger('click')
    expect(onAddMaterial).toHaveBeenCalledWith('test.input')
    wrapper.unmount()
  })
})
