import type { ConfigFormBreakpoint } from '@moluoxixi/config-form'
import type { DesignerDragVisualSlotScope, DesignerRuntimeSlotScope } from '../../DesignerCanvas/types'
import type { DesignerPaletteScope, DesignerPropertiesScope } from './domain'

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
