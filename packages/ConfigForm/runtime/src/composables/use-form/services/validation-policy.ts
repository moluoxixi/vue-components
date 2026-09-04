import type { FormValues, NormalizedFieldConfig, ValidateTrigger } from '../../../types'
import type { FieldValidationResult, VisibilitySnapshot } from '../types'
import type { ExecuteFieldValidationOptions } from '../types/validation-internal'
import { toRaw } from 'vue'
import { resolveValue, shouldValidateOn, validateFieldRules } from '../../../utils'
import { resolveNodeVisibility } from '../utils/topology'

export function hasFieldValidationRules(
  field?: NormalizedFieldConfig,
): field is NormalizedFieldConfig {
  return Boolean(field?.required || field?.schema || field?.validator)
}

export async function executeFieldValidation(
  options: ExecuteFieldValidationOptions,
  fieldName: string,
  trigger: ValidateTrigger,
  valuesSnapshot: FormValues,
  fieldRevision: number,
  visibilitySnapshot?: VisibilitySnapshot,
): Promise<FieldValidationResult> {
  const config = options.fieldConfigMap.value.get(fieldName)
  const field = config as NormalizedFieldConfig | undefined
  if (!hasFieldValidationRules(field))
    return { errors: [], valid: true }

  const shouldValidateHidden = trigger === 'submit' && field.submitWhenHidden
  const shouldValidateDisabled = trigger === 'submit' && field.submitWhenDisabled
  const topology = options.nodeTopology.value
  const fieldVisible = visibilitySnapshot
    ? isFieldVisible(fieldName, visibilitySnapshot)
    : (() => {
        const node = topology.fieldNodeMap.get(fieldName)
        return node ? resolveNodeVisibility(node, valuesSnapshot, topology) : true
      })()

  if (!fieldVisible && !shouldValidateHidden)
    return { errors: [], valid: true }
  if (resolveValue(field.readonly, valuesSnapshot, false))
    return { errors: [], valid: true }
  if (resolveValue(field.disabled, valuesSnapshot, false) && !shouldValidateDisabled)
    return { errors: [], valid: true }
  if (!shouldValidateOn(field, trigger))
    return { errors: [], valid: true }

  const fieldErrors = await validateFieldRules(
    valuesSnapshot[fieldName],
    field.schema,
    valuesSnapshot,
    field.validator,
    field.required,
    field.requiredMessage,
  )
  if (options.isDisposed())
    throw options.createDisposedError()
  if (trigger !== 'submit' && (
    options.getFieldRevision(fieldName) !== fieldRevision
    || options.fieldConfigMap.value.get(fieldName) !== field
    || !Object.is(toRaw(options.values)[fieldName], valuesSnapshot[fieldName])
  )) {
    return { errors: [], valid: true }
  }

  return {
    errors: fieldErrors,
    valid: fieldErrors.length === 0,
  }
}

function isFieldVisible(fieldName: string, visibility: VisibilitySnapshot): boolean {
  const visible = visibility.byField.get(fieldName)
  return visible ?? true
}
