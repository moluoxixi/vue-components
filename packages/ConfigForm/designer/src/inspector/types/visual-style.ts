export interface VisualStyleField {
  key: string
  label: string
  control: 'length' | 'color' | 'select'
  allowAuto?: boolean
  allowNegative?: boolean
  allowPercentage?: boolean
  options?: readonly { value: string, label: string }[]
}

export interface VisualStyleGroup {
  key: string
  label: string
  fields: readonly VisualStyleField[]
}
