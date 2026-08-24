import type {
  ConfigFormNamedModule,
  ConfigFormNamedModuleMap,
} from '@moluoxixi/config-form-core'
import type { Component } from 'vue'
import type {
  ConfigFormComponentRegistration,
  ConfigFormComponentRegistry,
} from './types/props'
import {
  createConfigFormModuleRegistry,
  defineConfigFormModule,
} from '@moluoxixi/config-form-core'

export type ConfigFormComponentMaterial<TComponent = Component> = ConfigFormNamedModule<
  TComponent | ConfigFormComponentRegistration<TComponent>
>

export type ConfigFormComponentMaterialMap<TComponent = Component> = ConfigFormNamedModuleMap<
  TComponent | ConfigFormComponentRegistration<TComponent>
>

export interface ConfigFormComponentMaterialRegistryEntry<TComponent = Component>
  extends ConfigFormComponentMaterial<TComponent> {
  source: string
}

export interface ConfigFormComponentMaterialRegistry<TComponent = Component> {
  get: (name: string) => TComponent | ConfigFormComponentRegistration<TComponent> | undefined
  list: () => ConfigFormComponentMaterialRegistryEntry<TComponent>[]
  toRecord: () => ConfigFormComponentRegistry<TComponent>
}

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
