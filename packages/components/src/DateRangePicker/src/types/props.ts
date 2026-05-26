import type { ConfigType, ManipulateType } from 'dayjs'
import type { DatePickerProps } from 'element-plus'

export type DateRangePickerScalar = string | number | Date
export type DateRangePickerModelValue = DateRangePickerScalar | string[] | number[] | Date[]
export type DateRangePickerOutputValue = string | string[]
export type DateRangePickerType = NonNullable<DatePickerProps['type']>
export interface DateRangePickerShortcut {
  text: string
  value: () => Date | Date[]
}
export type DateRangePickerDatetimeUnit = 'hours' | 'minutes' | 'seconds'

/**
 * DateRangePicker 对 Element Plus DatePicker 做业务层封装：
 * - 保留 Element Plus 的透传能力；
 * - 统一输出格式；
 * - 支持按配置生成初始时间范围。
 */
export interface DateRangePickerProps {
  /** 日期选择类型，支持 Element Plus DatePicker 的 type。 */
  type?: DatePickerProps['type']
  /** 展示在输入框中的格式。 */
  format?: string
  /** DatePicker 内部绑定格式，也是外部字符串入参的解析格式。 */
  valueFormat?: string
  /** 非范围选择时的占位内容。 */
  placeholder?: string
  /** 范围选择时开始日期的占位内容。 */
  startPlaceholder?: string
  /** 范围选择时结束日期的占位内容。 */
  endPlaceholder?: string
  /** 范围分隔符。 */
  rangeSeparator?: string
  /** 外部绑定值，单日期使用单值，范围使用数组。 */
  modelValue?: DateRangePickerModelValue
  /** 输出格式；数组分别对应开始值和结束值。 */
  outputFormat?: string | string[]
  /** 首次无值时是否自动使用今天作为默认值。 */
  defaultToday?: boolean
  /** 日期范围偏移配置，数字表示从今天向前/向后，数组表示起止偏移。 */
  dateRange?: number[] | number
  /** 日期范围偏移单位。 */
  dateRangeType?: ManipulateType
  /** 日期范围偏移的基准日期。 */
  dateRangeBaseDate?: ConfigType
  /** 最小可选日期。 */
  minDate?: ConfigType
  /** 最大可选日期。 */
  maxDate?: ConfigType
  /** 禁用日期范围，优先级高于 minDate/maxDate。 */
  disabledDateRange?: [ConfigType, ConfigType]
  /** datetime/datetimerange 下需要按边界禁用的时分秒单位。 */
  datetimeDisableTypes?: DateRangePickerDatetimeUnit[]
  /** 是否显示快捷项；true 使用默认快捷项，数组使用自定义快捷项。 */
  shortcuts?: boolean | DateRangePickerShortcut[]
}
