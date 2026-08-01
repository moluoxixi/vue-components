import type {
  ConfigFormColumnSpan,
  ConfigFormCondition,
  ConfigFormErrors,
  ConfigFormValues,
} from '@moluoxixi/config-form-headless'
import type {
  ElementConfigFormColProps,
  ElementConfigFormNode,
  ElementConfigFormReadonlyRender,
  ElementConfigFormRowProps,
} from '../../../../types'

export interface FormLayoutProps<TValues extends ConfigFormValues = ConfigFormValues> {
  /** 顶层表单节点列表；布局层只负责排列，不解析校验规则。 */
  nodes: ElementConfigFormNode<TValues>[]
  /** 当前表单模型，由根 ElementConfigForm 统一持有。 */
  model: TValues
  /** Headless 标准字段错误集合。 */
  errors: ConfigFormErrors
  /** 表单级 readonly。 */
  readonly?: ConfigFormCondition<TValues>
  /** 字段未声明 renderer 时使用的只读展示函数。 */
  readonlyRender?: ElementConfigFormReadonlyRender<TValues>
  /** 是否使用行内布局；行内布局只渲染 Row，不为顶层节点包裹 Col。 */
  inlineLayout?: boolean
  /** 透传给 Element Plus Row 的 props。 */
  rowProps?: ElementConfigFormRowProps
  /** 透传给顶层 Element Plus Col 的默认 props。 */
  colProps?: ElementConfigFormColProps
  /** 顶层节点未声明 span 时使用的默认跨度。 */
  fieldSpan?: ConfigFormColumnSpan
}
