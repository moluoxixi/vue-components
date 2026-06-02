import type {
  ConfigFormColumnSpan,
  ConfigFormValues,
} from '../../../../../../ConfigForm'
import type {
  ElementConfigFormColProps,
  ElementConfigFormNode,
  ElementConfigFormRowProps,
} from '../../../../types'

export interface FormLayoutProps<TValues extends ConfigFormValues = ConfigFormValues> {
  /** 顶层表单节点列表；布局层只负责排列，不解析校验规则。 */
  nodes: ElementConfigFormNode<TValues>[]
  /** 当前表单模型，由根 ElementConfigForm 统一持有。 */
  model: TValues
  /** 透传给 Element Plus Row 的 props。 */
  rowProps?: ElementConfigFormRowProps
  /** 透传给顶层 Element Plus Col 的默认 props。 */
  colProps?: ElementConfigFormColProps
  /** 顶层节点未声明 span 时使用的默认跨度。 */
  fieldSpan?: ConfigFormColumnSpan
}
