import type { ConfigFormComponentRegistry } from '@moluoxixi/config-form-headless'
import type { ComponentContract, PageGraph, PageNode } from '@moluoxixi/config-form-model'
import type { Component } from 'vue'
import type { DesignerDiagnostic } from '../../../graph'
import type { DesignerMaterialDefinition, DesignerPropertyControlRegistry } from '../../../registry'
import type { ConfigFormBreakpoint } from '../../DesignerCanvas/types'

export interface DesignerPropertyPanelProps {
  renderer: Component
  graph: PageGraph
  node?: PageNode
  nodes?: PageNode[]
  material?: DesignerMaterialDefinition
  componentDefinition?: ComponentContract
  getMaterial?: (component: string) => DesignerMaterialDefinition | undefined
  getComponentDefinition?: (component: string) => ComponentContract | undefined
  diagnostics: DesignerDiagnostic[]
  breakpoint?: ConfigFormBreakpoint
  components?: ConfigFormComponentRegistry
  propertyControls?: DesignerPropertyControlRegistry
  readonly?: boolean
}
