import type { ConfigFormValues } from '../types'
import type { ControllerNode } from '../types/controller-internal'
import { collectAllConfigFormFields } from '../utils'

export function createInitialControllerValues<TValues extends ConfigFormValues>(
  model: TValues,
  fields: ControllerNode<TValues>[],
  explicitDefaults?: Partial<TValues>,
): TValues {
  const values = { ...model }
  const defaults: ConfigFormValues = {}

  collectAllConfigFormFields(fields).forEach((field) => {
    if (field.defaultValue !== undefined)
      setConfigFormValue(defaults, field.field, field.defaultValue)
  })
  Object.entries(defaults).forEach(([field, value]) => {
    if (!Object.hasOwn(values, field))
      setConfigFormValue(values, field, value)
  })
  Object.entries(explicitDefaults ?? {}).forEach(([field, value]) => {
    setConfigFormValue(values, field, value)
  })

  return values
}

export function createResetControllerValues<TValues extends ConfigFormValues>(
  initialValues: TValues,
  fields: ControllerNode<TValues>[],
): TValues {
  const values = { ...initialValues }
  collectAllConfigFormFields(fields).forEach((field) => {
    if (!Object.hasOwn(values, field.field) && field.defaultValue !== undefined)
      setConfigFormValue(values, field.field, field.defaultValue)
  })
  return values
}

export function normalizeControllerFieldNames(
  fields?: string | string[],
): string[] | undefined {
  if (fields === undefined)
    return undefined
  return Array.isArray(fields) ? fields : [fields]
}

export function shallowEqualControllerValues<TValues extends ConfigFormValues>(
  left: TValues,
  right: TValues,
): boolean {
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  return leftKeys.length === rightKeys.length
    && leftKeys.every(key => Object.is(left[key], right[key]))
}

export function setConfigFormValue(
  values: ConfigFormValues,
  field: string,
  value: unknown,
): void {
  Object.defineProperty(values, field, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  })
}
