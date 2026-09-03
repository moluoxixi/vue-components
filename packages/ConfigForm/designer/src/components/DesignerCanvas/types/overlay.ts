import type { CSSProperties } from 'vue'

export interface DesignerCanvasOverlayBox {
  id: string
  primary: boolean
  style: CSSProperties
}

export interface DesignerCanvasDesignPolicySpot {
  id: string
  message: string
  style: CSSProperties
}
