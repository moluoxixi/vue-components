import type { FormErrors, FormValues, NormalizedFieldConfig, ValidateTrigger } from '../../../types'
import type {
  FieldValidationRequest,
  FieldValidationResult,
  FieldValidationState,
  SubmitValidationContext,
  UseFormValidationOptions,
  UseFormValidationResult,
  VisibilitySnapshot,
} from '../types'
import { toRaw } from 'vue'
import { ConfigFormError } from '../../../errors'
import { resolveValue, shouldValidateOn, validateFieldRules } from '../../../utils'
import { createVisibilitySnapshot, filterErrorsByFieldNames, resolveNodeVisibility } from '../utils/topology'

/** 单字段交互校验的节流窗口，避免快速输入时频繁触发 schema 和 validator。 */
export const VALIDATION_THROTTLE_MS = 16

/** 复用旧 listener 容器并线性追加新 listener，避免突发请求累计复制数组。 */
export function appendValidationListeners<T>(previous: T[], next: readonly T[]): T[] {
  previous.push(...next)
  return previous
}

/**
 * 创建单字段与整表校验控制器。
 *
 * 这层只负责校验队列、节流和错误写入，不触碰 submit 和状态初始化。
 */
export function useFormValidation(options: UseFormValidationOptions): UseFormValidationResult {
  const {
    fields,
    fieldConfigMap,
    nodeTopology,
    values,
    errors,
    clearFieldError,
    getFieldRevision,
    getValueChangesSince,
    getValuesRevision,
    setValueChangeRetention,
    onError,
  } = options
  const validationStates = new Map<string, FieldValidationState>()
  const latestResultRequestByField = new Map<string, number>()
  const pendingSnapshotRevisionCounts = new Map<number, number>()
  let nextResultRequestId = 0
  let disposed = false

  function createDisposedError(): ConfigFormError {
    return new ConfigFormError(
      'CONFIG_FORM_VALIDATION_DISPOSED',
      'ConfigForm validation was disposed before completion',
    )
  }

  function rejectRequest(request: FieldValidationRequest, error: ConfigFormError): void {
    for (const listener of request.listeners)
      listener.reject(error)
    request.listeners.length = 0
  }

  function reserveResultCommit(fieldNames: readonly string[]): number {
    const requestId = ++nextResultRequestId
    for (const fieldName of fieldNames)
      latestResultRequestByField.set(fieldName, requestId)
    return requestId
  }

  function canCommitResult(fieldName: string, requestId: number): boolean {
    return latestResultRequestByField.get(fieldName) === requestId
  }

  function finishResultCommit(fieldName: string, requestId: number): void {
    if (canCommitResult(fieldName, requestId))
      latestResultRequestByField.delete(fieldName)
  }

  function invalidate(fieldName?: string): void {
    if (fieldName === undefined)
      latestResultRequestByField.clear()
    else
      latestResultRequestByField.delete(fieldName)
  }

  function retainsValueChanges(request: FieldValidationRequest): boolean {
    return request.trigger !== 'submit' && request.visibilitySnapshot === undefined
  }

  function syncValueChangeRetention(): void {
    // 请求序号只会随 valuesRevision 单调增加，因此 Map 的首个 key 始终是最早请求。
    const oldestPendingRevision = pendingSnapshotRevisionCounts.keys().next().value
    setValueChangeRetention(oldestPendingRevision)
  }

  function retainPendingSnapshot(request: FieldValidationRequest): void {
    if (!retainsValueChanges(request))
      return

    pendingSnapshotRevisionCounts.set(
      request.valuesRevision,
      (pendingSnapshotRevisionCounts.get(request.valuesRevision) ?? 0) + 1,
    )
    syncValueChangeRetention()
  }

  function releasePendingSnapshot(request: FieldValidationRequest, revision = request.valuesRevision): void {
    if (!retainsValueChanges(request))
      return

    const count = pendingSnapshotRevisionCounts.get(revision)
    if (count === undefined)
      return
    if (count === 1)
      pendingSnapshotRevisionCounts.delete(revision)
    else
      pendingSnapshotRevisionCounts.set(revision, count - 1)
    syncValueChangeRetention()
  }

  function refreshPendingValuesSnapshot(request: FieldValidationRequest): void {
    const currentRevision = getValuesRevision()
    if (request.incrementalSnapshot && request.valuesRevision === currentRevision)
      return

    const changes = getValueChangesSince(request.valuesRevision)
    if (
      !request.incrementalSnapshot
      || changes === undefined
      || changes.some(change => change.requiresFullSnapshot)
    ) {
      const snapshotRevision = currentRevision
      const nextSnapshot = { ...toRaw(values) }
      const revisionAfterSnapshot = getValuesRevision()
      request.valuesRevision = snapshotRevision
      if (revisionAfterSnapshot !== snapshotRevision) {
        const reentrantChanges = getValueChangesSince(snapshotRevision)
        if (reentrantChanges?.every(change => !change.requiresFullSnapshot)) {
          for (const change of reentrantChanges) {
            if (change.present)
              nextSnapshot[change.fieldName] = change.value
            else
              delete nextSnapshot[change.fieldName]
          }
          request.valuesRevision = revisionAfterSnapshot
        }
      }
      request.valuesSnapshot = nextSnapshot
      request.incrementalSnapshot = supportsIncrementalSnapshot()
    }
    else {
      for (const change of changes) {
        if (change.present)
          request.valuesSnapshot[change.fieldName] = change.value
        else
          delete request.valuesSnapshot[change.fieldName]
      }
      request.valuesRevision = currentRevision
    }
  }

  function supportsIncrementalSnapshot(): boolean {
    const rawValues = toRaw(values)
    return Reflect.ownKeys(rawValues).every((key) => {
      const descriptor = Reflect.getOwnPropertyDescriptor(rawValues, key)
      return descriptor?.enumerable !== true || 'value' in descriptor
    })
  }

  function writeFieldResult(fieldName: string, result: FieldValidationResult): void {
    if (result.errors.length > 0)
      errors.value = { ...errors.value, [fieldName]: result.errors }
    else
      clearFieldError(fieldName)
  }

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

    const state: FieldValidationState = { pending: [], pendingStartIndex: 0, running: false }
    validationStates.set(fieldName, state)
    return state
  }

  function getFirstPendingRequest(state: FieldValidationState): FieldValidationRequest | undefined {
    return state.pending[state.pendingStartIndex]
  }

  function takeFirstPendingRequest(state: FieldValidationState): FieldValidationRequest | undefined {
    const request = getFirstPendingRequest(state)
    if (!request)
      return undefined

    state.pendingStartIndex += 1
    if (state.pendingStartIndex >= state.pending.length) {
      state.pending.length = 0
      state.pendingStartIndex = 0
    }
    else if (state.pendingStartIndex >= 1024 && state.pendingStartIndex * 2 >= state.pending.length) {
      state.pending.splice(0, state.pendingStartIndex)
      state.pendingStartIndex = 0
    }
    return request
  }

  /** 为单次字段校验创建快照请求，确保节流期间不会被无关写入隐式改写。 */
  function createFieldValidationRequest(
    fieldName: string,
    trigger: ValidateTrigger,
    delayMs: number,
    resolve: (value: FieldValidationResult) => void,
    reject: (reason?: unknown) => void,
    context?: SubmitValidationContext,
    valuesSnapshot?: FormValues,
    incrementalSnapshot?: boolean,
    valuesRevision?: number,
  ): FieldValidationRequest {
    return {
      delayMs,
      fieldName,
      fieldRevision: getFieldRevision(fieldName),
      incrementalSnapshot: context === undefined
        ? (incrementalSnapshot ?? supportsIncrementalSnapshot())
        : false,
      trigger,
      valuesSnapshot: context?.valuesSnapshot ?? valuesSnapshot ?? { ...toRaw(values) },
      valuesRevision: valuesRevision ?? getValuesRevision(),
      visibilitySnapshot: context?.visibilitySnapshot,
      listeners: [{ resolve, reject }],
    }
  }

  /** 合并同一字段节流窗口内的旧请求，所有调用方共享最新请求的结果。 */
  function mergeFieldValidationRequest(
    previous: FieldValidationRequest,
    next: FieldValidationRequest,
  ): FieldValidationRequest {
    next.listeners = appendValidationListeners(previous.listeners, next.listeners)
    return next
  }

  /** 提交请求必须保留独立快照；只合并同 trigger、无提交上下文的交互请求。 */
  function canMergeFieldValidationRequest(
    previous: FieldValidationRequest,
    trigger: ValidateTrigger,
    context?: SubmitValidationContext,
  ): boolean {
    return trigger !== 'submit'
      && previous.trigger === trigger
      && previous.visibilitySnapshot === undefined
      && context?.visibilitySnapshot === undefined
  }

  /** 运行单个字段的 schema + validator 链，并把结果或异常传回所有合并调用方。 */
  async function runFieldValidationRequest(
    fieldName: string,
    request: FieldValidationRequest,
  ): Promise<void> {
    const state = getFieldValidationState(fieldName)
    state.running = true
    state.active = request

    try {
      const result = await executeFieldValidation(
        request.fieldName,
        request.trigger,
        request.valuesSnapshot,
        request.fieldRevision,
        request.visibilitySnapshot,
      )
      if (disposed)
        throw createDisposedError()
      for (const listener of request.listeners)
        listener.resolve(result)
    }
    catch (error) {
      for (const listener of request.listeners)
        listener.reject(error)
    }
    finally {
      state.active = undefined
      state.running = false
      if (disposed) {
        validationStates.delete(fieldName)
      }
      else if (getFirstPendingRequest(state)) {
        scheduleFieldValidation(fieldName, getFirstPendingRequest(state)?.delayMs ?? 0)
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

    const request = takeFirstPendingRequest(state)
    if (!request) {
      if (!state.timer)
        validationStates.delete(fieldName)
      return
    }

    releasePendingSnapshot(request)
    void runFieldValidationRequest(fieldName, request)
  }

  /** 将单字段校验请求放入字段队列，保证同一字段同一时间只有一条校验链运行。 */
  function queueFieldValidation(
    fieldName: string,
    trigger: ValidateTrigger,
    delayMs: number,
    context?: SubmitValidationContext,
  ): Promise<FieldValidationResult> {
    if (disposed)
      return Promise.reject(createDisposedError())

    return new Promise((resolve, reject) => {
      const state = getFieldValidationState(fieldName)
      const previous = state.pending.at(-1)
      if (previous && canMergeFieldValidationRequest(previous, trigger, context)) {
        const previousRevision = previous.valuesRevision
        refreshPendingValuesSnapshot(previous)
        if (previous.valuesRevision !== previousRevision) {
          releasePendingSnapshot(previous, previousRevision)
          retainPendingSnapshot(previous)
        }
        const request = createFieldValidationRequest(
          fieldName,
          trigger,
          delayMs,
          resolve,
          reject,
          context,
          previous.valuesSnapshot,
          previous.incrementalSnapshot,
          previous.valuesRevision,
        )
        state.pending[state.pending.length - 1] = mergeFieldValidationRequest(previous, request)
      }
      else {
        const request = createFieldValidationRequest(fieldName, trigger, delayMs, resolve, reject, context)
        state.pending.push(request)
        retainPendingSnapshot(request)
      }

      if (!state.running) {
        const nextDelay = delayMs <= 0 ? 0 : (getFirstPendingRequest(state)?.delayMs ?? 0)
        scheduleFieldValidation(fieldName, nextDelay)
      }
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
    fieldRevision: number,
    visibilitySnapshot?: VisibilitySnapshot,
  ): Promise<FieldValidationResult> {
    const config = fieldConfigMap.value.get(fieldName)
    const field = config as NormalizedFieldConfig | undefined
    if (!field?.required && !field?.schema && !field?.validator)
      return { errors: [], valid: true }

    const shouldValidateHidden = trigger === 'submit' && field.submitWhenHidden
    const shouldValidateDisabled = trigger === 'submit' && field.submitWhenDisabled

    const topology = nodeTopology.value
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
    if (disposed)
      throw createDisposedError()
    if (trigger !== 'submit' && (
      getFieldRevision(fieldName) !== fieldRevision
      || fieldConfigMap.value.get(fieldName) !== field
      || !Object.is(toRaw(values)[fieldName], valuesSnapshot[fieldName])
    )) {
      return { errors: [], valid: true }
    }

    return {
      errors: fieldErrors,
      valid: fieldErrors.length === 0,
    }
  }

  /**
   * 校验当前拓扑中的单个字段。
   *
   * 交互触发默认走字段级节流；同一字段已有校验链运行时会排队等待。
   */
  async function validateSingleField(fieldName: string, trigger: ValidateTrigger): Promise<boolean> {
    if (disposed)
      throw createDisposedError()

    const field = fieldConfigMap.value.get(fieldName)
    if (!field?.required && !field?.schema && !field?.validator) {
      invalidate(fieldName)
      clearFieldError(fieldName)
      return true
    }
    if (!shouldValidateOn(field, trigger)) {
      const topology = nodeTopology.value
      const node = topology.fieldNodeMap.get(fieldName)
      const fieldVisible = node ? resolveNodeVisibility(node, values, topology) : true
      if (
        !fieldVisible
        || resolveValue(field.readonly, values, false)
        || resolveValue(field.disabled, values, false)
      ) {
        invalidate(fieldName)
        clearFieldError(fieldName)
      }
      return true
    }

    const resultRequestId = reserveResultCommit([fieldName])
    try {
      const result = await queueFieldValidation(fieldName, trigger, VALIDATION_THROTTLE_MS)
      if (canCommitResult(fieldName, resultRequestId))
        writeFieldResult(fieldName, result)
      return result.valid
    }
    finally {
      finishResultCommit(fieldName, resultRequestId)
    }
  }

  function dispose(): void {
    if (disposed)
      return

    disposed = true
    latestResultRequestByField.clear()
    pendingSnapshotRevisionCounts.clear()
    setValueChangeRetention(undefined)
    const error = createDisposedError()
    for (const [fieldName, state] of validationStates.entries()) {
      if (state.timer) {
        clearTimeout(state.timer)
        state.timer = undefined
      }
      for (let index = state.pendingStartIndex; index < state.pending.length; index += 1)
        rejectRequest(state.pending[index], error)
      if (state.active)
        rejectRequest(state.active, error)
      state.pending.length = 0
      state.pendingStartIndex = 0
      if (!state.running)
        validationStates.delete(fieldName)
    }
  }

  /**
   * 执行整表提交级校验。
   *
   * 校验失败会同步 errors 并触发 onError；底层校验异常不转换为成功结果。
   */
  async function validate(context?: SubmitValidationContext): Promise<boolean> {
    if (disposed)
      throw createDisposedError()

    const currentFields = fields.value
    const fieldNames = currentFields.map(field => field.field)
    const resultRequestId = reserveResultCommit(fieldNames)
    try {
      let submitContext = context
      if (!submitContext) {
        const valuesSnapshot = { ...toRaw(values) }
        submitContext = {
          valuesSnapshot,
          visibilitySnapshot: createVisibilitySnapshot(valuesSnapshot, nodeTopology.value),
        }
      }

      const results = await Promise.all(
        currentFields.map(field => queueFieldValidation(field.field, 'submit', 0, submitContext)),
      )
      if (disposed)
        throw createDisposedError()

      const formErrors: FormErrors = {}
      const nextUiErrors = { ...errors.value }
      let shouldWriteUiErrors = false
      for (const [index, result] of results.entries()) {
        const fieldName = currentFields[index].field
        if (result.errors.length > 0)
          formErrors[fieldName] = result.errors
        if (!canCommitResult(fieldName, resultRequestId))
          continue

        shouldWriteUiErrors = true
        if (result.errors.length > 0)
          nextUiErrors[fieldName] = result.errors
        else
          delete nextUiErrors[fieldName]
      }
      if (shouldWriteUiErrors)
        errors.value = filterErrorsByFieldNames(nextUiErrors, fieldNames)
      if (Object.keys(formErrors).length > 0) {
        onError?.(formErrors)
        return false
      }
      return true
    }
    finally {
      for (const fieldName of fieldNames)
        finishResultCommit(fieldName, resultRequestId)
    }
  }

  return {
    dispose,
    invalidate,
    validate,
    validateSingleField,
  }
}
