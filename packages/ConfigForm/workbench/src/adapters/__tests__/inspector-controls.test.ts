import { describe, expect, it } from 'vitest'
import { loadWorkbenchAdapter } from '..'

const inspectorComponents = ['text', 'textarea', 'number', 'boolean', 'segmented'] as const
const inspectorControls = ['defaultValue', 'text', 'textarea', 'number', 'boolean', 'select'] as const

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
  }, 30_000)

  it('maps dataset row and item activations for both Experience and Source', async () => {
    const adapters = await Promise.all([
      ['antd-vue', await loadWorkbenchAdapter('antd-vue')],
      ['element-plus', await loadWorkbenchAdapter('element-plus')],
    ] as const)

    for (const [id, adapter] of adapters) {
      for (const [material, trigger, event] of [
        ['table', 'rowActivate', 'row-click'],
        ['list', 'itemActivate', 'item-click'],
      ] as const) {
        const componentKey = `${id === 'antd-vue' ? 'antd' : 'element'}.${material}`
        const contract = adapter.registrySnapshot.components.find(candidate => candidate.key === componentKey)
        expect(contract).toBeDefined()
        const source = adapter.sourceComponentResolver.resolveComponent({
          componentKey,
          contractFingerprint: contract!.fingerprint,
          contractVersion: contract!.contractVersion,
        })
        expect(source).toMatchObject({
          success: true,
          value: {
            semanticListeners: {
              [trigger]: { event, item: { kind: 'argument', index: 0 } },
            },
          },
        })
        expect(adapter.runtimeResolver.resolveBinding(componentKey)?.semanticEvents).toMatchObject({
          [trigger]: event,
        })
      }
    }
  }, 30_000)
})
