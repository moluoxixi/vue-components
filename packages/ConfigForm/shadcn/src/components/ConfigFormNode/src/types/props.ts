import type { ConfigFormColumnSpan, ConfigFormValues } from '@moluoxixi/config-form-core'
import type { ShadcnConfigFormColProps, ShadcnConfigFormErrors, ShadcnConfigFormNode } from '../../../../types'

export interface ConfigFormNodeProps<TValues extends ConfigFormValues = ConfigFormValues> {
  /** 当前要递归渲染的字段或容器节点。 */
  node: ShadcnConfigFormNode<TValues>
  /** 当前表单模型，由根 ShadcnConfigForm 统一持有。 */
  model: TValues
  /** 当前字段错误集合，由根 ShadcnConfigForm 统一持有。 */
  errors: ShadcnConfigFormErrors
  /** 顶层节点使用的默认单元格配置。 */
  colProps?: ShadcnConfigFormColProps
  /** 顶层节点使用的默认字段跨度。 */
  fieldSpan?: ConfigFormColumnSpan
  /** 是否为当前顶层节点包裹 ShadcnConfigForm grid cell；grid 模式包 cell，inline/slot 子节点不包 cell。 */
  wrapCell?: boolean
}
