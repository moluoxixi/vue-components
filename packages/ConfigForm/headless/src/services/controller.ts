import type { ConfigFormReactionProjection } from '@moluoxixi/config-form-core'
import type {
  ConfigFormAttrs,
  ConfigFormCondition,
  ConfigFormController,
  ConfigFormControllerOptions,
  ConfigFormFieldChangeRequest,
  ConfigFormFieldValue,
  ConfigFormValues,
} from '../types'
import type {
  ControllerFieldState,
  ControllerNode,
} from '../types/controller-internal'
import {
  resolveControllerFieldStates,
} from './controller-field-state'
import { createControllerMetaService } from './controller-meta'
import { createControllerResetService } from './controller-reset'
import { createControllerSubmitService } from './controller-submit'
import { createControllerValidationService } from './controller-validation'
import {
  createInitialControllerValues,
  createResetControllerValues,
  setConfigFormValue,
  shallowEqualControllerValues,
} from './controller-values'
import { applyConfigFormReactions } from './reactions'

/** 创建与具体 UI 组件库无关的 ConfigForm 状态、校验和提交控制器。 */
export function createConfigFormController<TValues extends ConfigFormValues = ConfigFormValues>(
  options: ConfigFormControllerOptions<TValues>,
): ConfigFormController<TValues> {
  function readFields(): ControllerNode<TValues>[] {
    return options.fields?.() ?? []
  }

  function readFormReadonly(): ConfigFormCondition<TValues> | undefined {
    return options.readonly?.()
  }

  const initialValues = createInitialControllerValues(
    options.model.read(),
    readFields(),
    options.defaultValues,
  )
  let reactionProjection = applyConfigFormReactions(readFields(), initialValues)

  if (!shallowEqualControllerValues(options.model.read(), reactionProjection.values))
    options.model.write({ ...reactionProjection.values })

  function createResetValues(): TValues {
    return createResetControllerValues(initialValues, readFields())
  }

  const meta = createControllerMetaService({
    onMetaChange: options.onMetaChange,
    readFields,
    readResetValues: createResetValues,
    readValues: options.model.read,
  })

  function getFieldStates(
    values: TValues,
    projection?: ConfigFormReactionProjection<TValues>,
  ): ControllerFieldState<TValues>[] {
    const fields = readFields()
    reactionProjection = projection ?? applyConfigFormReactions(fields, values)
    return resolveControllerFieldStates(
      fields,
      reactionProjection,
      readFormReadonly(),
    )
  }

  const validation = createControllerValidationService({
    getFieldStates,
    onErrorsChange: options.onErrorsChange,
    onValidatingChange: options.onValidatingChange,
    readValues: options.model.read,
  })

  function getValues(): TValues {
    return { ...options.model.read() }
  }

  function getValue<TField extends string>(
    field: TField,
  ): ConfigFormFieldValue<TValues, TField> {
    return options.model.read()[field]
  }

  function getReactionProps(field: string): ConfigFormAttrs {
    return { ...(reactionProjection.props[field] ?? {}) }
  }

  function getReactionState(field: string) {
    return { ...(reactionProjection.states[field] ?? {}) }
  }

  function refreshReactions(): void {
    const values = options.model.read()
    const projection = applyConfigFormReactions(readFields(), values)
    reactionProjection = projection
    validation.invalidate()
    if (!shallowEqualControllerValues(values, projection.values)) {
      options.model.write(projection.values)
      options.onChange?.(projection.values)
    }
    meta.commitMeta()
    scheduleReactionValidation(projection.validate, undefined, projection)
  }

  function commitValues(
    values: TValues,
    fieldsToClear?: string[],
  ): ConfigFormReactionProjection<TValues> {
    const projection = applyConfigFormReactions(readFields(), values)
    reactionProjection = projection
    validation.invalidate()
    validation.clearErrors(fieldsToClear)
    options.model.write(projection.values)
    meta.commitMeta()
    options.onChange?.(projection.values)
    return projection
  }

  function commitFieldValue(
    field: string,
    value: unknown,
  ): ConfigFormReactionProjection<TValues> {
    const values = { ...options.model.read() }
    setConfigFormValue(values, field, value)

    const projection = applyConfigFormReactions(readFields(), values)
    reactionProjection = projection
    validation.invalidate()
    validation.clearFieldError(field)
    options.model.write(projection.values)
    meta.commitMeta()
    options.onFieldChange?.({ field, value: projection.values[field], values: projection.values })
    options.onChange?.(projection.values)
    return projection
  }

  function setValue<TField extends string>(
    field: TField,
    value: ConfigFormFieldValue<TValues, NoInfer<TField>>,
  ): void {
    const projection = commitFieldValue(field, value)
    scheduleReactionValidation(projection.validate, undefined, projection)
  }

  function setValues(values: Partial<TValues>, replace?: false): void
  function setValues(values: TValues, replace: true): void
  function setValues(
    ...args: [values: Partial<TValues>, replace?: false] | [values: TValues, replace: true]
  ): void {
    const projection = args[1] === true
      ? commitValues(args[0], Object.keys(args[0]))
      : commitValues({ ...options.model.read(), ...args[0] }, Object.keys(args[0]))
    scheduleReactionValidation(projection.validate, undefined, projection)
  }

  function applyFieldChange(request: ConfigFormFieldChangeRequest<TValues>): void {
    const projection = commitFieldValue(request.field, request.value)
    void validation.validateField(request.field, 'change', projection)
    scheduleReactionValidation(projection.validate, request.field, projection)
  }

  function scheduleReactionValidation(
    fields: string[],
    excludedField?: string,
    projection?: ConfigFormReactionProjection<TValues>,
  ): void {
    fields
      .filter(field => field !== excludedField)
      .forEach(field => void validation.validateField(field, 'change', projection))
  }

  const resetFields = createControllerResetService({
    clearTouched: meta.clearTouched,
    commitValues,
    createResetValues,
    readValues: options.model.read,
  })
  const submit = createControllerSubmitService({
    getErrors: validation.getErrors,
    getFieldStates,
    getValues,
    onError: options.onError,
    onSubmit: options.onSubmit,
    readValues: options.model.read,
    setTouched: meta.setTouched,
    validateValues: validation.validateValues,
  })

  return {
    applyFieldChange,
    clearValidate: validation.clearValidate,
    getErrors: validation.getErrors,
    getFieldMeta: meta.getFieldMeta,
    getMeta: meta.getMeta,
    getReactionProps,
    getReactionState,
    getValidating: validation.getValidating,
    getValue,
    getValues,
    isFieldValidating: validation.isFieldValidating,
    refreshMeta: meta.refreshMeta,
    refreshReactions,
    resetFields,
    setErrors: validation.setErrors,
    setTouched: meta.setTouched,
    setValue,
    setValues,
    submit,
    validate: validation.validate,
    validateField: validation.validateField,
  }
}
