import type { RuleDescriptor } from '@moluoxixi/zod3-to-rule'
import type { DesignerPropertySetterDefinition } from '../../../registry'

export type DesignerEditableRuleKind = Exclude<RuleDescriptor['kind'], 'compare' | 'custom'>

export interface DesignerPropertyFormEntry {
  setter: DesignerPropertySetterDefinition
  value: unknown
  inheritedValue?: unknown
  hint?: string
}

export interface DesignerInteractionSurfaceOption {
  readonly id: string
  readonly kind: 'dialog' | 'drawer' | 'page'
  readonly name: string
  readonly outputs: readonly { readonly name: string }[]
  readonly parameters: readonly {
    readonly defaultValue?: unknown
    readonly name: string
    readonly required: boolean
  }[]
}
