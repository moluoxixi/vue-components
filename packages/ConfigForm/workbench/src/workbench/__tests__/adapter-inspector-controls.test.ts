import { describe, expect, it } from 'vitest'
import { loadWorkbenchAdapter } from '../../adapters'

const inspectorComponents = ['text', 'textarea', 'number', 'boolean', 'segmented'] as const
const inspectorControls = ['text', 'textarea', 'number', 'boolean', 'select'] as const

describe('workbench adapter inspector controls', () => {
  it('uses one Element Plus inspector control set without replacing provider materials', async () => {
    const [antd, element] = await Promise.all([
      loadWorkbenchAdapter('antd-vue'),
      loadWorkbenchAdapter('element-plus'),
    ])

    for (const name of inspectorComponents) {
      expect(antd.designerRegistry.components[name]).toBe(element.designerRegistry.components[name])
    }
    for (const control of inspectorControls) {
      expect(antd.designerRegistry.propertyControls[control]).toEqual(
        element.designerRegistry.propertyControls[control],
      )
    }

    expect(antd.registrySnapshot.adapter).toBe('antd-vue')
    expect(element.registrySnapshot.adapter).toBe('element-plus')
    expect(antd.designerRegistry.listMaterials().every(material => material.key.startsWith('antd.'))).toBe(true)
    expect(element.designerRegistry.listMaterials().every(material => material.key.startsWith('element.'))).toBe(true)
  }, 15_000)
})
