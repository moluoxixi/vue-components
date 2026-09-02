import type { ConfigFormComponentRegistry } from '@moluoxixi/config-form'
import type {
  ConfigFormComponentMaterial,
  ConfigFormComponentMaterialRegistry,
} from '@moluoxixi/config-form-headless'
import type { Component } from 'vue'
import { createConfigFormComponentMaterialRegistry } from '@moluoxixi/config-form-headless'

const materialModules = import.meta.glob<ConfigFormComponentMaterial<Component>>(
  ['../materials/*.ts', '!../materials/index.ts'],
  { eager: true, import: 'default' },
)

export const ELEMENT_CONFIG_FORM_MATERIAL_REGISTRY: ConfigFormComponentMaterialRegistry<Component>
  = createConfigFormComponentMaterialRegistry(materialModules)

/** Element Plus semantic component Registry. Caller registrations take precedence. */
export const ELEMENT_CONFIG_FORM_COMPONENTS: ConfigFormComponentRegistry
  = ELEMENT_CONFIG_FORM_MATERIAL_REGISTRY.toRecord()
