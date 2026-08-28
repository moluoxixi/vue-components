import type { ConfigFormReactionProjection } from '@moluoxixi/config-form-core'
import type { ConfigFormBreakpoint } from '@moluoxixi/config-form/renderer'
import type { DesignerCompileResult } from '../compiler'
import type { DesignerSelectionMode } from '../composables'
import type { DesignerDiagnostic, DesignerDocument, DesignerNode } from '../document'
import type { DesignerCommand, DesignerDropTarget } from '../history'
import type { DesignerLocaleOptions } from '../locale'
import type {
  LowCodeComponentDefinition,
  LowCodeComponentRegistry,
  LowCodeNode,
  LowCodePageModel,
  ModelOperation,
} from '../model'
import type { DesignerMaterialDefinition, DesignerRegistry } from '../registry'

export interface ConfigFormDesignerProps {
  document: DesignerDocument
  registry: DesignerRegistry
  model?: LowCodePageModel
  modelRegistry?: LowCodeComponentRegistry
  commandControl?: DesignerCommandControl
  historyControl?: DesignerHistoryControl
  locale?: DesignerLocaleOptions
  historyLimit?: number
  readonly?: boolean
}

export interface DesignerCommandControl {
  apply: (command: DesignerCommand, document: DesignerDocument) => boolean
}

export interface DesignerHistoryControl {
  canUndo: boolean
  canRedo: boolean
  undo: () => boolean
  redo: () => boolean
}

export interface ConfigFormDesignerEmits {
  (event: 'update:document', document: DesignerDocument): void
  (event: 'command', command: DesignerCommand, document: DesignerDocument): void
  (event: 'modelOperation', operation: ModelOperation): void
  (event: 'diagnostics', diagnostics: DesignerDiagnostic[]): void
  (event: 'selectionChange', nodeId: string | undefined): void
  (event: 'selectionSetChange', nodeIds: string[], primaryId: string | undefined): void
  (event: 'preview', result: DesignerCompileResult): void
  (event: 'import', document: DesignerDocument): void
  (event: 'export', json: string): void
}

export type DesignerNodeAction = 'moveBefore' | 'moveAfter' | 'indent' | 'outdent' | 'copy' | 'remove'

export interface DesignerToolbarScope {
  breakpoint: ConfigFormBreakpoint
  canUndo: boolean
  canRedo: boolean
  canEditSelection: boolean
  readonly: boolean
  copySelection: () => void
  removeSelection: () => void
  selectBreakpoint: (breakpoint: ConfigFormBreakpoint) => void
  undo: () => void
  redo: () => void
  preview: () => void
  openImport: () => void
  openExport: () => void
}

export interface DesignerPaletteScope {
  materials: DesignerMaterialDefinition[]
  addMaterial: (materialKey: string) => void
  readonly: boolean
}

export interface DesignerCanvasScope {
  document: DesignerDocument
  selectedId: string | undefined
  selectedIds: string[]
  select: (nodeId: string | undefined, mode?: DesignerSelectionMode) => void
  move: (nodeId: string, target: DesignerDropTarget) => void
  breakpoint: ConfigFormBreakpoint
  interactive: boolean
  model: Record<string, unknown>
  reactionProps: ConfigFormReactionProjection['props']
  reactionStates: ConfigFormReactionProjection['states']
}

export interface DesignerPropertiesScope {
  document: DesignerDocument
  node: DesignerNode | undefined
  nodes: DesignerNode[]
  material: DesignerMaterialDefinition | undefined
  diagnostics: DesignerDiagnostic[]
  modelNodes: LowCodeNode[]
  componentDefinition: LowCodeComponentDefinition | undefined
}

export interface ConfigFormDesignerSlots {
  toolbar?: (scope: DesignerToolbarScope) => unknown
  palette?: (scope: DesignerPaletteScope) => unknown
  canvas?: (scope: DesignerCanvasScope) => unknown
  properties?: (scope: DesignerPropertiesScope) => unknown
  preview?: (scope: { result: DesignerCompileResult, close: () => void }) => unknown
  diagnostics?: (scope: { diagnostics: DesignerDiagnostic[] }) => unknown
}

export interface ConfigFormDesignerExpose {
  dispatch: (command: DesignerCommand) => boolean
  performNodeAction: (action: DesignerNodeAction, nodeId: string) => boolean
  undo: () => boolean
  redo: () => boolean
  select: (nodeId?: string, mode?: DesignerSelectionMode) => void
  selectBreakpoint: (breakpoint: ConfigFormBreakpoint) => void
  preview: () => DesignerCompileResult
  importDocument: (input: unknown) => boolean
  exportDocument: () => string
}
