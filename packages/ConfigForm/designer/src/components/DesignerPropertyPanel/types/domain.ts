import type { RuleDescriptor } from '@moluoxixi/zod3-to-rule'
import type { DesignerPropertySetterDefinition } from '../../../registry'

export type DesignerEditableRuleKind = Exclude<RuleDescriptor['kind'], 'compare' | 'custom'>

export interface DesignerPropertyFormEntry {
  setter: DesignerPropertySetterDefinition
  value: unknown
  inheritedValue?: unknown
  hint?: string
}
