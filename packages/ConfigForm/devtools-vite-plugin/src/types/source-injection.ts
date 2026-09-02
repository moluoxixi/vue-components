import type { SourceMap } from 'magic-string'

export interface ConfigFormDevtoolsTransformResult {
  code: string
  map: SourceMap
}

export interface SourceInjectionOptions {
  code: string
  id: string
  adapterModuleId?: string
  packageNames?: string[]
}
