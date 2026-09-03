import type {
  AntdVueDesignerOption,
  AntdVueOptionSource,
} from '../../types'
import {
  normalizeDesignerOptions,
  readDesignerOptionSource,
} from '@moluoxixi/config-form-designer'

export function readAntdVueOptionSource(value: unknown): AntdVueOptionSource | undefined {
  return readDesignerOptionSource(value)
}

export function normalizeAntdVueOptions(options: readonly unknown[] | undefined): AntdVueDesignerOption[] {
  return normalizeDesignerOptions(options)
}
