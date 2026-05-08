import type { Ref } from 'vue'
import type { FieldCondition, FieldConfig, FieldKey, FormErrors, FormNodeConfig, FormValues, NormalizedFieldConfig, ValidateTrigger } from '@/types'
import { computed, reactive, ref, toRaw, unref, watch } from 'vue'
import { applyFieldDefaults } from '@/plugins/builtInFieldDefaults'
import { applyFieldTransform, shouldValidateOn } from '@/utils/field'
import { collectFieldConfigs } from '@/utils/node'
import { validateFieldRules } from '@/utils/validate'

/** 无头表单控制器选项，驱动值状态、校验和提交流程。 */
export interface UseFormOptions<T extends object = FormValues> {
  /** 响应式节点树；只有真实字段节点会参与值、错误和提交。 */
  fields: Ref<FormNodeConfig[]>
  /** 表单初始值；仅在创建控制器时读取一次，后续外部替换不会覆盖内部编辑态。 */
  defaultValues?: Partial<T> | Ref<Partial<T> | undefined>
  /** 校验通过后接收已执行 transform 的提交值。 */
  onSubmit?: (values: T) => void
  /** 提交校验失败时接收当前错误集合。 */
  onError?: (errors: FormErrors) => void
}

/** 单字段交互校验的节流窗口，避免快速输入时频繁触发 schema 和 validator。 */
export const VALIDATION_THROTTLE_MS = 16

interface FieldValidationRequest {
  /** 当前请求要校验的字段名；执行时仍会读取最新字段配置。 */
  fieldName: string
  /** 触发来源决定 validateOn 过滤和隐藏/禁用字段的 submit 语义。 */
  trigger: ValidateTrigger
  /** 请求创建时的值快照，避免节流期间被无关写入隐式改写。 */
  valuesSnapshot: FormValues
  /** 同一节流窗口内被合并的调用方 Promise 端点。 */
  listeners: Array<{
    resolve: (value: boolean) => void
    reject: (reason?: unknown) => void
  }>
}

interface FieldValidationState {
  /** 待触发的节流计时器；存在时说明还没有开始执行校验链。 */
  timer?: ReturnType<typeof setTimeout>
  /** 当前字段的 schema + validator 链是否正在执行。 */
  running: boolean
  /** 当前字段等待执行的最新请求；旧请求会被合并到该请求的 listeners。 */
  pending?: FieldValidationRequest
}

/**
 * 创建 ConfigForm 的无头状态控制器。
 *
 * 负责字段值、校验错误、显隐/禁用映射、提交序列化、重置逻辑和组件 ref 暴露的方法。
 */
export function useForm<T extends object = FormValues>(options: UseFormOptions<T>) {
  const { fields, defaultValues, onSubmit, onError } = options

  // T 提供外部类型安全，Record 允许内部动态 key 访问。
  const values = reactive<T & FormValues>({} as T & FormValues)
  const valueStore = values as FormValues
  const errors = ref<FormErrors>({})
  const initialDefaultValues = { ...((unref(defaultValues) ?? {}) as FormValues) }
  const validationStates = new Map<string, FieldValidationState>()
  const fieldConfigs = computed(() =>
    collectFieldConfigs(fields.value).map(field => applyFieldDefaults(field) as NormalizedFieldConfig),
  )
  const fieldTopologyKey = computed(() => fieldConfigs.value.map(field => field.field).join('\0'))

  // 先同步校验初始字段拓扑，避免 Vue watcher 注册后才暴露重复 field 等配置错误。
  collectFieldConfigs(fields.value)

  /**
   * 清理字段错误状态。
   *
   * 不传 fieldName 时清空整张表单错误；传入字段名时只移除该字段，调用方负责保证字段名来自当前表单拓扑。
   */
  function clearFieldError(fieldName?: string) {
    if (!fieldName) {
      errors.value = {}
      return
    }
    if (errors.value[fieldName]) {
      const { [fieldName]: _, ...rest } = errors.value
      errors.value = rest
    }
  }

  /**
   * 将错误集合裁剪到当前真实字段集合。
   *
   * 字段拓扑变化时调用，避免已移除字段继续向视图暴露过期错误。
   */
  function syncErrorsToFields(fields: readonly Pick<FieldConfig, 'field'>[]) {
    const fieldNames = new Set(fields.map(field => field.field))
    const nextErrors = Object.fromEntries(
      Object.entries(errors.value).filter(([field]) => fieldNames.has(field)),
    )

    if (Object.keys(nextErrors).length !== Object.keys(errors.value).length)
      errors.value = nextErrors
  }

  /**
   * 初始化或重建内部表单值。
   *
   * 根据当前字段拓扑补全默认值并浅层同步到 reactive 存储。
   * pruneToFields 为 true 时移除不属于当前真实字段拓扑的值，用于字段树变化后的状态收敛。
   */
  function initValues(source: FormValues = initialDefaultValues, pruneToFields = false) {
    const transformedFields = fieldConfigs.value
    const fieldNames = new Set(transformedFields.map(field => field.field))
    const next: FormValues = pruneToFields
      ? Object.fromEntries(Object.entries(source).filter(([key]) => fieldNames.has(key)))
      : { ...source }

    for (const field of transformedFields) {
      if (!Object.hasOwn(next, field.field))
        next[field.field] = field.defaultValue !== undefined ? field.defaultValue : undefined
    }

    // 浅层同步 reactive 表单值：只增删改顶层字段，保留 Date、Dayjs 等实例引用。
    for (const key of Object.keys(values)) {
      if (!Object.hasOwn(next, key))
        delete valueStore[key]
    }
    for (const [key, val] of Object.entries(next)) {
      if (valueStore[key] !== val)
        valueStore[key] = val
    }
  }

  initValues()

  // 字段拓扑变化时裁剪值和错误到当前真实字段集合。
  watch(
    fieldTopologyKey,
    () => {
      initValues({ ...toRaw(values) }, true)
      syncErrorsToFields(fieldConfigs.value)
    },
  )

  const visibilityMap = computed<Record<string, boolean>>(() => {
    const valuesSnapshot = { ...values }
    return Object.fromEntries(fieldConfigs.value.map(f => [f.field, resolveCondition(f.visible, valuesSnapshot, true)]))
  })

  const disabledMap = computed<Record<string, boolean>>(() => {
    const valuesSnapshot = { ...values }
    return Object.fromEntries(fieldConfigs.value.map(f => [f.field, resolveCondition(f.disabled, valuesSnapshot, false)]))
  })

  /** 写入单个模型字段，并清除该字段已有校验错误。 */
  function setValue<K extends FieldKey<T>>(field: K, value: T[K]): void
  /** 写入运行时字符串字段，并清除该字段已有校验错误。 */
  function setValue(field: string, value: unknown): void
  /**
   * 写入单个字段值。
   *
   * 该函数不校验字段是否存在于当前拓扑，供组件事件和暴露 API 共享同一写入路径。
   */
  function setValue(field: string, value: unknown) {
    valueStore[field] = value
    clearFieldError(field)
  }

  /**
   * 批量写入模型值。
   *
   * replace 为 true 时按初始化语义重建默认值；否则仅覆盖传入字段并逐项清理错误。
   */
  function setValues(nextValues: Partial<T>, replace = false) {
    if (replace) {
      initValues(nextValues as FormValues)
    }
    else {
      for (const [key, val] of Object.entries(nextValues)) {
        valueStore[key] = val
        clearFieldError(key)
      }
    }
  }

  /** 读取类型化字段值，返回值类型由外部 T 推导。 */
  function getValue<K extends FieldKey<T>>(field: K): T[K]
  /** 读取运行时字符串字段值，未知字段返回 undefined。 */
  function getValue(field: string): unknown
  /**
   * 从内部值存储读取单个字段。
   *
   * 该函数不触发校验，也不重新执行字段转换，只返回当前模型层值。
   */
  function getValue(field: string): unknown {
    return valueStore[field]
  }

  /** 获取表单值的浅拷贝快照，保留 Date/Dayjs 等实例。 */
  function getValues(): T & FormValues {
    return { ...toRaw(values) } as T & FormValues
  }

  /** 获取字段校验状态，没有状态时创建独立队列。 */
  function getFieldValidationState(fieldName: string): FieldValidationState {
    const existing = validationStates.get(fieldName)
    if (existing)
      return existing

    const state: FieldValidationState = { running: false }
    validationStates.set(fieldName, state)
    return state
  }

  /** 为单次字段校验创建快照请求，确保节流期间不会被无关写入隐式改写。 */
  function createFieldValidationRequest(
    fieldName: string,
    trigger: ValidateTrigger,
    resolve: (value: boolean) => void,
    reject: (reason?: unknown) => void,
  ): FieldValidationRequest {
    return {
      fieldName,
      trigger,
      valuesSnapshot: { ...toRaw(values) },
      listeners: [{ resolve, reject }],
    }
  }

  /** 合并同一字段节流窗口内的旧请求，所有调用方共享最新请求的结果。 */
  function mergeFieldValidationRequest(
    previous: FieldValidationRequest,
    next: FieldValidationRequest,
  ): FieldValidationRequest {
    return {
      ...next,
      listeners: [...previous.listeners, ...next.listeners],
    }
  }

  /** 执行当前字段 pending 请求；调用方必须保证同一字段没有正在运行的校验链。 */
  function startPendingFieldValidation(fieldName: string): void {
    const state = getFieldValidationState(fieldName)
    if (state.running)
      return

    const request = state.pending
    state.pending = undefined
    if (!request) {
      if (!state.timer)
        validationStates.delete(fieldName)
      return
    }

    void runFieldValidationRequest(fieldName, request)
  }

  /** 安排字段校验启动；delayMs 为 0 时立即进入队列执行，不依赖计时器推进。 */
  function scheduleFieldValidation(fieldName: string, delayMs: number): void {
    const state = getFieldValidationState(fieldName)
    if (state.running)
      return

    if (state.timer) {
      clearTimeout(state.timer)
      state.timer = undefined
    }

    if (delayMs <= 0) {
      startPendingFieldValidation(fieldName)
      return
    }

    state.timer = setTimeout(() => {
      state.timer = undefined
      startPendingFieldValidation(fieldName)
    }, delayMs)
  }

  /** 运行单个字段的 schema + validator 链，并把结果或异常传回所有合并调用方。 */
  async function runFieldValidationRequest(
    fieldName: string,
    request: FieldValidationRequest,
  ): Promise<void> {
    const state = getFieldValidationState(fieldName)
    state.running = true

    try {
      const result = await executeFieldValidation(request.fieldName, request.trigger, request.valuesSnapshot)
      for (const listener of request.listeners)
        listener.resolve(result)
    }
    catch (error) {
      for (const listener of request.listeners)
        listener.reject(error)
    }
    finally {
      state.running = false
      if (state.pending) {
        scheduleFieldValidation(fieldName, VALIDATION_THROTTLE_MS)
      }
      else if (!state.timer) {
        validationStates.delete(fieldName)
      }
    }
  }

  /** 将单字段校验请求放入字段队列，保证同一字段同一时间只有一条校验链运行。 */
  function queueFieldValidation(
    fieldName: string,
    trigger: ValidateTrigger,
    delayMs: number,
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const state = getFieldValidationState(fieldName)
      const request = createFieldValidationRequest(fieldName, trigger, resolve, reject)
      state.pending = state.pending
        ? mergeFieldValidationRequest(state.pending, request)
        : request

      if (!state.running)
        scheduleFieldValidation(fieldName, delayMs)
    })
  }

  /**
   * 立即执行当前拓扑中的单个字段校验规则。
   *
   * 隐藏或禁用字段按提交配置决定是否跳过；schema 或 validator 抛错会原样透传给调用方。
   */
  async function executeFieldValidation(
    fieldName: string,
    trigger: ValidateTrigger,
    valuesSnapshot: FormValues,
  ): Promise<boolean> {
    const config = fieldConfigs.value.find(f => f.field === fieldName)
    const field = config as NormalizedFieldConfig | undefined
    if (!field?.schema && !field?.validator) {
      clearFieldError(fieldName)
      return true
    }

    const shouldValidateHidden = trigger === 'submit' && field.submitWhenHidden
    const shouldValidateDisabled = trigger === 'submit' && field.submitWhenDisabled

    if (
      (!resolveCondition(field.visible, valuesSnapshot, true) && !shouldValidateHidden)
      || (resolveCondition(field.disabled, valuesSnapshot, false) && !shouldValidateDisabled)
    ) {
      clearFieldError(fieldName)
      return true
    }

    if (!shouldValidateOn(field, trigger))
      return true

    const fieldErrors = await validateFieldRules(valuesSnapshot[fieldName], field.schema, valuesSnapshot, field.validator)
    if (fieldErrors.length > 0) {
      errors.value = { ...errors.value, [fieldName]: fieldErrors }
    }
    else {
      clearFieldError(fieldName)
    }

    return fieldErrors.length === 0
  }

  /**
   * 校验当前拓扑中的单个字段。
   *
   * 交互触发默认走字段级节流；同一字段已有校验链运行时会排队等待。
   */
  async function validateSingleField(fieldName: string, trigger: ValidateTrigger): Promise<boolean> {
    return queueFieldValidation(fieldName, trigger, VALIDATION_THROTTLE_MS)
  }

  /**
   * 执行整表提交级校验。
   *
   * 校验失败会同步 errors 并触发 onError；底层校验异常不转换为成功结果。
   */
  async function validate(): Promise<boolean> {
    const currentFields = fieldConfigs.value
    for (const field of currentFields)
      await queueFieldValidation(field.field, 'submit', 0)

    const currentFieldNames = new Set(currentFields.map(field => field.field))
    const formErrors = Object.fromEntries(
      Object.entries(errors.value).filter(([field]) => currentFieldNames.has(field)),
    )
    errors.value = formErrors
    if (Object.keys(formErrors).length > 0) {
      onError?.(formErrors)
      return false
    }
    return true
  }

  /**
   * 校验并提交可参与提交的字段值。
   *
   * 仅提交 visible/disabled 规则允许的真实字段，并在提交前执行字段 transform。
   */
  async function submit(): Promise<boolean> {
    if (!await validate())
      return false

    const valuesSnapshot = { ...values }
    const submitValues: FormValues = {}
    for (const field of fieldConfigs.value) {
      if (!resolveCondition(field.visible, valuesSnapshot, true) && !field.submitWhenHidden)
        continue
      if (resolveCondition(field.disabled, valuesSnapshot, false) && !field.submitWhenDisabled)
        continue
      submitValues[field.field] = applyFieldTransform(field, valuesSnapshot[field.field], valuesSnapshot)
    }
    onSubmit?.(submitValues as T)
    return true
  }

  /**
   * 重置内部值和错误状态。
   *
   * 重置后会回到创建控制器时的 defaultValues 快照，再补齐当前字段默认值。
   */
  function reset() {
    initValues(initialDefaultValues)
    errors.value = {}
  }

  return {
    values,
    errors,
    visibilityMap,
    disabledMap,
    validate,
    validateSingleField,
    submit,
    reset,
    setValue,
    setValues,
    getValue,
    getValues,
    clearFieldError,
  }
}

/** 解析字段显隐/禁用条件；函数条件的异常按原语义向调用方抛出。 */
function resolveCondition(
  condition: FieldCondition | undefined,
  values: FormValues,
  defaultValue: boolean,
): boolean {
  if (condition == null)
    return defaultValue
  if (typeof condition === 'boolean')
    return condition
  return condition(values)
}
