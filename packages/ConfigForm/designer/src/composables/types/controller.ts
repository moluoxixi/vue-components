import type {
  ModelDiagnostic,
  PageGraph,
  PageNode,
  ProjectCommand,
} from '@moluoxixi/config-form-model'
import type { ComputedRef, Ref } from 'vue'
import type {
  DesignerDiagnostic,
  DesignerDropTarget,
} from '../../graph'
import type { DesignerMaterialDefinition, DesignerRegistry } from '../../registry'

export interface DesignCommandResult {
  changed: boolean
  diagnostics: readonly ModelDiagnostic[]
}

export interface UseDesignerControllerOptions {
  execute: (command: ProjectCommand) => DesignCommandResult
  graph: () => PageGraph
  onDiagnostics: (diagnostics: DesignerDiagnostic[]) => void
  onSelectionChange: (nodeId: string | undefined, nodeIds: string[]) => void
  pageId: () => string
  readonly: () => boolean
  registry: () => DesignerRegistry
}

export type DesignerSelectionMode = 'range' | 'replace' | 'toggle'

export interface DesignerController {
  diagnostics: ComputedRef<DesignerDiagnostic[]>
  dispatch: (command: ProjectCommand) => boolean
  graph: ComputedRef<PageGraph>
  selectedId: Ref<string | undefined>
  selectedIds: Ref<string[]>
  selectedMaterial: ComputedRef<DesignerMaterialDefinition | undefined>
  selectedNode: ComputedRef<PageNode | undefined>
  selectedNodes: ComputedRef<PageNode[]>
  select: (nodeId?: string, mode?: DesignerSelectionMode) => void
  addMaterial: (component: string, target?: DesignerDropTarget) => boolean
  performNodeAction: (
    action: 'moveBefore' | 'moveAfter' | 'indent' | 'outdent' | 'copy' | 'remove',
    nodeId: string,
  ) => boolean
}
