import type { DesignerCompileResult } from '../compiler'
import type { DesignerDiagnostic, DesignerDocument, DesignerNode } from '../document'
import type { DesignerCommand, DesignerDropTarget } from '../history'
import type { DesignerLocaleOptions } from '../locale'
import type { DesignerMaterialDefinition, DesignerRegistry } from '../registry'

export interface ConfigFormDesignerProps {
  document: DesignerDocument
  registry: DesignerRegistry
  locale?: DesignerLocaleOptions
  historyLimit?: number
  readonly?: boolean
}

export interface ConfigFormDesignerEmits {
  (event: 'update:document', document: DesignerDocument): void
  (event: 'command', command: DesignerCommand, document: DesignerDocument): void
  (event: 'diagnostics', diagnostics: DesignerDiagnostic[]): void
  (event: 'selectionChange', nodeId: string | undefined): void
  (event: 'preview', result: DesignerCompileResult): void
  (event: 'import', document: DesignerDocument): void
  (event: 'export', json: string): void
}

export type DesignerNodeAction = 'moveBefore' | 'moveAfter' | 'indent' | 'outdent' | 'copy' | 'remove'

export interface DesignerToolbarScope {
  canUndo: boolean
  canRedo: boolean
  readonly: boolean
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
  select: (nodeId: string | undefined) => void
  move: (nodeId: string, target: DesignerDropTarget) => void
}

export interface DesignerPropertiesScope {
  document: DesignerDocument
  node: DesignerNode | undefined
  material: DesignerMaterialDefinition | undefined
  diagnostics: DesignerDiagnostic[]
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
  undo: () => boolean
  redo: () => boolean
  select: (nodeId?: string) => void
  preview: () => DesignerCompileResult
  importDocument: (input: unknown) => boolean
  exportDocument: () => string
}
