<script setup lang="ts">
import type { DateRangePickerEmits, DateRangePickerModelValue, DateRangePickerProps, DateRangePickerShortcut, DateRangePickerType } from './types'
import dayjs from 'dayjs'
import { ElDatePicker } from 'element-plus'
import { computed, shallowRef, watch } from 'vue'
import {
  createDefaultTime,
  formatDateRangeValue,
  isDatetimePickerType,
  isEmptyDatePickerValue,
  resolveOutputFormats,
  toLocalPickerValue,
} from './utils'

defineOptions({
  name: 'DateRangePicker',
  inheritAttrs: false,
})

const props = withDefaults(defineProps<DateRangePickerProps>(), {
  type: 'date',
  format: undefined,
  valueFormat: 'YYYY-MM-DD HH:mm:ss',
  placeholder: '请选择日期',
  startPlaceholder: '开始日期',
  endPlaceholder: '结束日期',
  rangeSeparator: '至',
  modelValue: () => [],
  outputFormat: undefined,
  defaultToday: true,
  dateRange: undefined,
  dateRangeType: 'day',
  dateRangeBaseDate: () => dayjs().toDate(),
  minDate: '0001-01-01 00:00:00',
  maxDate: '9999-12-31 23:59:59',
  disabledDateRange: undefined,
  datetimeDisableTypes: () => ['hours', 'minutes', 'seconds'],
  shortcuts: false,
})

const emit = defineEmits<DateRangePickerEmits>()

const localDateValue = shallowRef<DateRangePickerModelValue>([])
let hasInitialized = false

const pickerType = computed<DateRangePickerType>(() => props.type as DateRangePickerType)

const outputFormats = computed<[string, string]>(() => {
  return resolveOutputFormats(pickerType.value, props.outputFormat)
})

const displayFormat = computed<string>(() => {
  return props.format ?? (isDatetimePickerType(pickerType.value) ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD')
})

const defaultTime = computed<[Date, Date] | undefined>(() => {
  return isDatetimePickerType(pickerType.value) ? createDefaultTime() : undefined
})

const defaultShortcuts: DateRangePickerShortcut[] = [
  {
    text: '今天',
    value: () => [dayjs().toDate(), dayjs().toDate()],
  },
  {
    text: '三天',
    value: () => [dayjs().subtract(2, 'day').toDate(), dayjs().toDate()],
  },
  {
    text: '一周',
    value: () => [dayjs().subtract(1, 'week').toDate(), dayjs().toDate()],
  },
  {
    text: '一个月',
    value: () => [dayjs().subtract(1, 'month').toDate(), dayjs().toDate()],
  },
]

const shortcuts = computed<DateRangePickerShortcut[]>(() => {
  return props.shortcuts === true ? defaultShortcuts : props.shortcuts || []
})

const disabledBoundary = computed(() => {
  const range = props.disabledDateRange
  return {
    min: range ? range[0] : props.minDate,
    max: range ? range[1] : props.maxDate,
  }
})

/**
 * 根据 dateRange/defaultToday 生成首次默认值；仅在外部未传值时生效。
 */
function createInitialValue(): DateRangePickerModelValue | undefined {
  const baseDate = dayjs(props.dateRangeBaseDate)

  /**
   * 初始值进入 DatePicker 前先转成 valueFormat 字符串。
   *
   * Element Plus 在声明 value-format 后以字符串作为绑定值；保持同一形态可避免 Date 被按字符串格式二次解析。
   */
  function formatInitialDate(date: dayjs.ConfigType): string {
    return dayjs(date).format(props.valueFormat)
  }

  if (props.dateRange !== undefined) {
    if (Array.isArray(props.dateRange)) {
      return [
        formatInitialDate(baseDate.add(props.dateRange[0], props.dateRangeType)),
        formatInitialDate(baseDate.add(props.dateRange[1], props.dateRangeType)),
      ]
    }

    if (props.dateRange >= 0)
      return [formatInitialDate(baseDate), formatInitialDate(baseDate.add(props.dateRange, props.dateRangeType))]

    return [formatInitialDate(baseDate.add(props.dateRange, props.dateRangeType)), formatInitialDate(baseDate)]
  }

  if (props.defaultToday)
    return [formatInitialDate(dayjs()), formatInitialDate(dayjs())]

  return undefined
}

/**
 * 向调用方同步格式化后的值，同时保持单日期/范围日期的输出形态一致。
 */
function emitFormattedValue(value: DateRangePickerModelValue): void {
  const formattedValue = formatDateRangeValue(
    value,
    pickerType.value,
    outputFormats.value,
    props.valueFormat,
  )
  emit('update:modelValue', formattedValue)
  emit('change', formattedValue)
}

function handleDateChange(value: DateRangePickerModelValue): void {
  emitFormattedValue(value)
}

function disabledDate(date: Date): boolean {
  const current = dayjs(date).startOf('day').valueOf()
  const min = disabledBoundary.value.min
  const max = disabledBoundary.value.max

  return current < dayjs(min).startOf('day').valueOf() || current > dayjs(max).startOf('day').valueOf()
}

function disabledUnitValues(unit: 'hour' | 'minute' | 'second', limit: number, edge: string): number[] {
  const value = localDateValue.value
  const currentRaw = Array.isArray(value) ? value[edge === 'start' ? 0 : 1] : value
  const current = dayjs(currentRaw, props.valueFormat)
  const min = disabledBoundary.value.min
  const max = disabledBoundary.value.max
  const values = Array.from({ length: limit }, (_, index) => index)

  return values.filter((item) => {
    const beforeMin = current.isSame(dayjs(min), 'day') && item < dayjs(min).get(unit)
    const afterMax = current.isSame(dayjs(max), 'day') && item > dayjs(max).get(unit)
    return beforeMin || afterMax
  })
}

function disabledHours(role: string): number[] {
  if (!props.datetimeDisableTypes.includes('hours'))
    return []

  return disabledUnitValues('hour', 24, role)
}

function disabledMinutes(_: number, role: string): number[] {
  if (!props.datetimeDisableTypes.includes('minutes'))
    return []

  return disabledUnitValues('minute', 60, role)
}

function disabledSeconds(_: number, __: number, role: string): number[] {
  if (!props.datetimeDisableTypes.includes('seconds'))
    return []

  return disabledUnitValues('second', 60, role)
}

watch(
  () => props.modelValue,
  (value) => {
    if (isEmptyDatePickerValue(value)) {
      if (!hasInitialized) {
        hasInitialized = true
        const initialValue = createInitialValue()
        if (initialValue) {
          localDateValue.value = toLocalPickerValue(initialValue, pickerType.value)
          emitFormattedValue(initialValue)
          return
        }
      }

      localDateValue.value = []
      return
    }

    hasInitialized = true
    localDateValue.value = toLocalPickerValue(value, pickerType.value)
  },
  { immediate: true, deep: true },
)
</script>

<template>
  <div class="mx-date-range-picker">
    <ElDatePicker
      v-bind="$attrs"
      v-model="localDateValue"
      class="mx-date-range-picker__control"
      :format="displayFormat"
      :value-format="props.valueFormat"
      :default-time="defaultTime"
      :placeholder="props.placeholder"
      :start-placeholder="props.startPlaceholder"
      :end-placeholder="props.endPlaceholder"
      :range-separator="props.rangeSeparator"
      :type="pickerType"
      :disabled-date="disabledDate"
      :disabled-hours="disabledHours"
      :disabled-minutes="disabledMinutes"
      :disabled-seconds="disabledSeconds"
      :shortcuts="shortcuts"
      @change="handleDateChange"
    />
  </div>
</template>

<style scoped>
.mx-date-range-picker {
  display: inline-block;
  width: 100%;
}

.mx-date-range-picker__control {
  width: 100%;
}
</style>
