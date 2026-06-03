import type { ComputedRef, Ref } from 'vue'
import type { NodeTopology, VisibilitySnapshot } from './topology'
import type { FormErrors, FormValues, NormalizedFieldConfig, ValidateTrigger } from '@/types'
import { toRaw } from 'vue'
import { shouldValidateOn } from '@/utils/field'
import { resolveValue } from '@/utils/resolvable'
import { validateFieldRules } from '@/utils/validate'
import { createVisibilitySnapshot, filterErrorsByFieldNames } from './topology'

/** 单字段交互校验的节流窗口，避免快速输入时频繁触发 schema 和 validator。 */
export const VALIDATION_THROTTLE_MS = 16

interface FieldValidationRequest {
  /** 当前请求要校验的字段名；执行时仍会读取最新字段配置。 */
  fieldName: string
  /** 触发来源决定 validateOn 过滤和隐藏/禁用字段的 submit 语义。 */
  trigger: ValidateTrigger
  /** 请求创建时的值快照，避免节流期间被无关写入隐式改写。 */
  valuesSnapshot: FormValues
  /** 提交级校验复用的可见性快照；交互校验按请求即时创建。 */
  visibilitySnapshot?: VisibilitySnapshot
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

/** 校验控制器输入。 */
export interface UseFormValidationOptions {
  /** 当前规范化字段拓扑。 */
  fields: ComputedRef<NormalizedFieldConfig[]>
  /** 真实字段名到规范化字段配置的索引。 */
  fieldConfigMap: ComputedRef<Map<string, NormalizedFieldConfig>>
  /** 当前字段树拓扑。 */
  nodeTopology: ComputedRef<NodeTopology>
  /** 当前表单值存储。 */
  values: FormValues
  /** 当前错误集合。 */
  errors: Ref<FormErrors>
  /** 单字段错误清理入口。 */
  clearFieldError: (fieldName?: string) => void
  /** 提交级校验失败时的回调。 */
  onError?: (errors: FormErrors) => void
}

/** 校验控制器输出。 */
export interface UseFormValidationResult {
  validate: (context?: SubmitValidationContext) => Promise<boolean>
  validateSingleField: (fieldName: string, trigger: ValidateTrigger) => Promise<boolean>
}

/** 提交入口创建的稳定校验快照，供 validate 和 submit 输出阶段共用。 */
export interface SubmitValidationContext {
  valuesSnapshot: FormValues
  visibilitySnapshot: VisibilitySnapshot
}

/**
 * 创建单字段与整表校验控制器。
 *
 * 这层只负责校验队列、节流和错误写入，不触碰 submit 和状态初始化。
 */
export function useFormValidation(options: UseFormValidationOptions): UseFormValidationResult {
  const { fields, fieldConfigMap, nodeTopology, values, errors, clearFieldError, onError } = options
  const validationStates = new Map<string, FieldValidationState>()

  /** 按字段名读取有效可见性，供校验和提交流程复用同一套父链规则。 */
  function isFieldVisible(fieldName: string, visibility: VisibilitySnapshot): boolean {
    const visible = visibility.byField.get(fieldName)
    return visible ?? true
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
    context?: SubmitValidationContext,
  ): FieldValidationRequest {
    return {
      fieldName,
      trigger,
      valuesSnapshot: context?.valuesSnapshot ?? { ...toRaw(values) },
      visibilitySnapshot: context?.visibilitySnapshot,
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

  /** 运行单个字段的 schema + validator 链，并把结果或异常传回所有合并调用方。 */
  async function runFieldValidationRequest(
    fieldName: string,
    request: FieldValidationRequest,
  ): Promise<void> {
    const state = getFieldValidationState(fieldName)
    state.running = true

    try {
      const result = await executeFieldValidation(
        request.fieldName,
        request.trigger,
        request.valuesSnapshot,
        request.visibilitySnapshot,
      )
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

  /** 将单字段校验请求放入字段队列，保证同一字段同一时间只有一条校验链运行。 */
  function queueFieldValidation(
    fieldName: string,
    trigger: ValidateTrigger,
    delayMs: number,
    context?: SubmitValidationContext,
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const state = getFieldValidationState(fieldName)
      const request = createFieldValidationRequest(fieldName, trigger, resolve, reject, context)
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
    visibilitySnapshot?: VisibilitySnapshot,
  ): Promise<boolean> {
    const config = fieldConfigMap.value.get(fieldName)
    const field = config as NormalizedFieldConfig | undefined
    if (!field?.required && !field?.schema && !field?.validator) {
      clearFieldError(fieldName)
      return true
    }

    const shouldValidateHidden = trigger === 'submit' && field.submitWhenHidden
    const shouldValidateDisabled = trigger === 'submit' && field.submitWhenDisabled

    const visibility = visibilitySnapshot ?? createVisibilitySnapshot(valuesSnapshot, nodeTopology.value)
    const fieldVisible = isFieldVisible(fieldName, visibility)

    if (!fieldVisible && !shouldValidateHidden) {
      clearFieldError(fieldName)
      return true
    }

    if (resolveValue(field.readonly, valuesSnapshot, false)) {
      clearFieldError(fieldName)
      return true
    }

    if (resolveValue(field.disabled, valuesSnapshot, false) && !shouldValidateDisabled) {
      clearFieldError(fieldName)
      return true
    }

    if (!shouldValidateOn(field, trigger))
      return true

    const fieldErrors = await validateFieldRules(
      valuesSnapshot[fieldName],
      field.schema,
      valuesSnapshot,
      field.validator,
      field.required,
      field.requiredMessage,
    )
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
  async function validate(context?: SubmitValidationContext): Promise<boolean> {
    const currentFields = fields.value
    let submitContext = context
    if (!submitContext) {
      const valuesSnapshot = { ...toRaw(values) }
      submitContext = {
        valuesSnapshot,
        visibilitySnapshot: createVisibilitySnapshot(valuesSnapshot, nodeTopology.value),
      }
    }

    await Promise.all(currentFields.map(field => queueFieldValidation(field.field, 'submit', 0, submitContext)))

    const formErrors = filterErrorsByFieldNames(errors.value, currentFields.map(field => field.field))
    errors.value = formErrors
    if (Object.keys(formErrors).length > 0) {
      onError?.(formErrors)
      return false
    }
    return true
  }

  return {
    validate,
    validateSingleField,
  }
}
