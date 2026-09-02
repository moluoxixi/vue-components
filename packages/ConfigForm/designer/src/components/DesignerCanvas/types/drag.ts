import type { ShallowRef } from 'vue'
import type { DesignerDropTarget } from '../../../graph'

export interface DesignerPointerPosition {
  x: number
  y: number
}

export interface DesignerDragOverlaySize {
  height: number
  width: number
}

export interface DesignerDropGeometryCandidate {
  depth: number
  rect: {
    bottom: number
    height: number
    left: number
    right: number
    top: number
    width: number
  }
  specificity: number
  target: DesignerDropTarget
}

export type DesignerDragSource
  = | { type: 'material', materialKey: string, candidateId: string }
    | { type: 'node', nodeId: string, candidateId: string }

export type DesignerDragInput = 'pointer' | 'keyboard'

export interface DesignerDragAnnouncement {
  type: 'picked-up' | 'target' | 'dropped' | 'cancelled'
  source: DesignerDragSource
  target?: DesignerDropTarget
}

export interface DesignerDragSession {
  source: DesignerDragSource
  origin: DesignerPointerPosition
  position: DesignerPointerPosition
  pointerOffset: DesignerPointerPosition
  input: DesignerDragInput
  active: boolean
  target?: DesignerDropTarget
}

export type DesignerDropTargetResolver = (
  point: DesignerPointerPosition,
  source: DesignerDragSource,
  previous?: DesignerDropTarget,
) => DesignerDropTarget | undefined

export type DesignerKeyboardDropTargetsResolver = (
  source: DesignerDragSource,
) => DesignerDropTarget[]

export interface DesignerDragController {
  session: ShallowRef<DesignerDragSession | undefined>
  announcement: ShallowRef<DesignerDragAnnouncement | undefined>
  beginMaterial: (materialKey: string, candidateId: string, point: DesignerPointerPosition, pointerOffset?: DesignerPointerPosition) => void
  beginNode: (nodeId: string, point: DesignerPointerPosition, pointerOffset?: DesignerPointerPosition) => void
  beginMaterialKeyboard: (materialKey: string, candidateId: string) => boolean
  beginNodeKeyboard: (nodeId: string) => boolean
  move: (point: DesignerPointerPosition) => boolean
  moveKeyboard: (direction: 'next' | 'previous') => boolean
  finish: (point: DesignerPointerPosition) => void
  finishKeyboard: () => boolean
  cancel: () => void
  registerResolver: (resolver: DesignerDropTargetResolver) => () => void
  registerKeyboardTargets: (resolver: DesignerKeyboardDropTargetsResolver) => () => void
}

export interface CreateDesignerDragControllerOptions {
  commitMaterial: (source: Extract<DesignerDragSource, { type: 'material' }>, target: DesignerDropTarget) => void
  commitNode: (nodeId: string, target: DesignerDropTarget) => void
}
