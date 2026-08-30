import type { ModelJsonObject, ModelJsonValue } from '@moluoxixi/config-form-model'

export interface CanonicalSourceLibraryBinding {
  packageName: string
  plugin: string
  stylesheet?: string
  version?: string
}

export interface CanonicalSourceOptionsBinding {
  mode: 'prop' | 'children'
  optionTag?: string
  labelProp?: string
  valueProp?: string
}

export type CanonicalSourceRenderKind
  = | 'component'
    | 'layout-flex'
    | 'layout-grid'
    | 'section'

export interface CanonicalSourceComponentBinding {
  component: string
  contractFingerprint: string
  contractVersion: string
  configComponent: string
  tag: string
  render: CanonicalSourceRenderKind
  defaultValue?: ModelJsonValue
  library?: CanonicalSourceLibraryBinding
  options?: CanonicalSourceOptionsBinding
  staticProps?: ModelJsonObject
  trigger?: string
  valueProp?: string
}

/** Immutable adapter boundary used only by source/config generators. */
export interface CanonicalSourceBindingResolver {
  adapter: string
  adapterVersion: string
  registryFingerprint: string
  resolveBinding: (component: string) => CanonicalSourceComponentBinding | undefined
}
