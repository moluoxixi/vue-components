/**
 * PopoverTableSelect 支持 default 插槽和按列声明的动态单元格插槽。
 */
export interface PopoverTableSelectSlots {
  default?: () => any
  [name: string]: ((params: any) => any) | undefined
}
