import type { InputInstance, InputProps, PopoverProps } from 'element-plus'
import type { ComponentInternalInstance, ComponentPublicInstance } from 'vue'
import type { ScheduleOptions } from '../../../utils'

export type PopoverTableRow = Record<string, any>
export type PopoverTableVirtualRef = ComponentPublicInstance | ComponentInternalInstance | InputInstance | HTMLElement | null
export type PopoverTablePopType = 'default' | 'input'
export type PopoverTableSuccessiveShowType = 'enter' | 'input'
export type PopoverTableSelectTrigger = 'click' | 'dblclick' | 'none'
export type ThrottleOrDebounceOptions = ScheduleOptions & { promise?: boolean }

export interface PopoverTableColumn {
  /** 行字段名，兼容旧 DraggableTable/vxe-grid 的 field。 */
  field: string
  /** 表头标题，兼容旧列配置 title。 */
  title?: string
  /** 表头标题，兼容常见 table 配置 label。 */
  label?: string
  width?: number | string
  minWidth?: number | string
  align?: 'left' | 'center' | 'right'
  /** 兼容旧组件通过 slots.default 指定单元格插槽。 */
  slots?: {
    default?: string
    header?: string
  }
  /** 单元格格式化函数。 */
  formatter?: (params: {
    row: PopoverTableRow
    column: PopoverTableColumn
    rowIndex: number
    columnIndex: number
    value: any
  }) => any
}

export type ColumnType = PopoverTableColumn

/**
 * PopoverTableSelect 外层组件契约。
 */
export interface PopoverTableSelectProps {
  debounce?: number
  throttle?: number
  options?: ThrottleOrDebounceOptions
  popType?: PopoverTablePopType
  placeholder?: string
  popoverProps?: Partial<PopoverProps>
  inputProps?: Partial<InputProps>
  inputValue?: string
  virtualRef?: PopoverTableVirtualRef
  successiveShowType?: PopoverTableSuccessiveShowType
  onInput?: (value: string) => void
  enableLoadMore?: boolean
  hasMore?: boolean
  loading?: boolean
}

/**
 * PopoverTableSelectBase 的表格与弹层契约。
 */
export interface PopoverTableSelectBaseProps {
  width?: number | string
  placement?: PopoverProps['placement']
  virtualRef: PopoverTableVirtualRef
  popoverProps?: Partial<PopoverProps>
  height?: string | number
  id?: string
  columns?: PopoverTableColumn[]
  data?: PopoverTableRow[]
  selectTrigger?: PopoverTableSelectTrigger
  zIndex?: number
  loading?: boolean
  scrollY?: { enabled: boolean, threshold: number }
}
