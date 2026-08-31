import type {
  ConfigFormNamedModule,
  ConfigFormNamedModuleMap,
  ConfigFormNamedModuleRegistry,
} from '@moluoxixi/config-form-core'
import type { DesignerMaterialLocale } from '../locale'
import type { DesignerMaterialDefinition } from './types'
import {
  createConfigFormModuleRegistry,
  defineConfigFormModule,
} from '@moluoxixi/config-form-core'
import { DesignerRegistryError } from '../graph'

export interface DesignerMaterialModuleValue {
  material: DesignerMaterialDefinition
  locale?: DesignerMaterialLocale
}

export type DesignerMaterialModule = ConfigFormNamedModule<DesignerMaterialModuleValue>
export type DesignerMaterialModuleMap = ConfigFormNamedModuleMap<DesignerMaterialModuleValue>

export interface DesignerMaterialModuleRegistry {
  modules: ConfigFormNamedModuleRegistry<DesignerMaterialModuleValue>
  materials: DesignerMaterialDefinition[]
  locales: Record<string, DesignerMaterialLocale>
}

export function defineDesignerMaterialModule(
  module: DesignerMaterialModule,
): DesignerMaterialModule {
  return defineConfigFormModule(module)
}

export function createDesignerMaterialModuleRegistry(
  modules: DesignerMaterialModuleMap,
): DesignerMaterialModuleRegistry {
  const registry = createConfigFormModuleRegistry(modules)
  const entries = registry.list()

  for (const entry of entries) {
    const material = entry.value?.material
    if (!material || typeof material !== 'object' || typeof material.key !== 'string') {
      throw new DesignerRegistryError(
        'DESIGNER_MATERIAL_MODULE_INVALID',
        `Designer material module ${entry.name} must provide a material definition`,
        { moduleName: entry.name, source: entry.source },
      )
    }

    const materialName = material.key.split('.').at(-1)
    if (materialName !== entry.name) {
      throw new DesignerRegistryError(
        'DESIGNER_MATERIAL_MODULE_KEY_MISMATCH',
        `Designer material key ${entry.value.material.key} does not match module ${entry.name}`,
        {
          key: material.key,
          moduleName: entry.name,
          source: entry.source,
        },
      )
    }
  }

  return {
    modules: registry,
    materials: entries.map(entry => entry.value.material),
    locales: Object.fromEntries(entries.flatMap(entry => (
      entry.value.locale ? [[entry.value.material.key, entry.value.locale]] : []
    ))),
  }
}
