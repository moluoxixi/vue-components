export type ConfigFormLabelPosition = 'left' | 'top'

export interface ConfigFormFieldLayout {
  control: Record<string, string | number>
  error?: Record<string, string | number>
  field: Record<string, string | number>
}

export function resolveConfigFormFieldLayout(
  labelPosition: ConfigFormLabelPosition,
  hasLabel: boolean,
): ConfigFormFieldLayout {
  if (labelPosition === 'left' && hasLabel) {
    return {
      field: {
        alignItems: 'start',
        columnGap: '12px',
        display: 'grid',
        gridTemplateColumns: 'max-content minmax(0, 1fr)',
        minWidth: 0,
        rowGap: '6px',
      },
      control: { gridColumn: 2, minWidth: 0 },
      error: { gridColumn: 2 },
    }
  }

  return {
    field: {
      display: 'grid',
      gap: '6px',
      minWidth: 0,
    },
    control: { minWidth: 0 },
  }
}
