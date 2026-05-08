import type { FormNodeConfig, NormalizedFieldConfig, NormalizedNodeConfig } from '@/types'
import { normalizeValidateOn } from '@/utils/field'
import { hasFieldBinding } from './utils'

/** 所有节点共用的标准化：props 保证非空，并保留原始 slots。 */
export function normalizeNode(node: FormNodeConfig): NormalizedNodeConfig {
  return {
    ...node,
    props: { ...(node.props ?? {}) },
  } as NormalizedNodeConfig
}

/** 有值绑定的节点补全绑定、校验和提交相关默认值。 */
export function normalizeFieldBinding(
  node: NormalizedNodeConfig & { field: string },
): NormalizedFieldConfig {
  const trigger = (node as Partial<NormalizedFieldConfig>).trigger ?? 'update:modelValue'
  const blurTrigger = (node as Partial<NormalizedFieldConfig>).blurTrigger ?? 'blur'

  if (trigger === blurTrigger) {
    throw new Error(
      `Field "${node.field}" cannot use the same event for trigger and blurTrigger: ${trigger}`,
    )
  }

  return {
    ...node,
    blurTrigger,
    span: (node as Partial<NormalizedFieldConfig>).span ?? 24,
    submitWhenDisabled: (node as Partial<NormalizedFieldConfig>).submitWhenDisabled ?? true,
    submitWhenHidden: (node as Partial<NormalizedFieldConfig>).submitWhenHidden ?? false,
    trigger,
    validateOn: normalizeValidateOn((node as Partial<NormalizedFieldConfig>).validateOn),
    valueProp: (node as Partial<NormalizedFieldConfig>).valueProp ?? 'modelValue',
  }
}

/** 补齐节点内置默认值，不执行插件转换或递归 slot 处理。 */
export function resolveField(field: FormNodeConfig): NormalizedNodeConfig {
  const node = normalizeNode(field)
  return hasFieldBinding(node)
    ? normalizeFieldBinding(node as NormalizedNodeConfig & { field: string })
    : node
}
