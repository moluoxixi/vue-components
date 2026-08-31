import type { ConfigFormReactionProjection } from '@moluoxixi/config-form-core'
import type { VueRuntimeRendererConfig } from '@moluoxixi/config-form-vue-backend'
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
  /**
   * Routes property-panel operations through the host's canonical command
   * engine. The legacy `modelOperation` emit remains as a compatibility
   * fallback for standalone consumers that have not adopted this bridge.
   */
  applyModelOperation?: (operation: ModelOperation) => boolean
  /**
   * Projects an uncommitted command through the host's canonical runtime
   * pipeline. Returning undefined keeps the committed runtime visible when a
   * candidate is invalid; it must not fall back to a second runtime compiler.
   */
  previewRuntime?: (
    command: DesignerCommand,
    document: DesignerDocument,
  ) => VueRuntimeRendererConfig | undefined
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
  /** Form layout settings used to render a drag candidate through RuntimeSurface. */
  form: DesignerDocument['form']
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

export interface DesignSurfaceProps {
  commandControl: DesignerCommandControl
  document: DesignerDocument
  /** Workbench uses Flow as the only normal editor for component events. */
  eventEditor?: 'actions' | 'flow'
  historyControl: DesignerHistoryControl
  locale?: DesignerLocaleOptions
  model: LowCodePageModel
  modelRegistry: LowCodeComponentRegistry
  readonly?: boolean
  registry: DesignerRegistry
  /** Canonical Vue Runtime plan used for the normal (non-candidate) canvas. */
  runtimeRenderer?: VueRuntimeRendererConfig
  workspaceNavigation?: 'external' | 'internal'
}

export interface DesignSurfaceEmits {
  (event: 'configureEvent', nodeId: string, eventName: string): void
  (event: 'diagnostics', diagnostics: DesignerDiagnostic[]): void
  (event: 'modelOperation', operation: ModelOperation): void
  (event: 'selectionChange', nodeId: string | undefined): void
  (event: 'selectionSetChange', nodeIds: string[], primaryId: string | undefined): void
}

export interface DesignSurfaceToolbarScope {
  breakpoint: ConfigFormBreakpoint
  canEditSelection: boolean
  canRedo: boolean
  canUndo: boolean
  copySelection: () => void
  readonly: boolean
  redo: () => void
  removeSelection: () => void
  selectBreakpoint: (breakpoint: ConfigFormBreakpoint) => void
  undo: () => void
}

export interface DesignSurfaceSlots {
  toolbar?: (scope: DesignSurfaceToolbarScope) => unknown
  palette?: (scope: DesignerPaletteScope) => unknown
  properties?: (scope: DesignerPropertiesScope) => unknown
  runtime?: (scope: DesignerRuntimeSlotScope) => unknown
  dragVisual?: (scope: DesignerDragVisualSlotScope) => unknown
}

export interface DesignerRuntimeRect {
  bottom: number
  height: number
  left: number
  right: number
  top: number
  width: number
}

export interface DesignerRuntimeNodeGeometry {
  depth: number
  nodeId: string
  order: number
  path: string
  rect: DesignerRuntimeRect
  slot?: string
}

export interface DesignerRuntimeGeometrySnapshot {
  layoutRect?: DesignerRuntimeRect
  nodes: DesignerRuntimeNodeGeometry[]
  revision: string
  surfaceRect: DesignerRuntimeRect
  viewport: {
    height: number
    width: number
  }
}

export type DesignerCanvasCameraMode = 'fit' | 'manual'

export interface DesignerCanvasCamera {
  mode: DesignerCanvasCameraMode
  pan: {
    x: number
    y: number
  }
  scale: number
}

export interface DesignerRuntimePointerPayload {
  button: number
  clientX: number
  clientY: number
  ctrlKey: boolean
  metaKey: boolean
  nodeId?: string
  pointerId: number
  shiftKey: boolean
}

export interface DesignerRuntimeHostBridge {
  pointerCancel: (payload: DesignerRuntimePointerPayload) => void
  pointerDown: (payload: DesignerRuntimePointerPayload) => void
  pointerMove: (payload: DesignerRuntimePointerPayload) => void
  pointerUp: (payload: DesignerRuntimePointerPayload) => void
  updateGeometry: (snapshot: DesignerRuntimeGeometrySnapshot) => void
}

export interface DesignerRuntimeSlotScope {
  breakpoint: ConfigFormBreakpoint
  bridge: DesignerRuntimeHostBridge
  cameraScale: number
  candidateId?: string
  candidateUsesFallback: boolean
  command?: DesignerCommand
  document: DesignerDocument
  interactive: boolean
  model: Record<string, unknown>
  reactionProps: ConfigFormReactionProjection['props']
  reactionStates: ConfigFormReactionProjection['states']
  renderer: VueRuntimeRendererConfig
}

export interface DesignerDragVisualSlotScope extends DesignerRuntimeSlotScope {
  canvasWidth: number
  height: number
  width: number
}

export interface DesignSurfaceExpose {
  performNodeAction: (action: DesignerNodeAction, nodeId: string) => boolean
  redo: () => boolean
  select: (nodeId?: string, mode?: DesignerSelectionMode) => void
  selectBreakpoint: (breakpoint: ConfigFormBreakpoint) => void
  selectWorkspaceView: (view: 'canvas' | 'palette' | 'properties') => void
  undo: () => boolean
}
