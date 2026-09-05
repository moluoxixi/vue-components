import type { ConfigFormFlow } from '@moluoxixi/config-form-core'
import type { ComponentContract, FormSettings, ModelDiagnostic, PageGraph, PageNode, ProjectCommand, ProjectHistorySummary } from '@moluoxixi/config-form-model'
import type { DesignCommandPreview, DesignerDiagnostic, DesignerDropTarget } from '../../../graph'
import type { DesignerMaterialDefinition } from '../../../registry'

export interface DesignerCommandResult {
  changed: boolean
  diagnostics: readonly ModelDiagnostic[]
}

export interface DesignerCommandControl {
  execute: (command: ProjectCommand) => DesignerCommandResult
  preview: (command: ProjectCommand) => DesignCommandPreview | undefined
}

export interface DesignerHistoryControl {
  canUndo: boolean
  canRedo: boolean
  history?: ProjectHistorySummary
  undo: () => boolean
  redo: () => boolean
}

export type DesignerNodeAction = 'moveBefore' | 'moveAfter' | 'indent' | 'outdent' | 'copy' | 'remove'

export interface DesignerPaletteScope {
  materials: DesignerMaterialDefinition[]
  addMaterial: (component: string, target?: DesignerDropTarget) => void
  readonly: boolean
  form: FormSettings
}

export interface DesignerPropertiesScope {
  graph: PageGraph
  node: PageNode | undefined
  nodes: PageNode[]
  material: DesignerMaterialDefinition | undefined
  diagnostics: DesignerDiagnostic[]
  componentDefinition: ComponentContract | undefined
  flows: ConfigFormFlow[]
}
