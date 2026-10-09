import type { DesignerSelectionMode } from '../../../composables'
import type { ConfigFormBreakpoint } from '../../DesignerCanvas/types'
import type { DesignerNodeAction } from './domain'

export interface DesignSurfaceExpose {
  addMaterial: (key: string) => boolean
  inspect: (nodeId: string, path?: readonly (string | number)[]) => Promise<void>
  moveNodeRelative: (nodeId: string, referenceId: string, position: 'after' | 'before') => boolean
  performNodeAction: (action: DesignerNodeAction, nodeId: string) => boolean
  redo: () => boolean
  select: (nodeId?: string, mode?: DesignerSelectionMode) => void
  selectBreakpoint: (breakpoint: ConfigFormBreakpoint) => void
  selectWorkspaceView: (view: 'canvas' | 'palette' | 'properties') => void
  undo: () => boolean
}
