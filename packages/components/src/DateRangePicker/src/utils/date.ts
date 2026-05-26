import type {
  DateRangePickerModelValue,
  DateRangePickerOutputValue,
  DateRangePickerScalar,
  DateRangePickerType,
} from '../types'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'

dayjs.extend(customParseFormat)

const RANGE_TYPES = new Set<DateRangePickerType>([
  'daterange',
  'datetimerange',
  'monthrange',
  'yearrange',
])
const DATETIME_TYPES = new Set<DateRangePickerType>([
  'datetime',
  'datetimerange',
])

type DateRangePickerValuePair = [DateRangePickerScalar, DateRangePickerScalar]

/**
 * 判断当前 DatePicker 类型是否输出范围值。
 */
export function isRangePickerType(type: DateRangePickerType): boolean {
  return RANGE_TYPES.has(type)
}

/**
 * 判断当前 DatePicker 类型是否包含时间面板。
 */
export function isDatetimePickerType(type: DateRangePickerType): boolean {
  return DATETIME_TYPES.has(type)
}

/**
 * 生成 Element Plus datetime 范围选择器的默认起止时间。
 */
export function createDefaultTime(): [Date, Date] {
  return [
    new Date(2000, 0, 1, 0, 0, 0),
    new Date(2000, 0, 1, 23, 59, 59),
  ]
}

/**
 * 根据组件类型推导默认输出格式。
 */
export function resolveOutputFormats(
  type: DateRangePickerType,
  outputFormat: string | string[] | undefined,
): [string, string] {
  if (Array.isArray(outputFormat))
    return [outputFormat[0], outputFormat[1]]

  if (outputFormat)
    return [outputFormat, outputFormat]

  if (isDatetimePickerType(type))
    return ['YYYY-MM-DD HH:mm:ss', 'YYYY-MM-DD HH:mm:ss']

  return ['YYYY-MM-DD 00:00:00', 'YYYY-MM-DD 23:59:59']
}

/**
 * 将单值输入规整成起止值，供范围格式化流程复用。
 */
export function toValuePair(value: DateRangePickerModelValue): DateRangePickerValuePair {
  if (Array.isArray(value))
    return [value[0], value[1]]

  return [value, value]
}

/**
 * 判断外部 modelValue 是否处于未选择状态。
 */
export function isEmptyDatePickerValue(value: DateRangePickerModelValue): boolean {
  if (Array.isArray(value))
    return value.length === 0

  return value === ''
}

/**
 * 按组件输出契约格式化起止日期。
 */
export function formatDateRangeValue(
  value: DateRangePickerModelValue,
  type: DateRangePickerType,
  outputFormats: [string, string],
  inputFormat: string,
): DateRangePickerOutputValue {
  const [start, end] = toValuePair(value)
  const formatted = [
    dayjs(start, inputFormat).format(outputFormats[0]),
    dayjs(end, inputFormat).format(outputFormats[1]),
  ]

  return isRangePickerType(type) ? formatted : formatted[0]
}

/**
 * 将外部值转换成 Element Plus DatePicker 的 v-model 形态。
 */
export function toLocalPickerValue(
  value: DateRangePickerModelValue,
  type: DateRangePickerType,
): DateRangePickerModelValue {
  if (isRangePickerType(type))
    return Array.isArray(value) ? value : [value, value] as string[] | number[] | Date[]

  return Array.isArray(value) ? value[0] : value
}
