import type { ConfigFormValues } from '../types'
import type { ControllerSubmitServiceOptions } from '../types/controller-internal'
import { isControllerFieldSubmittable } from './controller-field-state'
import { shallowEqualControllerValues } from './controller-values'

export function createControllerSubmitService<TValues extends ConfigFormValues>(
  options: ControllerSubmitServiceOptions<TValues>,
): () => Promise<boolean> {
  return async (): Promise<boolean> => {
    const values = options.getValues()
    const touchedFieldNames = options.getFieldStates(values)
      .filter(state => state.visible && !state.disabled && !state.readonly)
      .map(state => state.field.field)
    if (touchedFieldNames.length > 0)
      options.setTouched(touchedFieldNames)

    const result = await options.validateValues(values)
    if (result.status === 'stale')
      return false
    if (result.status === 'invalid') {
      options.onError?.(options.getErrors())
      return false
    }
    if (!shallowEqualControllerValues(options.readValues(), values))
      return false

    const submittedValues = Object.fromEntries(
      result.states
        .filter(isControllerFieldSubmittable)
        .map(({ field }) => [
          field.field,
          field.transform ? field.transform(values[field.field], values) : values[field.field],
        ]),
    ) as TValues
    options.onSubmit?.(submittedValues)
    return true
  }
}
