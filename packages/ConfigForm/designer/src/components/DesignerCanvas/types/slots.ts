import type { DesignerDragVisualSlotScope, DesignerRuntimeSlotScope } from './runtime'

export interface DesignerCanvasSlots {
  runtime?: (scope: DesignerRuntimeSlotScope) => unknown
  dragVisual?: (scope: DesignerDragVisualSlotScope) => unknown
}
