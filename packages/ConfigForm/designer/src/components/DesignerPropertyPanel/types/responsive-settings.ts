import type { ConfigFormBreakpoint, ConfigFormResponsiveLayout } from '@moluoxixi/config-form-core'
import type { ConfigFormComponentRegistry } from '@moluoxixi/config-form-headless'
import type { FormSettings } from '@moluoxixi/config-form-model'
import type { Component } from 'vue'
import type { DesignerPropertyControlRegistry } from '../../../registry'

export interface DesignerResponsiveSettingsOptions {
  modelValue?: ConfigFormResponsiveLayout
  columns?: number
  fieldSpan?: number
  disabled?: boolean
  form?: FormSettings
  labelWidth?: number
  showHeading?: boolean
  readonly?: boolean
  breakpoint?: ConfigFormBreakpoint
}

export interface DesignerResponsiveSettingsProps extends DesignerResponsiveSettingsOptions {
  components?: ConfigFormComponentRegistry
  controls?: DesignerPropertyControlRegistry
  renderer: Component
}

export interface DesignerResponsiveSettingsCallbacks {
  onUpdateForm: (changes: Partial<FormSettings>) => void
  onCommitResponsive?: (value: ConfigFormResponsiveLayout | undefined) => void
}
