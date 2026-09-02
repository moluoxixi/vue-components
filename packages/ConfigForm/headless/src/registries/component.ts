import type { Component } from 'vue'
import type {
  ConfigFormComponentMaterial,
  ConfigFormComponentMaterialMap,
  ConfigFormComponentMaterialRegistry,
  ConfigFormComponentRegistry,
} from '../types'
import {
  createConfigFormModuleRegistry,
  defineConfigFormModule,
} from '@moluoxixi/config-form-core'

export function defineConfigFormComponentMaterial<TComponent = Component>(
  material: ConfigFormComponentMaterial<TComponent>,
): ConfigFormComponentMaterial<TComponent> {
  return defineConfigFormModule(material)
}

export function createConfigFormComponentMaterialRegistry<TComponent = Component>(
  modules: ConfigFormComponentMaterialMap<TComponent>,
): ConfigFormComponentMaterialRegistry<TComponent> {
  return createConfigFormModuleRegistry(modules)
}

export function createConfigFormComponentRegistry<TComponent = Component>(
  modules: ConfigFormComponentMaterialMap<TComponent>,
): ConfigFormComponentRegistry<TComponent> {
  return createConfigFormComponentMaterialRegistry(modules).toRecord()
}
