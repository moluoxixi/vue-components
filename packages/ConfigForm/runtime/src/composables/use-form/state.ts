import type { Reactive, Ref } from 'vue'
import type { FormErrors, FormValues, NormalizedFieldConfig } from '@/types'
import { reactive, ref, toRaw, unref } from 'vue'
import { buildNextFormValues, filterErrorsByFieldNames, syncValueStore } from './topology'

/** 无头表单状态选项，负责 values、errors 和默认值快照。 */
export interface UseFormStateOptions<T extends object = FormValues> {
  /** 当前已规范化的字段拓扑；只读取 field / defaultValue。 */
  fields: Ref<readonly Pick<NormalizedFieldConfig, 'defaultValue' | 'field'>[]>
  /** 表单初始值；仅在创建状态时读取一次，后续外部替换不会覆盖内部编辑态。 */
  defaultValues?: Partial<T> | Ref<Partial<T> | undefined>
}

export interface FormValueChange {
  fieldName: string
  present: boolean
  requiresFullSnapshot: boolean
  revision: number
  value: unknown
}

/** 无头表单状态控制器。 */
export interface UseFormStateResult<T extends object = FormValues> {
  values: Reactive<T & FormValues>
  errors: Ref<FormErrors>
  getFieldRevision: (fieldName: string) => number
  getValueChangesSince: (revision: number) => FormValueChange[] | undefined
  getValuesRevision: () => number
  setValueChangeRetention: (revision: number | undefined) => void
  initValues: (source?: FormValues, pruneToFields?: boolean) => void
  syncErrorsToFields: () => void
  clearFieldError: (fieldName?: string) => void
  setValue: {
    <K extends keyof T & string>(field: K, value: T[K]): void
    (field: string, value: unknown): void
  }
  setValues: (nextValues: Partial<T>, replace?: boolean) => void
  getValue: {
    <K extends keyof T & string>(field: K): T[K]
    (field: string): unknown
  }
  getValues: () => T & FormValues
  reset: () => void
}

/**
 * 创建 ConfigForm 的值与错误状态。
 *
 * 这个层只处理状态初始化、写入和错误收敛，不碰 validation queue 或 submit 语义。
 */
export function useFormState<T extends object = FormValues>(options: UseFormStateOptions<T>): UseFormStateResult<T> {
  const { fields, defaultValues } = options

  const fieldRevisions = new Map<string, number>()
  let trackedFieldNames = new Set(fields.value.map(field => field.field))
  const valueChanges: FormValueChange[] = []
  let firstRetainedChangeIndex = 0
  let retainedChangesAfterRevision = 0
  let retainValueChanges = false
  let valuesRevision = 0

  function recordValueChange(
    fieldName: string,
    value: unknown,
    present: boolean,
    requiresFullSnapshot = false,
  ): void {
    valuesRevision += 1
    if (trackedFieldNames.has(fieldName))
      fieldRevisions.set(fieldName, (fieldRevisions.get(fieldName) ?? 0) + 1)
    if (retainValueChanges) {
      valueChanges.push({ fieldName, present, requiresFullSnapshot, revision: valuesRevision, value })
    }
    else {
      retainedChangesAfterRevision = valuesRevision
    }
  }

  const trackedValues = new Proxy({} as T & FormValues, {
    defineProperty(target, key, descriptor) {
      const result = Reflect.defineProperty(target, key, descriptor)
      if (result && typeof key === 'string') {
        const nextDescriptor = Reflect.getOwnPropertyDescriptor(target, key)
        const isEnumerable = nextDescriptor?.enumerable === true
        const isAccessor = nextDescriptor !== undefined && !('value' in nextDescriptor)
        recordValueChange(
          key,
          isAccessor ? undefined : nextDescriptor?.value,
          isEnumerable,
          isAccessor,
        )
      }
      return result
    },
    deleteProperty(target, key) {
      const hadValue = typeof key === 'string' && Object.hasOwn(target, key)
      const result = Reflect.deleteProperty(target, key)
      if (result && hadValue)
        recordValueChange(key, undefined, false)
      return result
    },
    set(target, key, value) {
      const hadValue = typeof key === 'string' && Object.hasOwn(target, key)
      const previous = typeof key === 'string' ? target[key] : undefined
      const result = Reflect.set(target, key, value)
      if (result && typeof key === 'string' && (!hadValue || !Object.is(previous, value))) {
        const nextDescriptor = Reflect.getOwnPropertyDescriptor(target, key)
        const isAccessor = nextDescriptor !== undefined && !('value' in nextDescriptor)
        recordValueChange(
          key,
          isAccessor ? undefined : nextDescriptor?.value,
          nextDescriptor?.enumerable === true,
          isAccessor,
        )
      }
      return result
    },
  })

  // T 提供外部类型安全，Record 允许内部动态 key 访问。
  const values = reactive<T & FormValues>(trackedValues)
  const valueStore = values as FormValues
  const errors = ref<FormErrors>({})
  const initialDefaultValues = { ...((unref(defaultValues) ?? {}) as FormValues) }

  function getFieldRevision(fieldName: string): number {
    return fieldRevisions.get(fieldName) ?? 0
  }

  function getValuesRevision(): number {
    return valuesRevision
  }

  function getValueChangesSince(revision: number): FormValueChange[] | undefined {
    if (revision < retainedChangesAfterRevision)
      return undefined

    const offset = Math.max(0, revision - retainedChangesAfterRevision)
    return valueChanges.slice(firstRetainedChangeIndex + offset)
  }

  function pruneValueChangesThrough(revision: number): void {
    const nextRetainedRevision = Math.min(revision, valuesRevision)
    if (nextRetainedRevision <= retainedChangesAfterRevision)
      return

    firstRetainedChangeIndex += nextRetainedRevision - retainedChangesAfterRevision
    retainedChangesAfterRevision = nextRetainedRevision
    if (firstRetainedChangeIndex >= valueChanges.length) {
      valueChanges.length = 0
      firstRetainedChangeIndex = 0
    }
    else if (firstRetainedChangeIndex >= 1024 && firstRetainedChangeIndex * 2 >= valueChanges.length) {
      valueChanges.splice(0, firstRetainedChangeIndex)
      firstRetainedChangeIndex = 0
    }
  }

  /** 只在 pending 交互校验需要刷新快照时保留变更日志。 */
  function setValueChangeRetention(revision: number | undefined): void {
    if (revision === undefined) {
      retainValueChanges = false
      pruneValueChangesThrough(valuesRevision)
      return
    }

    pruneValueChangesThrough(revision)
    retainValueChanges = true
  }

  /** 初始化或重建内部表单值。 */
  function initValues(source: FormValues = initialDefaultValues, pruneToFields = false) {
    const nextTrackedFieldNames = new Set(fields.value.map(field => field.field))
    const next = buildNextFormValues(source, fields.value, pruneToFields)
    syncValueStore(valueStore, next)
    trackedFieldNames = nextTrackedFieldNames
    for (const fieldName of fieldRevisions.keys()) {
      if (!trackedFieldNames.has(fieldName))
        fieldRevisions.delete(fieldName)
    }
  }

  initValues()
  setValueChangeRetention(undefined)

  /** 清理字段错误状态。 */
  function clearFieldError(fieldName?: string) {
    if (fieldName === undefined) {
      errors.value = {}
      return
    }

    if (errors.value[fieldName]) {
      const { [fieldName]: _, ...rest } = errors.value
      errors.value = rest
    }
  }

  /** 将错误集合裁剪到当前真实字段集合。 */
  function syncErrorsToFields() {
    const nextErrors = filterErrorsByFieldNames(errors.value, fields.value.map(field => field.field))

    if (Object.keys(nextErrors).length !== Object.keys(errors.value).length)
      errors.value = nextErrors
  }

  /** 写入单个字段值并清除其错误。 */
  function setValue(field: string, value: unknown) {
    valueStore[field] = value
    clearFieldError(field)
  }

  /** 批量写入字段值；replace 为 true 时按初始化语义重建默认值。 */
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

  /** 从内部值存储读取单个字段。 */
  function getValue(field: string): unknown {
    return valueStore[field]
  }

  /** 获取表单值的浅拷贝快照，保留 Date/Dayjs 等实例。 */
  function getValues(): T & FormValues {
    return { ...toRaw(values) } as T & FormValues
  }

  /** 重置内部值和错误状态。 */
  function reset() {
    initValues(initialDefaultValues)
    errors.value = {}
  }

  return {
    values,
    errors,
    getFieldRevision,
    getValueChangesSince,
    getValuesRevision,
    setValueChangeRetention,
    initValues,
    syncErrorsToFields,
    clearFieldError,
    setValue,
    setValues,
    getValue,
    getValues,
    reset,
  }
}
