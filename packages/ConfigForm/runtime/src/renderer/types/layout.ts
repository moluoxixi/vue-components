export type ConfigFormLabelPosition = 'left' | 'top'

export interface ConfigFormFieldLayout {
  control: Record<string, string | number>
  error?: Record<string, string | number>
  field: Record<string, string | number>
}
