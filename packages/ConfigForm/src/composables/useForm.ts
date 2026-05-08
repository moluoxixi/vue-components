import type { Ref } from 'vue'
import type { FieldCondition, FieldConfig, FieldKey, FormErrors, FormNodeConfig, FormValues, NormalizedFieldConfig, ValidateTrigger } from '@/types'
import { computed, reactive, ref, toRaw, watch } from 'vue'
import { applyFieldDefaults } from '@/plugins/builtInFieldDefaults'
import { applyFieldTransform, shouldValidateOn } from '@/utils/field'
import { collectFieldConfigs } from '@/utils/node'
import { validateFieldRules, validateForm } from '@/utils/validate'

/** 无头表单控制器选项，驱动值状态、校验和提交流程。 */
export interface UseFormOptions<T extends object = FormValues> {
  /** 响应式节点树；只有真实字段节点会参与值、错误和提交。 */
  fields: Ref<FormNodeConfig[]>
  /** 外部初始值，通常来自 ConfigForm 的 v-model。 */
  initialValues?: Ref<Partial<T> | undefined>
  /** 校验通过后接收已执行 transform 的提交值。 */
  onSubmit?: (values: T) => void
  /** 提交校验失败时接收当前错误集合。 */
  onError?: (errors: FormErrors) => void
}

/**
 * 创建 ConfigForm 的无头状态控制器。
 *
 * 负责字段值、校验错误、显隐/禁用映射、提交序列化、重置逻辑和组件 ref 暴露的方法。
 */
export function useForm<T extends object = FormValues>(options: UseFormOptions<T>) {
  const { fields, initialValues, onSubmit, onError } = options

  // T 提供外部类型安全，Record 允许内部动态 key 访问。
  const values = reactive<T & FormValues>({} as T & FormValues)
  const valueStore = values as FormValues
  const errors = ref<FormErrors>({})
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
  function initValues(source: FormValues = (initialValues?.value ?? {}) as FormValues, pruneToFields = false) {
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

  watch(
    () => initialValues?.value,
    source => initValues((source ?? {}) as FormValues),
    { immediate: true, deep: true },
  )

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

  /**
   * 校验当前拓扑中的单个字段。
   *
   * 隐藏或禁用字段按提交配置决定是否跳过；schema 或 validator 抛错会原样透传给调用方。
   */
  async function validateSingleField(fieldName: string, trigger: ValidateTrigger): Promise<boolean> {
    const config = fieldConfigs.value.find(f => f.field === fieldName)
    const field = config as NormalizedFieldConfig | undefined
    if (!field?.schema && !field?.validator) {
      clearFieldError(fieldName)
      return true
    }

    const valuesSnapshot = { ...values }

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
   * 执行整表提交级校验。
   *
   * 校验失败会同步 errors 并触发 onError；底层校验异常不转换为成功结果。
   */
  async function validate(): Promise<boolean> {
    const formErrors = await validateForm({ ...values }, fieldConfigs.value, 'submit')
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
   * 重置后会重新写入当前字段默认值，不保留外部 initialValues 的旧编辑态。
   */
  function reset() {
    initValues({})
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
