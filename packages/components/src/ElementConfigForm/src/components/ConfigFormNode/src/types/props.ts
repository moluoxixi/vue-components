import type { ConfigFormColumnSpan, ConfigFormValues } from '../../../../../../ConfigForm'
import type { ElementConfigFormColProps, ElementConfigFormNode } from '../../../../types'

export interface ConfigFormNodeProps<TValues extends ConfigFormValues = ConfigFormValues> {
  /** 当前要递归渲染的字段或容器节点。 */
  node: ElementConfigFormNode<TValues>
  /** 当前表单模型，由根 ElementConfigForm 统一持有。 */
  model: TValues
  /** 顶层节点使用的默认列配置。 */
  colProps?: ElementConfigFormColProps
  /** 顶层节点使用的默认字段跨度。 */
  fieldSpan?: ConfigFormColumnSpan
  /** 是否为当前节点包裹 Element Plus Col；slot 子节点默认不包列。 */
  wrapCol?: boolean
}
