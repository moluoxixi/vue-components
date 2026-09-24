import type { ConfigFormValues } from '../types'
import type {
  ControllerReset,
  ControllerResetServiceOptions,
} from '../types/controller-internal'
import {
  cloneControllerValue,
  normalizeControllerFieldNames,
  setConfigFormValue,
} from './controller-values'

export function createControllerResetService<TValues extends ConfigFormValues>(
  options: ControllerResetServiceOptions<TValues>,
): ControllerReset {
  return (fields): Promise<boolean> => {
    options.beginReset()
    const fieldNames = normalizeControllerFieldNames(fields)
    if (fieldNames === undefined) {
      options.clearTouched()
      const values = options.createResetValues()
      options.commitValues(values, undefined, false)
      return options.runLifecycle('form.reset', { values })
    }

    options.clearTouched(fieldNames)
    const values = cloneControllerValue(options.readValues())
    const resetValues = options.createResetValues()
    fieldNames.forEach((field) => {
      if (Object.hasOwn(resetValues, field))
        setConfigFormValue(values, field, resetValues[field])
      else
        delete values[field]
    })
    options.commitValues(values, fieldNames, false)
    return options.runLifecycle('form.reset', { fields: fieldNames, values })
  }
}
