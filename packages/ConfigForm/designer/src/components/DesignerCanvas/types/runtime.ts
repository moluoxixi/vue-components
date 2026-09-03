import type { ConfigFormBreakpoint } from '@moluoxixi/config-form'
import type { ConfigFormReactionProjection } from '@moluoxixi/config-form-core'
import type { PageGraph, ProjectCommand } from '@moluoxixi/config-form-model'
import type { VueRuntimeRendererConfig } from '@moluoxixi/config-form-vue-backend'

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
  viewport: { height: number, width: number }
}

export type DesignerCanvasCameraMode = 'fit' | 'manual'

export interface DesignerCanvasCamera {
  mode: DesignerCanvasCameraMode
  pan: { x: number, y: number }
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

export interface DesignerRuntimePointerHandlers {
  cancel?: (payload: DesignerRuntimePointerPayload) => void
  move?: (payload: DesignerRuntimePointerPayload) => void
  up?: (payload: DesignerRuntimePointerPayload) => void
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
