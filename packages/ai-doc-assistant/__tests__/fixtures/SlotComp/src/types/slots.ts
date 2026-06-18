interface FooterSlotScope {
  title: string
}

export interface SlotCompSlots {
  /** 默认内容 */
  default: () => any
  /** 表头插槽 */
  header: (scope: { title: string }) => any
  /** 页脚插槽 */
  footer: (scope: FooterSlotScope) => any
  /** 按列名动态声明的单元格插槽 */
  [name: string]: ((scope: { row: { id: string }, columnIndex: number }) => any) | ((scope: FooterSlotScope) => any) | undefined
}
