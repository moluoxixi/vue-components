import type { ConfigFormReactionProjection } from '@moluoxixi/config-form-core'
import type {
  ComponentContract,
  ComponentContractRegistry,
  FormSettings,
  ModelDiagnostic,
  PageGraph,
  PageNode,
  ProjectCommand,
} from '@moluoxixi/config-form-model'
import type { VueRuntimeRendererConfig } from '@moluoxixi/config-form-vue-backend'
import type { ConfigFormBreakpoint } from '@moluoxixi/config-form/renderer'
import type { DesignerSelectionMode } from '../composables'
import type {
  DesignCommandPreview,
  DesignerDiagnostic,
  DesignerDropTarget,
} from '../graph'
import type { DesignerLocaleOptions } from '../locale'
import type { DesignerMaterialDefinition, DesignerRegistry } from '../registry'

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
}

export interface DesignSurfaceProps {
  commandControl: DesignerCommandControl
  componentRegistry: ComponentContractRegistry
  eventEditor?: 'actions' | 'flow'
  graph: PageGraph
  historyControl: DesignerHistoryControl
  locale?: DesignerLocaleOptions
  pageId: string
  readonly?: boolean
  registry: DesignerRegistry
  runtimeRenderer: VueRuntimeRendererConfig
  workspaceNavigation?: 'external' | 'internal'
}

export interface DesignSurfaceEmits {
  (event: 'configureEvent', nodeId: string, eventName: string): void
  (event: 'diagnostics', diagnostics: DesignerDiagnostic[]): void
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
  command?: ProjectCommand
  graph: PageGraph
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
