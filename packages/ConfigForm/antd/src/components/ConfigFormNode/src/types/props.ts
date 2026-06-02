import type { ConfigFormColumnSpan, ConfigFormValues } from '@moluoxixi/config-form-core'
import type { AntdConfigFormColProps, AntdConfigFormNode } from '../../../../types'

export interface ConfigFormNodeProps<TValues extends ConfigFormValues = ConfigFormValues> {
  /** 当前要递归渲染的字段或容器节点。 */
  node: AntdConfigFormNode<TValues>
  /** 当前表单模型，由根 antdConfigForm 统一持有。 */
  model: TValues
  /** 顶层节点使用的默认列配置。 */
  colProps?: AntdConfigFormColProps
  /** 顶层节点使用的默认字段跨度。 */
  fieldSpan?: ConfigFormColumnSpan
  /** 是否为当前节点包裹 Ant Design Vue Col；slot 子节点默认不包列。 */
  wrapCol?: boolean
}
