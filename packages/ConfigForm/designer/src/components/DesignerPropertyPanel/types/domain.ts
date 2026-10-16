import type { ConfigFormField, ConfigFormNode } from '@moluoxixi/config-form-headless'
import type { RuleDescriptor } from '@moluoxixi/zod3-to-rule'
import type { DesignerPropertyControlDefinition, DesignerPropertySetterDefinition } from '../../../registry'

export type DesignerEditableRuleKind = Exclude<RuleDescriptor['kind'], 'compare' | 'custom'>

export type DesignerPropertyParseResult = { valid: true, value: unknown } | { valid: false, message?: string }

export type DesignerPropertyFormLayout = (field: (entry: DesignerPropertyFormEntry) => ConfigFormField) => ConfigFormNode[]

/** Local Inspector adapters; these functions never enter the design document. */
export interface DesignerPropertyFormEditor {
  control: DesignerPropertyControlDefinition
  commitOn: 'change' | 'explicit'
  parse?: (value: unknown) => DesignerPropertyParseResult
}

export interface DesignerPropertyFormEntry {
  setter: DesignerPropertySetterDefinition
  value: unknown
  inheritedValue?: unknown
  hint?: string
  mixed?: boolean
  /** Authoritative values behind a multi-selection's displayed mixed value. */
  sourceValues?: readonly unknown[]
  readonly?: boolean
  /** Local command routing for compound settings; never serialized. */
  onCommit?: (value: unknown) => void
  span?: number
  editor?: DesignerPropertyFormEditor
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
