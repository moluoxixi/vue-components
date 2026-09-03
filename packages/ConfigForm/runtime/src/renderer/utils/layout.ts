import type { ConfigFormFieldLayout, ConfigFormLabelPosition } from '../types'
import { resolveLabelWidth } from '../../utils'

export function resolveConfigFormFieldLayout(
  labelPosition: ConfigFormLabelPosition,
  hasLabel: boolean,
  labelWidth?: string | number,
): ConfigFormFieldLayout {
  if (labelPosition === 'left' && hasLabel) {
    return {
      field: {
        alignItems: 'start',
        columnGap: '12px',
        display: 'grid',
        gridTemplateColumns: `${resolveLabelWidth(labelWidth) ?? 'var(--mx-config-form-active-label-width, max-content)'} minmax(0, 1fr)`,
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
