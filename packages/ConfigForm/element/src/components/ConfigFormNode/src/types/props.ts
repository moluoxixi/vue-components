import type { ConfigFormColumnSpan, ConfigFormCondition, ConfigFormErrors, ConfigFormValues } from '@moluoxixi/config-form-headless'
import type { ElementConfigFormColProps, ElementConfigFormNode, ElementConfigFormReadonlyRender } from '../../../../types'

export interface ConfigFormNodeProps<TValues extends ConfigFormValues = ConfigFormValues> {
  /** 当前要递归渲染的字段或容器节点。 */
  node: ElementConfigFormNode<TValues>
  /** 当前表单模型，由根 ElementConfigForm 统一持有。 */
  model: TValues
  /** Headless 标准字段错误集合。 */
  errors: ConfigFormErrors
  /** 表单级 readonly。 */
  readonly?: ConfigFormCondition<TValues>
  /** 表单级只读展示 fallback。 */
  readonlyRender?: ElementConfigFormReadonlyRender<TValues>
  /** 顶层节点使用的默认列配置。 */
  colProps?: ElementConfigFormColProps
  /** 顶层节点使用的默认字段跨度。 */
  fieldSpan?: ConfigFormColumnSpan
  /** 是否为当前顶层节点包裹 Element Plus Col；grid 模式包列，inline/slot 子节点不包列。 */
  wrapCol?: boolean
}
