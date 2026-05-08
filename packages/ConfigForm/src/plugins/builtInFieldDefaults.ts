import type { FormNodeConfig, NormalizedFieldConfig, NormalizedNodeConfig, ValidateTrigger } from '@/types'
import { hasFieldBinding } from '@/runtime/utils'

export const BUILT_IN_FIELD_DEFAULTS_PLUGIN_NAME = 'config-form:built-in-field-defaults'

/** resolveField(field) 返回的内置默认配置片段；不包含用户字段声明内容。 */
export interface FieldDefaultConfig {
  /** 所有节点默认保证 props 是普通对象，便于后续插件和组件消费。 */
  props: Record<string, unknown>
  /** 节点默认占满 24 列；字段和容器均可被用户声明覆盖。 */
  span: number
  /** 字段组件值属性默认名，仅对有 field 绑定的节点返回。 */
  valueProp?: string
  /** 字段组件值更新事件默认名，仅对有 field 绑定的节点返回。 */
  trigger?: string
  /** 字段组件 blur 事件默认名，仅对有 field 绑定的节点返回。 */
  blurTrigger?: string
  /** 字段校验触发默认值，仅对有 field 绑定的节点返回。 */
  validateOn?: ValidateTrigger[]
  /** 隐藏字段默认不参与提交，仅对有 field 绑定的节点返回。 */
  submitWhenHidden?: boolean
  /** 禁用字段默认参与提交，仅对有 field 绑定的节点返回。 */
  submitWhenDisabled?: boolean
}

/** 内置默认值插件契约；只产出默认片段，不合并用户 config 或用户插件 config。 */
export interface BuiltInFieldDefaultsPlugin {
  /** 插件名称固定用于测试和调试识别，不进入用户插件冲突检测。 */
  readonly name: typeof BUILT_IN_FIELD_DEFAULTS_PLUGIN_NAME
  /** 根据节点形态返回默认配置片段；不会读取或复制用户声明的业务字段。 */
  transformField: (field: FormNodeConfig) => FieldDefaultConfig
}

/** 返回字段的内置默认配置片段，不合并用户声明，也不执行用户插件。 */
export function resolveField(field: FormNodeConfig): FieldDefaultConfig {
  const defaults: FieldDefaultConfig = {
    props: {},
    span: 24,
  }

  if (!hasFieldBinding(field))
    return defaults

  return {
    ...defaults,
    blurTrigger: 'blur',
    submitWhenDisabled: true,
    submitWhenHidden: false,
    trigger: 'update:modelValue',
    validateOn: ['submit'],
    valueProp: 'modelValue',
  }
}

/** 将校验触发配置规范化为数组，并保证 submit 触发始终存在。 */
export function normalizeValidateOn(on?: ValidateTrigger | ValidateTrigger[]): ValidateTrigger[] {
  if (!on)
    return ['submit']
  const arr = Array.isArray(on) ? on : [on]
  return arr.includes('submit') ? arr : [...arr, 'submit']
}

/** 合并内置默认片段和当前字段配置，供 runtime 内部生成完整可消费字段。 */
export function applyFieldDefaults(field: FormNodeConfig): NormalizedNodeConfig {
  const defaults = resolveField(field)
  const normalizedNode = {
    ...defaults,
    ...field,
    props: {
      ...defaults.props,
      ...(field.props ?? {}),
    },
  } as NormalizedNodeConfig

  if (!hasFieldBinding(normalizedNode))
    return normalizedNode

  return applyBindingDefaults(normalizedNode as NormalizedNodeConfig & { field: string })
}

/** 对带 field 绑定的节点补齐绑定、校验和提交默认值，并校验事件配置冲突。 */
function applyBindingDefaults(field: NormalizedNodeConfig & { field: string }): NormalizedFieldConfig {
  const trigger = (field as Partial<NormalizedFieldConfig>).trigger ?? 'update:modelValue'
  const blurTrigger = (field as Partial<NormalizedFieldConfig>).blurTrigger ?? 'blur'

  if (trigger === blurTrigger) {
    throw new Error(
      `Field "${field.field}" cannot use the same event for trigger and blurTrigger: ${trigger}`,
    )
  }

  return {
    ...field,
    blurTrigger,
    span: (field as Partial<NormalizedFieldConfig>).span ?? 24,
    submitWhenDisabled: (field as Partial<NormalizedFieldConfig>).submitWhenDisabled ?? true,
    submitWhenHidden: (field as Partial<NormalizedFieldConfig>).submitWhenHidden ?? false,
    trigger,
    validateOn: normalizeValidateOn((field as Partial<NormalizedFieldConfig>).validateOn),
    valueProp: (field as Partial<NormalizedFieldConfig>).valueProp ?? 'modelValue',
  }
}

/** 内置默认值插件优先级最低，由 runtime 在用户字段和用户插件之前读取。 */
export const BUILT_IN_FIELD_DEFAULTS_PLUGIN: BuiltInFieldDefaultsPlugin = {
  name: BUILT_IN_FIELD_DEFAULTS_PLUGIN_NAME,
  transformField: resolveField,
}
