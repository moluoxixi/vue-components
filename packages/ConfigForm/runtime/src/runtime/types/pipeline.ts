import type { FormNodeConfig, ResolvedFormNode } from '../../types'
import type { FormFieldDefaultConfig } from './contracts'

export interface FieldPipelineContext {
  getFieldDefaults: (field: FormNodeConfig) => FormFieldDefaultConfig
  transformField: (field: FormNodeConfig) => ResolvedFormNode
}
