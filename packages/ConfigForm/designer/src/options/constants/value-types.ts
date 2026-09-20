import type { DesignerOptionValueType } from '../../registry'

export const DESIGNER_OPTION_VALUE_TYPES = [
  'string',
  'number',
  'boolean',
] as const satisfies readonly DesignerOptionValueType[]

export const DESIGNER_TEXT_NUMBER_OPTION_VALUE_TYPES = [
  'string',
  'number',
] as const satisfies readonly DesignerOptionValueType[]
