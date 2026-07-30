import type { ConfigFormColumnSpan, ConfigFormValues } from '@moluoxixi/config-form-core'
import type { AntdConfigFormColProps, AntdConfigFormNode, AntdConfigFormRowProps } from '../../../../types'

export interface FormLayoutProps<TValues extends ConfigFormValues = ConfigFormValues> {
  /** 顶层表单节点列表；布局层只负责排列，不解析校验规则。 */
  nodes: AntdConfigFormNode<TValues>[]
  /** 当前表单模型，由根 antdConfigForm 统一持有。 */
  model: TValues
  /** 是否使用行内布局；行内布局只渲染 Row，不为顶层节点包裹 Col。 */
  inlineLayout?: boolean
  /** 透传给 Ant Design Vue Row 的 props。 */
  rowProps?: AntdConfigFormRowProps
  /** 透传给顶层 Ant Design Vue Col 的默认 props。 */
  colProps?: AntdConfigFormColProps
  /** 顶层节点未声明 span 时使用的默认跨度。 */
  fieldSpan?: ConfigFormColumnSpan
}
