import type {
  DesignerDiagnostic,
  DesignerDocument,
  DesignerFieldNode,
  DesignerFormSettings,
  DesignerNode,
  DesignerNodeBase,
} from '../document'

export type DesignerDropTarget
  = | { parentId: null, index?: number }
    | { parentId: string, slot: string, index?: number }

export type DesignerNodeChanges = Partial<
  Pick<DesignerNodeBase, 'material' | 'props' | 'span' | 'conditions'>
  & Pick<DesignerFieldNode, 'field' | 'label' | 'defaultValue' | 'validation' | 'validateOn'>
>

export type DesignerFormChanges = Partial<DesignerFormSettings>

export type DesignerCommand
  = | { type: 'addNode', node: DesignerNode, target: DesignerDropTarget }
    | { type: 'moveNode', nodeId: string, target: DesignerDropTarget }
    | {
      type: 'copyNode'
      nodeId: string
      target: DesignerDropTarget
      newIds: Record<string, string>
      newFields: Record<string, string>
    }
    | { type: 'removeNode', nodeId: string }
    | { type: 'updateNode', nodeId: string, changes: DesignerNodeChanges }
    | { type: 'updateNodePath', nodeId: string, path: string[], value: unknown }
    | { type: 'updateForm', changes: DesignerFormChanges }
    | { type: 'replaceDocument', document: unknown }

export interface DesignerReduceResult {
  document: DesignerDocument
  changed: boolean
  diagnostics: DesignerDiagnostic[]
}

export interface DesignerHistoryState {
  past: DesignerDocument[]
  present: DesignerDocument
  future: DesignerDocument[]
  limit: number
}

export interface DesignerHistoryResult {
  history: DesignerHistoryState
  changed: boolean
  diagnostics: DesignerDiagnostic[]
}

export interface CreateDesignerCopyCommandOptions {
  createId?: (sourceId: string) => string
  createField?: (sourceField: string, usedFields: ReadonlySet<string>) => string
}
