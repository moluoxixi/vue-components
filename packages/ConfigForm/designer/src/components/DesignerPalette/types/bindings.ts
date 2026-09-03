import type { DesignerMaterialDefinition } from '../../../registry'

export interface DesignerPaletteMaterialBindings {
  'aria-label': string
  'aria-pressed': boolean
  'class': Array<string | Record<string, boolean | undefined>>
  'data-designer-draggable': true
  'data-material-key': string
  'data-material-kind': DesignerMaterialDefinition['kind']
  'disabled': boolean | undefined
  'onClick': (event: MouseEvent) => void
  'onKeydown': (event: KeyboardEvent) => void
  'onPointerdown': (event: PointerEvent) => void
  'title': string
}
