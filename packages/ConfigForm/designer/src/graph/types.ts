import type {
  ModelDiagnostic,
  NodePlacement,
  PageGraph,
  PageNode,
  ProjectCommand,
  SlotItem,
} from '@moluoxixi/config-form-model'
import type { VueRuntimeRendererConfig } from '@moluoxixi/config-form-vue-backend'

export type DesignerJsonValue = import('@moluoxixi/config-form-model').ModelJsonValue
export type DesignerJsonObject = import('@moluoxixi/config-form-model').ModelJsonObject

export interface DesignNodeLocation {
  index: number
  item: SlotItem
  node: PageNode
  parent?: Extract<PageNode, { kind: 'layout' }>
  parentId: string | null
  path: Array<string | number>
  placement: NodePlacement
  sequence: SlotItem[]
  slot?: string
}

export interface DesignNodeVisit extends Omit<DesignNodeLocation, 'sequence'> {}

export type DesignerDiagnosticSeverity = 'error' | 'warning'

export interface DesignerDiagnostic extends ModelDiagnostic {
  path: Array<string | number>
  severity: DesignerDiagnosticSeverity
}

export interface DesignGraphContext {
  graph: PageGraph
  pageId: string
}

export type DesignerDropTarget
  = | { parentId: null, index?: number }
    | { parentId: string, slot: string, index?: number }

export interface DesignCommandPreview {
  command: ProjectCommand
  graph: PageGraph
  renderer?: VueRuntimeRendererConfig
}
