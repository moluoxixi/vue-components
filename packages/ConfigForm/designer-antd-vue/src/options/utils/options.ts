import type { AntdVueDesignerOption } from '../../types'
import { normalizeDesignerOptions } from '@moluoxixi/config-form-designer'

export function normalizeAntdVueOptions(options: readonly unknown[] | undefined): AntdVueDesignerOption[] {
  return normalizeDesignerOptions(options)
}
