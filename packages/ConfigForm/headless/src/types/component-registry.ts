import type {
  ConfigFormNamedModule,
  ConfigFormNamedModuleMap,
} from '@moluoxixi/config-form-core'
import type { Component } from 'vue'
import type {
  ConfigFormComponentRegistration,
  ConfigFormComponentRegistry,
} from './props'

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
