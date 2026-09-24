import type { DesignerOptionValueType } from '@moluoxixi/config-form-designer'
import type { AntdVueDesignerOption } from '../../types'
import { normalizeDesignerOptions } from '@moluoxixi/config-form-designer'

export function normalizeAntdVueOptions(
  options: readonly unknown[] | undefined,
  allowedValueTypes: readonly DesignerOptionValueType[],
): AntdVueDesignerOption[] {
  return normalizeDesignerOptions(options, allowedValueTypes ?? [])
}
