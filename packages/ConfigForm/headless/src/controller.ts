import type { Component } from 'vue'
import type {
  ConfigFormCondition,
  ConfigFormErrors,
  ConfigFormFieldChangePayload,
  ConfigFormFieldChangeRequest,
  ConfigFormFieldKey,
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
  const initialValues = createInitialValues()

  if (!shallowEqual(options.model.read(), initialValues))
    options.model.write({ ...initialValues })

  function readFields(): ControllerNode<TValues>[] {
    return options.fields?.() ?? []
  }

  function readFormReadonly(): ConfigFormCondition<TValues> | undefined {
    return options.readonly?.()
  }

  function createInitialValues(): TValues {
    const defaults = Object.fromEntries(
      collectAllConfigFormFields(readFields())
        .filter(field => field.defaultValue !== undefined)
        .map(field => [field.field, field.defaultValue]),
    )

    return {
      ...defaults,
      ...options.model.read(),
      ...options.defaultValues,
    } as TValues
  }

  function getValues(): TValues {
    return { ...options.model.read() }
  }

  function getValue(field: string): unknown {
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
    options.onChange?.(values)
  }

  function setValue(field: string, value: unknown): void {
    const values = {
      ...options.model.read(),
      [field]: value,
    } as TValues

    invalidateValidation()
    clearFieldError(field)
    options.model.write(values)
    options.onFieldChange?.({ field, value, values })
    options.onChange?.(values)
  }

  function setValues(values: Partial<TValues>, replace = false): void {
    commitValues(
      (replace ? values : { ...options.model.read(), ...values }) as TValues,
      Object.keys(values),
    )
  }

  function applyFieldChange(request: ConfigFormFieldChangeRequest<TValues>): void {
    setValue(request.field, request.value)
    void validateField(request.field, 'change')
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
      const results = await Promise.all(activeStates.map(async state => [
        state.field.field,
        await validateConfigFormFieldRules(
          values[state.field.field],
          values,
          state.field,
        ),
      ] as const))

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
      commitValues(createResetValues())
      return
    }

    const values = { ...options.model.read() } as ConfigFormValues
    const resetValues = createResetValues() as ConfigFormValues
    fieldNames.forEach((field) => {
      if (Object.hasOwn(resetValues, field))
        values[field] = resetValues[field]
      else
        delete values[field]
    })
    commitValues(values as TValues, fieldNames)
  }

  async function submit(): Promise<boolean> {
    const values = getValues()
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
    const values = { ...initialValues } as ConfigFormValues
    collectAllConfigFormFields(readFields()).forEach((field) => {
      if (!Object.hasOwn(values, field.field) && field.defaultValue !== undefined)
        values[field.field] = field.defaultValue
    })
    return values as TValues
  }

  return {
    applyFieldChange,
    clearValidate,
    getErrors,
    getValidating,
    getValue: getValue as ConfigFormController<TValues>['getValue'],
    getValues,
    isFieldValidating,
    resetFields,
    setValue: setValue as ConfigFormController<TValues>['setValue'],
    setValues: setValues as ConfigFormController<TValues>['setValues'],
    submit,
    validate,
    validateField,
  }
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
