import type { ConfigFormBreakpoint } from '@moluoxixi/config-form'
import type { DesignerSelectionMode } from '../../../composables'
import type { DesignerNodeAction } from './domain'

export interface DesignSurfaceExpose {
  performNodeAction: (action: DesignerNodeAction, nodeId: string) => boolean
  redo: () => boolean
  select: (nodeId?: string, mode?: DesignerSelectionMode) => void
  selectBreakpoint: (breakpoint: ConfigFormBreakpoint) => void
  selectWorkspaceView: (view: 'canvas' | 'palette' | 'properties') => void
  undo: () => boolean
}
