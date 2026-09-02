import type { ComponentContract, PageNode } from '@moluoxixi/config-form-model'
import type {
  DesignerMaterialDefinition,
  DesignerPropertySetterDefinition,
} from '../../registry'

export type InspectorSectionId
  = | 'properties'
    | 'validation'
    | 'events'
    | 'bindings'
    | 'conditions'
    | 'reactions'

export interface InspectorNodeCapabilityInput {
  node: PageNode
  material?: DesignerMaterialDefinition
  contract?: ComponentContract
}

export interface InspectorSectionProjection {
  id: InspectorSectionId
  canCreate: boolean
  editable: boolean
  hasStoredContent: boolean
}

export type InspectorStaleConfigKind
  = | 'binding-unknown'
    | 'condition-inapplicable'
    | 'event-unknown'
    | 'selection-incompatible'
    | 'validation-incompatible'

export interface InspectorStaleConfigRemoval {
  kind: 'delete-path'
  path: string[]
}

export interface InspectorStaleConfigItem {
  kind: InspectorStaleConfigKind
  section: Exclude<InspectorSectionId, 'properties'>
  nodeId: string
  nodeComponent: string
  key: string
  path: string[]
  reason: 'metadata-missing' | 'not-applicable' | 'not-declared' | 'selection-incompatible'
  removal: InspectorStaleConfigRemoval | null
  value: unknown
}

export interface InspectorProjection {
  sections: InspectorSectionProjection[]
  commonSetters: DesignerPropertySetterDefinition[]
  commonEvents: ComponentContract['events']
  commonBindings: ComponentContract['bindings']
  commonConditionTargets: Array<'visible' | 'hidden' | 'required' | 'disabled' | 'readonly'>
  staleItems: InspectorStaleConfigItem[]
}

export interface InspectorGridFraction {
  columns: number
  fraction: string
  label: string
  span: number
}
