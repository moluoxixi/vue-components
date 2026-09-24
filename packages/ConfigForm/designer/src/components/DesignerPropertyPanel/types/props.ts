import type { ConfigFormComponentRegistry } from '@moluoxixi/config-form-headless'
import type {
  ComponentContract,
  DeepReadonly,
  ProjectDataset,
  ProjectResource,
  PrototypeInteraction,
  SurfaceGraph,
  SurfaceNode,
} from '@moluoxixi/config-form-model'
import type { Component } from 'vue'
import type { DesignerDiagnostic } from '../../../graph'
import type { DesignerMaterialDefinition, DesignerPropertyControlRegistry } from '../../../registry'
import type { ConfigFormBreakpoint } from '../../DesignerCanvas/types'
import type { DesignerInteractionSurfaceOption } from './domain'

export interface DesignerPropertyPanelProps {
  renderer: Component
  graph: SurfaceGraph
  node?: SurfaceNode
  nodes?: SurfaceNode[]
  material?: DesignerMaterialDefinition
  componentDefinition?: ComponentContract
  getMaterial?: (component: string) => DesignerMaterialDefinition | undefined
  getComponentDefinition?: (component: string) => ComponentContract | undefined
  diagnostics: DesignerDiagnostic[]
  datasets?: readonly DeepReadonly<ProjectDataset>[]
  breakpoint?: ConfigFormBreakpoint
  components?: ConfigFormComponentRegistry
  propertyControls?: DesignerPropertyControlRegistry
  resources?: readonly DeepReadonly<ProjectResource>[]
  interactions?: readonly PrototypeInteraction[]
  surfaceId?: string
  surfaces?: readonly DesignerInteractionSurfaceOption[]
  readonly?: boolean
}
