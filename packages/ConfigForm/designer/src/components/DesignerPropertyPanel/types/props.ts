import type { ConfigFormBreakpoint } from '@moluoxixi/config-form'
import type { ConfigFormFlow } from '@moluoxixi/config-form-core'
import type { ConfigFormComponentRegistry } from '@moluoxixi/config-form-headless'
import type { ComponentContract, PageGraph, PageNode } from '@moluoxixi/config-form-model'
import type { DesignerDiagnostic } from '../../../graph'
import type { DesignerMaterialDefinition, DesignerPropertyControlRegistry } from '../../../registry'

export interface DesignerPropertyPanelProps {
  graph: PageGraph
  flows?: ConfigFormFlow[]
  node?: PageNode
  nodes?: PageNode[]
  material?: DesignerMaterialDefinition
  componentDefinition?: ComponentContract
  getMaterial?: (component: string) => DesignerMaterialDefinition | undefined
  getComponentDefinition?: (component: string) => ComponentContract | undefined
  diagnostics: DesignerDiagnostic[]
  breakpoint?: ConfigFormBreakpoint
  validatorOptions?: string[]
  components?: ConfigFormComponentRegistry
  propertyControls?: DesignerPropertyControlRegistry
  readonly?: boolean
}
