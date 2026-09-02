export interface ConfigFormNamedModule<TValue> {
  name: string
  value: TValue
  order?: number
}

export type ConfigFormNamedModuleImport<TValue>
  = | ConfigFormNamedModule<TValue>
    | { default: ConfigFormNamedModule<TValue> }

export type ConfigFormNamedModuleMap<TValue> = Record<string, ConfigFormNamedModuleImport<TValue>>

export interface ConfigFormNamedRegistryEntry<TValue> extends ConfigFormNamedModule<TValue> {
  source: string
}

export interface ConfigFormNamedModuleRegistry<TValue> {
  get: (name: string) => TValue | undefined
  list: () => ConfigFormNamedRegistryEntry<TValue>[]
  toRecord: () => Record<string, TValue>
}
