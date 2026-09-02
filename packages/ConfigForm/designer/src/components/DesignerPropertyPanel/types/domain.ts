import type { DesignerPropertySetterDefinition } from '../../../registry'

export interface DesignerPropertyFormEntry {
  setter: DesignerPropertySetterDefinition
  value: unknown
  inheritedValue?: unknown
  hint?: string
}
