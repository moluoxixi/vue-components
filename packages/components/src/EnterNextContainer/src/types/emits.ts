/**
 * EnterNextContainer 的事件契约。
 */
export interface EnterNextContainerEmits {
  /** 已经没有下一个输入控件时触发。 */
  (event: 'noNextInput', element: HTMLElement): void
  /** 下拉控件处于展开但未选中状态时触发。 */
  (event: 'noSelectValue', element: HTMLElement): void
}
