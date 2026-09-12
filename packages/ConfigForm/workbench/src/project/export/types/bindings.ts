import type { ModelJsonObject, ModelJsonValue } from '@moluoxixi/config-form-model'

export interface CanonicalSourceLibraryBinding {
  packageName: string
  plugin: string
  stylesheet?: string
  version: string
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
  blurTrigger?: string
  trigger?: string
  valueProp?: string
}

/** Trusted host registration only; executable source is never stored in ProjectDocument. */
export interface CanonicalSourceActionBinding {
  exportName: string
  module:
    | { kind: 'package', specifier: string, packageName: string, version: string }
    | { kind: 'file', path: string, content: string }
  dependencies?: Record<string, string>
}

export interface CanonicalSourceBindingResolver {
  adapter: string
  adapterVersion: string
  registryFingerprint: string
  resolveBinding: (component: string) => CanonicalSourceComponentBinding | undefined
  resolveAction?: (ref: string) => CanonicalSourceActionBinding | undefined
}
