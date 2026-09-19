import type { ComponentContract, SurfaceNode } from '@moluoxixi/config-form-model'
import type {
  DesignerMaterialDefinition,
  DesignerPropertySetterDefinition,
} from '../../registry'

export type InspectorSectionId
  = | 'properties'
    | 'validation'

export interface InspectorNodeCapabilityInput {
  node: SurfaceNode
  material?: DesignerMaterialDefinition
  contract?: ComponentContract
}

export interface InspectorSectionProjection {
  id: InspectorSectionId
  canCreate: boolean
  editable: boolean
  hasStoredContent: boolean
}

export interface InspectorProjection {
  sections: InspectorSectionProjection[]
  commonSetters: DesignerPropertySetterDefinition[]
}

export interface InspectorGridFraction {
  columns: number
  fraction: string
  label: string
  span: number
}
