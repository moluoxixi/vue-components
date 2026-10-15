import type { SourceProjectPreset } from '@moluoxixi/config-form-source/generator'
import type { StudioCatalog, StudioPresetId } from '../types'
import { createComponentContractRegistry, createRegistryContractSnapshot } from '@moluoxixi/config-form-model'
import antd from '../constants/antd-vue.json'
import element from '../constants/element-plus.json'

const catalogs = { 'element-plus': element, 'antd-vue': antd } as unknown as Record<StudioPresetId, StudioCatalog>
export function getStudioCatalog(preset: StudioPresetId): StudioCatalog {
  const catalog = catalogs[preset]
  if (!catalog)
    throw new TypeError(`Unknown Studio preset: ${preset}`)
  return structuredClone(catalog)
}
/** Built from the same material declarations used by the visual designer. */
export function getStudioPreset(preset: StudioPresetId): SourceProjectPreset {
  const catalog = getStudioCatalog(preset)
  const componentRegistry = createComponentContractRegistry(catalog.materials.map(material => material.contract), { adapter: preset, version: '1' })
  const registry = createRegistryContractSnapshot(componentRegistry)
  const materials = new Map(catalog.materials.map(material => [material.contract.key, material]))
  return {
    registry,
    componentResolver: {
      adapter: { adapter: registry.adapter, adapterVersion: registry.adapterVersion, registryFingerprint: registry.fingerprint },
      resolveComponent(request) {
        const material = materials.get(request.componentKey)
        const contract = registry.components.find(component => component.key === request.componentKey)
        if (!material || !contract)
          return { success: false, reason: `Unknown component: ${request.componentKey}` }
        if (request.contractVersion !== contract.contractVersion || request.contractFingerprint !== contract.fingerprint)
          return { success: false, reason: `Locked component contract changed: ${request.componentKey}` }
        return { success: true, value: structuredClone(material.resolution) }
      },
    },
  }
}
