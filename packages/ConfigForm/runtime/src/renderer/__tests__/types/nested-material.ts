import type { DesignerMaterialModuleRegistry, DesignerRegistry } from '@moluoxixi/config-form-designer'

/** 适配器参与嵌套物料集成套件所需提供的最小能力面。 */
export interface NestedMaterialProvider {
  /** 物料命名空间前缀，如 `element` / `antd`。 */
  prefix: string
  /** 创建一个带物料与属性控件的完整设计器注册表。 */
  createRegistry: () => DesignerRegistry
  /** 物料能力注册表：契约快照 + 运行时绑定解析。 */
  capabilities: DesignerMaterialModuleRegistry
  /** 该适配器真实输入控件的 DOM 选择器（readonly 切换后应消失）。 */
  inputSelector: string
}
