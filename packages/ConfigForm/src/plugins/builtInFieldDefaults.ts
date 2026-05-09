import type { ComponentNodeConfig, FieldConfig, FormNodeConfig, NormalizedFieldConfig, NormalizedNodeConfig, ResolvedSlotContent, SlotContent, ValidateTrigger } from '@/types'
import { hasFieldBinding } from '@/runtime/utils'

export const BUILT_IN_FIELD_DEFAULTS_PLUGIN_NAME = 'config-form:built-in-field-defaults'

/** resolveField(field) 返回的内置默认配置片段；不包含用户字段声明内容。 */
export interface FieldDefaultConfig {
  /** 所有节点默认保证 props 是普通对象，便于后续插件和组件消费。 */
  props: Record<string, unknown>
  /** 字段节点默认保证 rootProps 是普通对象，专供 FormField 根节点消费。 */
  rootProps?: Record<string, unknown>
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

/** 已应用内置默认片段后，渲染层消费的节点一定具备 span。 */
type DefaultedNodeConfig<TSlot extends SlotContent | ResolvedSlotContent = SlotContent> = Omit<NormalizedNodeConfig, 'slots'> & {
  /** 已按当前处理阶段约束的 slot 内容。 */
  slots?: Record<string, TSlot>
  /** 字段和容器节点进入渲染层前一定具备 span。 */
  span: number
}

type DefaultedFieldConfig<TSlot extends SlotContent | ResolvedSlotContent = SlotContent> = Omit<NormalizedFieldConfig, 'slots'> & {
  /** 已按当前处理阶段约束的 slot 内容。 */
  slots?: Record<string, TSlot>
}

/** 可应用默认值的节点配置；slot 类型由调用阶段决定，raw 和 resolved 阶段互不混用。 */
export type DefaultableFormNodeConfig<TSlot extends SlotContent | ResolvedSlotContent = SlotContent>
  = | (Omit<ComponentNodeConfig, 'slots'> & { slots?: Record<string, TSlot> })
    | (Omit<FieldConfig, 'slots'> & { slots?: Record<string, TSlot> })

/** 已应用默认值后的节点配置；slot 类型保持调用阶段传入的约束。 */
export type DefaultedFormNodeConfig<TSlot extends SlotContent | ResolvedSlotContent = SlotContent>
  = DefaultedNodeConfig<TSlot> | DefaultedFieldConfig<TSlot>

type DefaultedFieldInput<TSlot extends SlotContent | ResolvedSlotContent = SlotContent>
  = DefaultedNodeConfig<TSlot>
    & { field: string }
    & Partial<Pick<
      FieldConfig,
      'blurTrigger' | 'rootProps' | 'submitWhenDisabled' | 'submitWhenHidden' | 'trigger' | 'validateOn' | 'valueProp'
    >>

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
    rootProps: {},
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
export function applyFieldDefaults<TSlot extends SlotContent | ResolvedSlotContent = SlotContent>(
  field: DefaultableFormNodeConfig<TSlot>,
): DefaultedFormNodeConfig<TSlot> {
  const defaults = resolveField(field)
  const normalizedNode: DefaultedNodeConfig<TSlot> = {
    ...defaults,
    ...field,
    span: field.span ?? defaults.span,
    props: {
      ...defaults.props,
      ...(field.props ?? {}),
    },
  }

  if (!hasDefaultedFieldBinding(normalizedNode))
    return normalizedNode

  return applyBindingDefaults(normalizedNode)
}

/** 对带 field 绑定的节点补齐绑定、校验和提交默认值，并校验事件配置冲突。 */
function applyBindingDefaults<TSlot extends SlotContent | ResolvedSlotContent>(
  field: DefaultedFieldInput<TSlot>,
): DefaultedFieldConfig<TSlot> {
  const trigger = field.trigger ?? 'update:modelValue'
  const blurTrigger = field.blurTrigger ?? 'blur'

  if (trigger === blurTrigger) {
    throw new Error(
      `Field "${field.field}" cannot use the same event for trigger and blurTrigger: ${trigger}`,
    )
  }

  return {
    ...field,
    blurTrigger,
    rootProps: { ...(field.rootProps ?? {}) },
    submitWhenDisabled: field.submitWhenDisabled ?? true,
    submitWhenHidden: field.submitWhenHidden ?? false,
    trigger,
    validateOn: normalizeValidateOn(field.validateOn),
    valueProp: field.valueProp ?? 'modelValue',
  }
}

/** 判断已补默认的节点是否携带真实字段绑定，同时保留 slot 阶段类型。 */
function hasDefaultedFieldBinding<TSlot extends SlotContent | ResolvedSlotContent>(
  node: DefaultedNodeConfig<TSlot>,
): node is DefaultedFieldInput<TSlot> {
  return hasFieldBinding(node)
}

/** 内置默认值插件优先级最低，由 runtime 在用户字段和用户插件之前读取。 */
export const BUILT_IN_FIELD_DEFAULTS_PLUGIN: BuiltInFieldDefaultsPlugin = {
  name: BUILT_IN_FIELD_DEFAULTS_PLUGIN_NAME,
  transformField: resolveField,
}
