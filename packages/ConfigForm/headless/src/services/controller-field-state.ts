import type { ConfigFormReactionProjection } from '@moluoxixi/config-form-core'
import type {
  ConfigFormCondition,
  ConfigFormValidateTrigger,
  ConfigFormValues,
} from '../types'
import type {
  ControllerFieldState,
  ControllerNode,
} from '../types/controller-internal'
import { shouldValidateConfigFormOn } from '../schemas'
import { resolveConfigFormFieldStates } from '../utils'

export function resolveControllerFieldStates<TValues extends ConfigFormValues>(
  fields: ControllerNode<TValues>[],
  projection: ConfigFormReactionProjection<TValues>,
  readonly: ConfigFormCondition<TValues> | undefined,
): ControllerFieldState<TValues>[] {
  const states = resolveConfigFormFieldStates(
    fields,
    projection.values,
    readonly,
    projection.states,
  )
  assertUniqueFields(states)
  return states
}

export function shouldValidateControllerField<TValues extends ConfigFormValues>(
  state: ControllerFieldState<TValues>,
  trigger: ConfigFormValidateTrigger,
): boolean {
  const { field } = state
  if (!field.required && !field.schema && !field.validator)
    return false
  if (state.readonly)
    return false
  if (!state.visible && !(trigger === 'submit' && field.submitWhenHidden))
    return false
  if (state.disabled && !(trigger === 'submit' && field.submitWhenDisabled))
    return false
  return shouldValidateConfigFormOn(field.validateOn, trigger)
}

export function isControllerFieldSubmittable<TValues extends ConfigFormValues>(
  state: ControllerFieldState<TValues>,
): boolean {
  if (!state.visible && !state.field.submitWhenHidden)
    return false
  if (state.disabled && !state.field.submitWhenDisabled)
    return false
  return true
}

function assertUniqueFields<TValues extends ConfigFormValues>(
  states: ControllerFieldState<TValues>[],
): void {
  const names = new Set<string>()
  states.forEach(({ field }) => {
    if (names.has(field.field))
      throw new Error(`ConfigForm field "${field.field}" is declared more than once.`)
    names.add(field.field)
  })
}
