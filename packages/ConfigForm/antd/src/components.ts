import type {
  ConfigFormComponentMaterial,
  ConfigFormComponentMaterialRegistry,
} from '@moluoxixi/config-form-headless'
import type { ConfigFormComponentRegistry } from '@moluoxixi/config-form/renderer'
import type { Component } from 'vue'
import { createConfigFormComponentMaterialRegistry } from '@moluoxixi/config-form-headless'

const materialModules = import.meta.glob<ConfigFormComponentMaterial<Component>>(
  './materials/*.ts',
  { eager: true, import: 'default' },
)

export const ANTD_CONFIG_FORM_MATERIAL_REGISTRY: ConfigFormComponentMaterialRegistry<Component>
  = createConfigFormComponentMaterialRegistry(materialModules)

/** Ant Design Vue 语义组件别名；调用方注册的同名 key 可以覆盖默认组件。 */
export const ANTD_CONFIG_FORM_COMPONENTS: ConfigFormComponentRegistry
  = ANTD_CONFIG_FORM_MATERIAL_REGISTRY.toRecord()
