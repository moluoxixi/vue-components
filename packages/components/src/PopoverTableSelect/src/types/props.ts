import type { InputInstance, InputProps, PopoverProps } from 'element-plus'
import type { ComponentInternalInstance, ComponentPublicInstance } from 'vue'
import type { ConfigTableColumn, ConfigTableRow } from '../../../ConfigTable'
import type { ScheduleOptions } from '../../../utils'

export type PopoverTableRow = ConfigTableRow
export type PopoverTableVirtualRef = ComponentPublicInstance | ComponentInternalInstance | InputInstance | HTMLElement | null
export type PopoverTablePopType = 'default' | 'input'
export type PopoverTableSuccessiveShowType = 'enter' | 'input'
export type PopoverTableSelectTrigger = 'click' | 'dblclick' | 'none'
export type ThrottleOrDebounceOptions = ScheduleOptions & { promise?: boolean }

export type PopoverTableColumn = ConfigTableColumn
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
