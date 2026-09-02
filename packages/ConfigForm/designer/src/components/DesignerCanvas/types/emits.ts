import type { DesignerSelectionMode } from '../../../composables'
import type { DesignerDropTarget } from '../../../graph'
import type { DesignerNodeAction } from '../../DesignSurface/types'

export interface DesignerCanvasEmits {
  select: [nodeId: string, mode?: DesignerSelectionMode]
  move: [nodeId: string, target: DesignerDropTarget]
  addMaterial: [materialKey: string, target: DesignerDropTarget]
  action: [action: DesignerNodeAction, nodeId: string]
  toggleInteractive: []
  updateField: [field: string, value: unknown]
  resize: [nodeId: string, span: number]
}
