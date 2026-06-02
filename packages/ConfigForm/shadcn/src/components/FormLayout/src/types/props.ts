import type { ConfigFormColumnSpan, ConfigFormValues } from '@moluoxixi/config-form-core'
import type {
  ShadcnConfigFormColProps,
  ShadcnConfigFormErrors,
  ShadcnConfigFormNode,
  ShadcnConfigFormRowProps,
} from '../../../../types'

export interface FormLayoutProps<TValues extends ConfigFormValues = ConfigFormValues> {
  /** 顶层表单节点列表；布局层只负责排列，不解析校验规则。 */
  nodes: ShadcnConfigFormNode<TValues>[]
  /** 当前表单模型，由根 ShadcnConfigForm 统一持有。 */
  model: TValues
  /** 当前字段错误集合，由根 ShadcnConfigForm 统一持有。 */
  errors: ShadcnConfigFormErrors
  /** 是否使用行内布局；行内布局使用 flex 容器且不生成 grid cell。 */
  inlineLayout?: boolean
  /** 透传给 ShadcnConfigForm 布局容器的 props。 */
  rowProps?: ShadcnConfigFormRowProps
  /** 透传给顶层 grid cell 的默认 props；仅 grid 布局消费。 */
  colProps?: ShadcnConfigFormColProps
  /** 顶层节点未声明 span 时使用的默认跨度。 */
  fieldSpan?: ConfigFormColumnSpan
}
