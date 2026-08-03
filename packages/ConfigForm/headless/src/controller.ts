import type { Component } from 'vue'
import type {
  ConfigFormCondition,
  ConfigFormErrors,
  ConfigFormFieldChangePayload,
  ConfigFormFieldChangeRequest,
  ConfigFormFieldKey,
  ConfigFormFieldMeta,
  ConfigFormMeta,
  ConfigFormNode,
  ConfigFormValidateTrigger,
  ConfigFormValues,
} from './types'
import type { ConfigFormResolvedFieldState } from './utils/node'
import {
  collectAllConfigFormFields,
  resolveConfigFormFieldStates,
} from './utils/node'
import {
  shouldValidateConfigFormOn,
  validateConfigFormFieldRules,
} from './validation'

export interface ConfigFormModelAdapter<TValues extends ConfigFormValues = ConfigFormValues> {
  /** 读取当前模型；controller 每次操作都会重新读取，兼容响应式状态与外部替换。 */
  read: () => TValues
  /** 整体写回下一份模型。 */
  write: (values: TValues) => void
}

type ControllerNode<TValues extends ConfigFormValues> = ConfigFormNode<
  TValues,
  Component | string,
  unknown,
  unknown
>

type ControllerFieldState<TValues extends ConfigFormValues> = ConfigFormResolvedFieldState<
  TValues,
  unknown,
  unknown
>

interface ControllerValidationResult<TValues extends ConfigFormValues> {
  states: ControllerFieldState<TValues>[]
  status: 'invalid' | 'stale' | 'valid'
}

export interface ConfigFormControllerOptions<TValues extends ConfigFormValues = ConfigFormValues> {
  /** 对宿主模型的最小读写适配，不绑定 Vue ref 或具体状态库。 */
  model: ConfigFormModelAdapter<TValues>
  /** 动态读取当前字段树；校验、reset 和 submit 始终读取最新配置。 */
  fields?: () => ControllerNode<TValues>[]
  /** 显式 reset 基准；未提供时捕获首次 model，并补齐字段 defaultValue。 */
  defaultValues?: Partial<TValues>
  /** 动态读取表单级 readonly。 */
  readonly?: () => ConfigFormCondition<TValues> | undefined
  /** 单字段写入后的通知。 */
  onFieldChange?: (payload: ConfigFormFieldChangePayload<TValues>) => void
  /** 任意模型写入后的通知。 */
  onChange?: (values: TValues) => void
  /** 错误集合变化后的通知，UI adapter 用它驱动错误展示。 */
  onErrorsChange?: (errors: ConfigFormErrors) => void
  /** 校验状态变化后的通知。 */
  onValidatingChange?: (validating: boolean) => void
  /** dirty 或 touched 状态变化后的通知。 */
  onMetaChange?: (meta: ConfigFormMeta) => void
  /** submit 校验通过后的通知。 */
  onSubmit?: (values: TValues) => void
  /** submit 校验失败后的通知。 */
  onError?: (errors: ConfigFormErrors) => void
}

export type ConfigFormFieldValue<
  TValues extends ConfigFormValues,
  TField extends string,
> = TField extends ConfigFormFieldKey<TValues> ? TValues[TField] : unknown

export type ConfigFormFieldSelector<TValues extends ConfigFormValues>
  = | ConfigFormFieldKey<TValues>
    | string
    | Array<ConfigFormFieldKey<TValues> | string>

export interface ConfigFormController<TValues extends ConfigFormValues = ConfigFormValues> {
  /** 应用渲染器上报的字段变更请求，并按 change 触发校验。 */
  applyFieldChange: (request: ConfigFormFieldChangeRequest<TValues>) => void
  /** 获取当前模型的浅拷贝。 */
  getValues: () => TValues
  /** 获取当前表单的 dirty/touched 状态快照。 */
  getMeta: () => ConfigFormMeta
  /** 获取指定字段的 dirty/touched 状态。 */
  getFieldMeta: (field: ConfigFormFieldKey<TValues> | string) => ConfigFormFieldMeta
  /** 宿主在 controller 之外替换模型或字段树后，重新计算并通知 meta。 */
  refreshMeta: () => ConfigFormMeta
  /** 获取指定字段值。 */
  getValue: <TField extends string>(field: TField) => ConfigFormFieldValue<TValues, TField>
  /** 获取当前错误集合的防御性拷贝。 */
  getErrors: () => ConfigFormErrors
  /** 当前是否存在运行中的校验。 */
  getValidating: () => boolean
  /** 指定字段是否存在运行中的校验。 */
  isFieldValidating: (field: ConfigFormFieldKey<TValues> | string) => boolean
  /** 写入指定字段，并依次触发 fieldChange 与 change。 */
  setValue: <TField extends string>(
    field: TField,
    value: ConfigFormFieldValue<TValues, NoInfer<TField>>,
  ) => void
  /** 合并或整体替换模型，并触发 change。 */
  setValues: {
    (values: Partial<TValues>, replace?: false): void
    (values: TValues, replace: true): void
  }
  /** 校验当前字段拓扑。 */
  validate: () => Promise<boolean>
  /** 按指定触发时机校验单个字段。 */
  validateField: (
    field: ConfigFormFieldKey<TValues> | string,
    trigger?: ConfigFormValidateTrigger,
  ) => Promise<boolean>
  /** 清除全部或指定字段错误，并使运行中的旧校验失效。 */
  clearValidate: (fields?: ConfigFormFieldSelector<TValues>) => void
  /** 标记全部或指定字段的 touched 状态。 */
  setTouched: {
    (): void
    (touched: boolean): void
    (fields: ConfigFormFieldSelector<TValues>, touched?: boolean): void
  }
  /** 重置全部或指定字段到初始快照。 */
  resetFields: (fields?: ConfigFormFieldSelector<TValues>) => void
  /** 校验并提交当前可提交字段。 */
  submit: () => Promise<boolean>
}

/** 创建与具体 UI 组件库无关的 ConfigForm 状态、校验和提交控制器。 */
export function createConfigFormController<TValues extends ConfigFormValues = ConfigFormValues>(
  options: ConfigFormControllerOptions<TValues>,
): ConfigFormController<TValues> {
  let errors: ConfigFormErrors = {}
  let valuesRevision = 0
  let validationRequestId = 0
  let activeValidationCount = 0
  const activeFieldValidationCounts = new Map<string, number>()
  const latestFieldRequest = new Map<string, number>()
  const touchedFields = new Set<string>()
  const initialValues = createInitialValues()

  if (!shallowEqual(options.model.read(), initialValues))
    options.model.write({ ...initialValues })

  let lastMeta = createMeta()

  function readFields(): ControllerNode<TValues>[] {
    return options.fields?.() ?? []
  }

  function readFormReadonly(): ConfigFormCondition<TValues> | undefined {
    return options.readonly?.()
  }

  function createInitialValues(): TValues {
    const values = { ...options.model.read() }
    const defaults: ConfigFormValues = {}

    collectAllConfigFormFields(readFields()).forEach((field) => {
      if (field.defaultValue !== undefined)
        setConfigFormValue(defaults, field.field, field.defaultValue)
    })
    Object.entries(defaults).forEach(([field, value]) => {
      if (!Object.hasOwn(values, field))
        setConfigFormValue(values, field, value)
    })
    Object.entries(options.defaultValues ?? {}).forEach(([field, value]) => {
      setConfigFormValue(values, field, value)
    })

    return values
  }

  function getValues(): TValues {
    return { ...options.model.read() }
  }

  function getMeta(): ConfigFormMeta {
    return cloneMeta(createMeta())
  }

  function getFieldMeta(field: string): ConfigFormFieldMeta {
    const values = options.model.read()
    const resetValues = createResetValues()
    return {
      dirty: isFieldDirty(field, values, resetValues),
      touched: touchedFields.has(field),
    }
  }

  function refreshMeta(): ConfigFormMeta {
    return commitMeta()
  }

  function getValue<TField extends string>(
    field: TField,
  ): ConfigFormFieldValue<TValues, TField> {
    return options.model.read()[field]
  }

  function getErrors(): ConfigFormErrors {
    return cloneErrors(errors)
  }

  function getValidating(): boolean {
    return activeValidationCount > 0
  }

  function isFieldValidating(field: string): boolean {
    return (activeFieldValidationCounts.get(field) ?? 0) > 0
  }

  function commitErrors(nextErrors: ConfigFormErrors): void {
    if (equalErrors(errors, nextErrors))
      return

    errors = cloneErrors(nextErrors)
    options.onErrorsChange?.(getErrors())
  }

  function invalidateValidation(): void {
    valuesRevision += 1
    latestFieldRequest.clear()
  }

  function commitValues(values: TValues, fieldsToClear?: string[]): void {
    invalidateValidation()
    if (fieldsToClear === undefined) {
      commitErrors({})
    }
    else {
      const nextErrors = { ...errors }
      fieldsToClear.forEach(field => delete nextErrors[field])
      commitErrors(nextErrors)
    }
    options.model.write(values)
    commitMeta()
    options.onChange?.(values)
  }

  function setValue<TField extends string>(
    field: TField,
    value: ConfigFormFieldValue<TValues, NoInfer<TField>>,
  ): void {
    commitFieldValue(field, value)
  }

  function commitFieldValue(field: string, value: unknown): void {
    const values = { ...options.model.read() }
    setConfigFormValue(values, field, value)

    invalidateValidation()
    clearFieldError(field)
    options.model.write(values)
    commitMeta()
    options.onFieldChange?.({ field, value, values })
    options.onChange?.(values)
  }

  function setValues(values: Partial<TValues>, replace?: false): void
  function setValues(values: TValues, replace: true): void
  function setValues(
    ...args: [values: Partial<TValues>, replace?: false] | [values: TValues, replace: true]
  ): void {
    if (args[1] === true)
      commitValues(args[0], Object.keys(args[0]))
    else
      commitValues({ ...options.model.read(), ...args[0] }, Object.keys(args[0]))
  }

  function applyFieldChange(request: ConfigFormFieldChangeRequest<TValues>): void {
    commitFieldValue(request.field, request.value)
    void validateField(request.field, 'change')
  }

  function setTouched(): void
  function setTouched(touched: boolean): void
  function setTouched(fields: ConfigFormFieldSelector<TValues>, touched?: boolean): void
  function setTouched(
    fieldsOrTouched?: ConfigFormFieldSelector<TValues> | boolean,
    touched = true,
  ): void {
    const allFields = fieldsOrTouched === undefined || typeof fieldsOrTouched === 'boolean'
    const nextTouched = typeof fieldsOrTouched === 'boolean' ? fieldsOrTouched : touched
    const fieldNames = allFields
      ? Object.keys(createMeta().fields)
      : normalizeFieldNames(fieldsOrTouched)

    if (allFields && !nextTouched) {
      touchedFields.clear()
    }
    else {
      fieldNames?.forEach(field => nextTouched ? touchedFields.add(field) : touchedFields.delete(field))
    }

    commitMeta()
  }

  function beginValidation(fieldNames: string[]): void {
    const wasValidating = getValidating()
    activeValidationCount += fieldNames.length
    fieldNames.forEach((field) => {
      activeFieldValidationCounts.set(field, (activeFieldValidationCounts.get(field) ?? 0) + 1)
    })
    if (!wasValidating && getValidating())
      options.onValidatingChange?.(true)
  }

  function finishValidation(fieldNames: string[]): void {
    fieldNames.forEach((field) => {
      const count = (activeFieldValidationCounts.get(field) ?? 1) - 1
      if (count <= 0)
        activeFieldValidationCounts.delete(field)
      else
        activeFieldValidationCounts.set(field, count)
    })
    activeValidationCount = Math.max(0, activeValidationCount - fieldNames.length)
    if (!getValidating())
      options.onValidatingChange?.(false)
  }

  async function validateField(
    fieldName: string,
    trigger: ConfigFormValidateTrigger = 'submit',
  ): Promise<boolean> {
    const values = getValues()
    const states = getFieldStates(values)
    const state = states.find(item => item.field.field === fieldName)
    const requestId = ++validationRequestId
    const revision = valuesRevision
    latestFieldRequest.set(fieldName, requestId)

    if (!state || !shouldValidateField(state, trigger)) {
      clearFieldError(fieldName)
      return true
    }

    beginValidation([fieldName])
    try {
      const fieldErrors = await validateConfigFormFieldRules(values[fieldName], values, state.field)
      const current = latestFieldRequest.get(fieldName) === requestId
        && valuesRevision === revision
        && shallowEqual(options.model.read(), values)
      if (!current)
        return false

      const nextErrors = { ...errors }
      if (fieldErrors.length > 0)
        nextErrors[fieldName] = fieldErrors
      else
        delete nextErrors[fieldName]
      commitErrors(nextErrors)
      return fieldErrors.length === 0
    }
    finally {
      finishValidation([fieldName])
    }
  }

  async function validate(): Promise<boolean> {
    return (await validateValues(getValues())).status === 'valid'
  }

  async function validateValues(values: TValues): Promise<ControllerValidationResult<TValues>> {
    const states = getFieldStates(values)
    const revision = valuesRevision
    const requestId = ++validationRequestId
    const activeStates = states.filter(state => shouldValidateField(state, 'submit'))
    const fieldNames = states.map(state => state.field.field)

    fieldNames.forEach(field => latestFieldRequest.set(field, requestId))
    beginValidation(activeStates.map(state => state.field.field))
    try {
      const results = await Promise.all(activeStates.map(async (state): Promise<[string, string[]]> => [
        state.field.field,
        await validateConfigFormFieldRules(
          values[state.field.field],
          values,
          state.field,
        ),
      ]))

      const current = valuesRevision === revision
        && fieldNames.every(field => latestFieldRequest.get(field) === requestId)
        && shallowEqual(options.model.read(), values)
      if (!current)
        return { states, status: 'stale' }

      const nextErrors: ConfigFormErrors = {}
      results.forEach(([field, fieldErrors]) => {
        if (fieldErrors.length > 0)
          nextErrors[field] = fieldErrors
      })
      commitErrors(nextErrors)
      return {
        states,
        status: Object.keys(nextErrors).length === 0 ? 'valid' : 'invalid',
      }
    }
    finally {
      finishValidation(activeStates.map(state => state.field.field))
    }
  }

  function clearValidate(fields?: ConfigFormFieldSelector<TValues>): void {
    valuesRevision += 1
    latestFieldRequest.clear()
    const fieldNames = normalizeFieldNames(fields)
    if (fieldNames === undefined) {
      commitErrors({})
      return
    }

    const nextErrors = { ...errors }
    fieldNames.forEach(field => delete nextErrors[field])
    commitErrors(nextErrors)
  }

  function clearFieldError(field: string): void {
    if (!(field in errors))
      return
    const nextErrors = { ...errors }
    delete nextErrors[field]
    commitErrors(nextErrors)
  }

  function resetFields(fields?: ConfigFormFieldSelector<TValues>): void {
    const fieldNames = normalizeFieldNames(fields)
    if (fieldNames === undefined) {
      touchedFields.clear()
      commitValues(createResetValues())
      return
    }

    fieldNames.forEach(field => touchedFields.delete(field))
    const values = { ...options.model.read() }
    const resetValues = createResetValues()
    fieldNames.forEach((field) => {
      if (Object.hasOwn(resetValues, field))
        setConfigFormValue(values, field, resetValues[field])
      else
        delete values[field]
    })
    commitValues(values, fieldNames)
  }

  async function submit(): Promise<boolean> {
    const values = getValues()
    const touchedFieldNames = getFieldStates(values)
      .filter(state => state.visible && !state.disabled && !state.readonly)
      .map(state => state.field.field)
    if (touchedFieldNames.length > 0)
      setTouched(touchedFieldNames)

    const result = await validateValues(values)
    if (result.status === 'stale')
      return false
    if (result.status === 'invalid') {
      options.onError?.(getErrors())
      return false
    }
    if (!shallowEqual(options.model.read(), values))
      return false

    const submittedValues = Object.fromEntries(
      result.states
        .filter(isFieldSubmittable)
        .map(({ field }) => [
          field.field,
          field.transform ? field.transform(values[field.field], values) : values[field.field],
        ]),
    ) as TValues
    options.onSubmit?.(submittedValues)
    return true
  }

  function getFieldStates(values: TValues): ControllerFieldState<TValues>[] {
    const states = resolveConfigFormFieldStates(readFields(), values, readFormReadonly())
    assertUniqueFields(states)
    return states
  }

  function shouldValidateField(
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

  function isFieldSubmittable(state: ControllerFieldState<TValues>): boolean {
    if (!state.visible && !state.field.submitWhenHidden)
      return false
    if (state.disabled && !state.field.submitWhenDisabled)
      return false
    return true
  }

  function createResetValues(): TValues {
    const values = { ...initialValues }
    collectAllConfigFormFields(readFields()).forEach((field) => {
      if (!Object.hasOwn(values, field.field) && field.defaultValue !== undefined)
        setConfigFormValue(values, field.field, field.defaultValue)
    })
    return values
  }

  function createMeta(): ConfigFormMeta {
    const values = options.model.read()
    const resetValues = createResetValues()
    const fieldNames = new Set([
      ...Object.keys(values),
      ...Object.keys(resetValues),
      ...collectAllConfigFormFields(readFields()).map(field => field.field),
      ...touchedFields,
    ])
    const fields: ConfigFormMeta['fields'] = Object.fromEntries(
      [...fieldNames].map(field => [field, {
        dirty: isFieldDirty(field, values, resetValues),
        touched: touchedFields.has(field),
      }]),
    )

    return {
      dirty: Object.values(fields).some(field => field.dirty),
      fields,
      touched: Object.values(fields).some(field => field.touched),
    }
  }

  function commitMeta(): ConfigFormMeta {
    const nextMeta = createMeta()
    if (!equalMeta(lastMeta, nextMeta)) {
      lastMeta = nextMeta
      options.onMetaChange?.(cloneMeta(nextMeta))
    }
    return cloneMeta(nextMeta)
  }

  return {
    applyFieldChange,
    clearValidate,
    getFieldMeta,
    getErrors,
    getMeta,
    getValidating,
    getValue,
    getValues,
    isFieldValidating,
    refreshMeta,
    resetFields,
    setValue,
    setValues,
    setTouched,
    submit,
    validate,
    validateField,
  }
}

function cloneMeta(meta: ConfigFormMeta): ConfigFormMeta {
  return {
    dirty: meta.dirty,
    fields: Object.fromEntries(
      Object.entries(meta.fields).map(([field, fieldMeta]) => [
        field,
        { ...fieldMeta },
      ]),
    ),
    touched: meta.touched,
  }
}

function equalMeta(
  left: ConfigFormMeta,
  right: ConfigFormMeta,
): boolean {
  const leftFields = Object.keys(left.fields)
  const rightFields = Object.keys(right.fields)
  return left.dirty === right.dirty
    && left.touched === right.touched
    && leftFields.length === rightFields.length
    && leftFields.every((field) => {
      const leftMeta = left.fields[field]
      const rightMeta = right.fields[field]
      return leftMeta?.dirty === rightMeta?.dirty
        && leftMeta?.touched === rightMeta?.touched
    })
}

function isFieldDirty(
  field: string,
  values: ConfigFormValues,
  resetValues: ConfigFormValues,
): boolean {
  const hasValue = Object.hasOwn(values, field)
  const hasResetValue = Object.hasOwn(resetValues, field)
  return hasValue !== hasResetValue
    || (hasValue && !Object.is(values[field], resetValues[field]))
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

function normalizeFieldNames<TValues extends ConfigFormValues>(
  fields?: ConfigFormFieldSelector<TValues>,
): string[] | undefined {
  if (fields === undefined)
    return undefined
  return Array.isArray(fields) ? fields : [fields]
}

function cloneErrors(errors: ConfigFormErrors): ConfigFormErrors {
  return Object.fromEntries(
    Object.entries(errors).map(([field, messages]) => [field, [...messages]]),
  )
}

function equalErrors(left: ConfigFormErrors, right: ConfigFormErrors): boolean {
  const leftFields = Object.keys(left)
  const rightFields = Object.keys(right)
  return leftFields.length === rightFields.length && leftFields.every((field) => {
    const leftMessages = left[field]
    const rightMessages = right[field]
    return rightMessages !== undefined
      && leftMessages.length === rightMessages.length
      && leftMessages.every((message, index) => message === rightMessages[index])
  })
}

function shallowEqual<TValues extends ConfigFormValues>(left: TValues, right: TValues): boolean {
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  return leftKeys.length === rightKeys.length
    && leftKeys.every(key => Object.is(left[key], right[key]))
}

function setConfigFormValue(values: ConfigFormValues, field: string, value: unknown): void {
  Object.defineProperty(values, field, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  })
}
