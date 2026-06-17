export interface SlotCompSlots {
  /** 默认内容 */
  default: () => any
  /** 表头插槽 */
  header: (scope: { title: string }) => any
  /** 按列名动态声明的单元格插槽 */
  [name: string]: ((scope: any) => any) | undefined
}
