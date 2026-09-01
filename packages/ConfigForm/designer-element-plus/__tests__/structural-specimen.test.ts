// @vitest-environment happy-dom

import { DesignerMaterialSpecimen, DesignerPalette } from '@moluoxixi/config-form-designer'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { createElementPlusDesignerRegistry } from '../index'

describe('element plus structural material specimens', () => {
  it('keeps the palette presentation limited to registry icons and names', async () => {
    const registry = createElementPlusDesignerRegistry()
    const materials = registry.listMaterials()
    const wrapper = mount(DesignerPalette, {
      props: { materials, registry },
    })

    await nextTick()

    expect(wrapper.findAll('[data-material-row-key]')).toHaveLength(materials.length)
    for (const material of materials) {
      const row = wrapper.get(`[data-material-row-key="${material.key}"]`)
      expect(row.get('.mx-config-form-designer__palette-item-name').text()).toBe(material.title)
      expect(row.find('[data-specimen-node-id]').exists()).toBe(false)
      expect(row.find('.mx-config-form-designer__palette-item-preview').exists()).toBe(false)
    }
  })

  it.each([
    ['element.tab-pane', '.el-tabs'],
    ['element.collapse-item', '.el-collapse'],
  ])('renders %s inside its required real parent', async (materialKey, parentSelector) => {
    const registry = createElementPlusDesignerRegistry()
    const material = registry.getMaterial(materialKey)!
    const wrapper = mount(DesignerMaterialSpecimen, {
      props: { material, registry },
    })

    await nextTick()

    expect(wrapper.find(parentSelector).exists()).toBe(true)
    expect(wrapper.find(`[data-specimen-node-id="specimen-${materialKey.replace(/\W+/g, '-')}"]`).exists()).toBe(true)
  })
})
