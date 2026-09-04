import type { FormNodeConfig, ResolvedSlotContent, SlotContent, ValidateTrigger } from '../../types'
import type {
  BuiltInFieldDefaultsPlugin,
  DefaultableFormNodeConfig,
  DefaultedFieldConfig,
  DefaultedFieldInput,
  DefaultedFormNodeConfig,
  DefaultedNodeConfig,
  FieldDefaultConfig,
} from './types'
import { ConfigFormError } from '../../errors'
import { hasFieldBinding } from '../../utils/node'

export const BUILT_IN_FIELD_DEFAULTS_PLUGIN_NAME = 'config-form:built-in-field-defaults'

/** 返回字段的内置默认配置片段，不合并用户声明，也不执行用户插件。 */
export function getFieldDefaults(field: FormNodeConfig): FieldDefaultConfig {
  const defaults: FieldDefaultConfig = {
    props: {},
    span: 24,
  }

  if (!hasFieldBinding(field))
    return defaults

  return {
    ...defaults,
    blurTrigger: 'blur',
    required: false,
    requiredMessage: '必填',
    submitWhenDisabled: false,
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
  const defaults = getFieldDefaults(field)
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
    throw new ConfigFormError(
      'CONFIG_FORM_TRIGGER_CONFLICT',
      `Field "${field.field}" cannot use the same event for trigger and blurTrigger: ${trigger}`,
      {
        blurTrigger,
        field: field.field,
        trigger,
      },
    )
  }

  return {
    ...field,
    blurTrigger,
    required: field.required ?? false,
    requiredMessage: field.requiredMessage ?? '必填',
    submitWhenDisabled: field.submitWhenDisabled ?? false,
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
  getDefaultField: getFieldDefaults,
}
