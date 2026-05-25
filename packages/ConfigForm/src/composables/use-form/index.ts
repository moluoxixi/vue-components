import type { Ref } from 'vue'
import type { FieldKey, FormErrors, FormValues, NormalizedFieldConfig, ResolvedFormNode } from '@/types'
import { computed, watch } from 'vue'
import { applyFieldTransform } from '@/utils/field'
import { collectFieldConfigs, isFieldConfig } from '@/utils/node'
import { resolveValue } from '@/utils/resolvable'
import { useFormState } from './state'
import { createNodeTopology, createVisibilitySnapshot, resolveNodeVisibility } from './topology'
import { useFormValidation, VALIDATION_THROTTLE_MS } from './validation'

/** 无头表单控制器选项，驱动值状态、校验和提交流程。 */
export interface UseFormOptions<T extends object = FormValues> {
  /** ConfigForm 已解析完成的响应式节点树；只有真实字段节点会参与值、错误和提交。 */
  fields: Ref<ResolvedFormNode[]>
  /** 表单初始值；仅在创建控制器时读取一次，后续外部替换不会覆盖内部编辑态。 */
  defaultValues?: Partial<T> | Ref<Partial<T> | undefined>
  /** 校验通过后接收已执行 transform 的提交值。 */
  onSubmit?: (values: T) => void
  /** 提交校验失败时接收当前错误集合。 */
  onError?: (errors: FormErrors) => void
}

/**
 * 创建 ConfigForm 的无头状态控制器。
 *
 * 这个入口只负责编排状态、验证、拓扑和提交流程；纯计算逻辑下沉到更小的 helper。
 */
export function useForm<T extends object = FormValues>(options: UseFormOptions<T>) {
  const { fields, defaultValues, onSubmit, onError } = options

  const nodeTopology = computed(() => createNodeTopology(fields.value))
  const fieldConfigs = computed(() => collectFieldConfigs(fields.value) as NormalizedFieldConfig[])
  const fieldConfigMap = computed(() => new Map(fieldConfigs.value.map(field => [field.field, field] as const)))
  const fieldTopologyKey = computed(() => fieldConfigs.value.map(field => field.field).join('\0'))

  // 先同步校验初始字段拓扑，避免 Vue watcher 注册后才暴露重复 field 等配置错误。
  collectFieldConfigs(fields.value)
  createNodeTopology(fields.value)

  const {
    values,
    errors,
    initValues,
    syncErrorsToFields,
    clearFieldError,
    setValue: setStateValue,
    setValues: setStateValues,
    getValue: getStateValue,
    getValues,
    reset,
  } = useFormState<T>({
    defaultValues,
    fields: fieldConfigs,
  })

  const {
    validate,
    validateSingleField,
  } = useFormValidation({
    clearFieldError,
    errors,
    fieldConfigMap,
    fields: fieldConfigs,
    nodeTopology,
    onError,
    values: values as FormValues,
  })

  // 字段拓扑变化时裁剪值和错误到当前真实字段集合。
  watch(
    fieldTopologyKey,
    () => {
      initValues({ ...values }, true)
      syncErrorsToFields()
    },
  )

  /** 读取当前字段树中任意节点的有效可见性；未知节点保持可见，避免误伤外部临时节点。 */
  function isVisible(field: ResolvedFormNode): boolean {
    const topology = nodeTopology.value
    if (!topology.nodes.has(field))
      return true

    return resolveNodeVisibility(field, values as FormValues, topology)
  }

  /** 即时解析字段禁用态；容器节点不拥有禁用语义，始终返回 false。 */
  function isDisabled(field: ResolvedFormNode): boolean {
    if (!isFieldConfig(field))
      return false

    return resolveValue(field.disabled, values as FormValues, false)
  }

  /** 即时解析字段只读态；容器节点不拥有只读语义，始终返回 false。 */
  function isReadonly(field: ResolvedFormNode): boolean {
    if (!isFieldConfig(field))
      return false

    return resolveValue(field.readonly, values as FormValues, false)
  }

  /** 校验并提交可参与提交的字段值。 */
  async function submit(): Promise<boolean> {
    if (!await validate())
      return false

    const valuesSnapshot = { ...values } as FormValues
    const visibility = createVisibilitySnapshot(valuesSnapshot, nodeTopology.value)
    const submitValues: FormValues = {}

    for (const field of fieldConfigs.value) {
      if (!visibility.byField.get(field.field) && !field.submitWhenHidden)
        continue
      if (resolveValue(field.readonly, valuesSnapshot, false)) {
        submitValues[field.field] = applyFieldTransform(field, valuesSnapshot[field.field], valuesSnapshot)
        continue
      }
      if (resolveValue(field.disabled, valuesSnapshot, false) && !field.submitWhenDisabled)
        continue
      submitValues[field.field] = applyFieldTransform(field, valuesSnapshot[field.field], valuesSnapshot)
    }

    onSubmit?.(submitValues as T)
    return true
  }

  /** 写入单个模型字段，并清除该字段已有校验错误。 */
  function setValue<K extends FieldKey<T>>(field: K, value: T[K]): void
  /** 写入运行时字符串字段，并清除该字段已有校验错误。 */
  function setValue(field: string, value: unknown): void
  /** 写入单个字段值。 */
  function setValue(field: string, value: unknown) {
    setStateValue(field, value)
  }

  /** 批量写入模型值。 */
  function setValues(nextValues: Partial<T>, replace = false) {
    setStateValues(nextValues, replace)
  }

  /** 读取类型化字段值，返回值类型由外部 T 推导。 */
  function getValue<K extends FieldKey<T>>(field: K): T[K]
  /** 读取运行时字符串字段值，未知字段返回 undefined。 */
  function getValue(field: string): unknown
  /** 从内部值存储读取单个字段。 */
  function getValue(field: string): unknown {
    return getStateValue(field)
  }

  return {
    values,
    errors,
    isVisible,
    isDisabled,
    isReadonly,
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

export { VALIDATION_THROTTLE_MS }
