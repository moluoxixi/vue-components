import type { DateRangePickerOutputValue } from './props'

/**
 * DateRangePicker 的事件契约。
 */
export interface DateRangePickerEmits {
  /** 绑定值更新时触发，单日期返回字符串，范围返回字符串数组。 */
  (event: 'update:modelValue', value: DateRangePickerOutputValue): void
  /** 用户确认选择时触发，返回值形态与 v-model 一致。 */
  (event: 'change', value: DateRangePickerOutputValue): void
}
