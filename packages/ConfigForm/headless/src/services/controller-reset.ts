import type { ConfigFormValues } from '../types'
import type {
  ControllerReset,
  ControllerResetServiceOptions,
} from '../types/controller-internal'
import {
  normalizeControllerFieldNames,
  setConfigFormValue,
} from './controller-values'

export function createControllerResetService<TValues extends ConfigFormValues>(
  options: ControllerResetServiceOptions<TValues>,
): ControllerReset {
  return (fields): void => {
    const fieldNames = normalizeControllerFieldNames(fields)
    if (fieldNames === undefined) {
      options.clearTouched()
      options.commitValues(options.createResetValues())
      return
    }

    options.clearTouched(fieldNames)
    const values = { ...options.readValues() }
    const resetValues = options.createResetValues()
    fieldNames.forEach((field) => {
      if (Object.hasOwn(resetValues, field))
        setConfigFormValue(values, field, resetValues[field])
      else
        delete values[field]
    })
    options.commitValues(values, fieldNames)
  }
}
