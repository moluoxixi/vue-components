import type { ComponentInternalInstance, ComponentPublicInstance } from 'vue'

export type EnterNextVirtualRef = ComponentPublicInstance | ComponentInternalInstance | HTMLElement | null

/**
 * EnterNextContainer 的输入契约。
 */
export interface EnterNextContainerProps {
  /** 外部容器引用；未提供时监听组件默认插槽容器。 */
  virtualRef?: EnterNextVirtualRef
  /** 下拉组件没有高亮选项时，是否仍允许回车跳到下一个输入控件。 */
  allowSelectNextInEmpty?: boolean
  /** 挂载后默认聚焦的控件序号，沿用旧组件的一基序号。 */
  focusNum?: number
  /** 是否只在可用控件集合里计算默认聚焦位置。 */
  autoNext?: boolean
}
