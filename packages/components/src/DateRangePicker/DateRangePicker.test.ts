import { mount } from '@vue/test-utils'
import dayjs from 'dayjs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { DateRangePicker } from './index'

const pickerChangeValue = [
  '2026-01-03 08:30:00',
  '2026-01-04 09:45:00',
]

const DatePickerStub = defineComponent({
  name: 'ElDatePicker',
  props: [
    'defaultTime',
    'format',
    'rangeSeparator',
    'shortcuts',
    'type',
    'valueFormat',
  ],
  emits: ['change'],
  setup(props, { emit }) {
    /**
     * 只模拟 Element Plus DatePicker 对外契约：
     * 接收封装组件透传配置，并在确认选择时发出 change。
     */
    function commitPickedValue(): void {
      emit('change', pickerChangeValue)
    }

    return () => h('button', {
      'data-format': props.format,
      'data-range-separator': props.rangeSeparator,
      'data-shortcut-count': (props.shortcuts as unknown[]).length,
      'data-testid': 'date-picker-stub',
      'data-type': props.type,
      'data-value-format': props.valueFormat,
      'onClick': commitPickedValue,
      'type': 'button',
    }, 'date picker')
  },
})

function mountDateRangePicker(props: Record<string, unknown>) {
  return mount(DateRangePicker, {
    props,
    global: {
      stubs: {
        ElDatePicker: DatePickerStub,
      },
    },
  })
}

describe('date range picker', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 26, 10, 30, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('无外部值时按默认日期范围向调用方同步格式化值', async () => {
    const wrapper = mountDateRangePicker({
      modelValue: [],
      type: 'daterange',
    })
    await nextTick()

    const expected = [
      dayjs().format('YYYY-MM-DD 00:00:00'),
      dayjs().format('YYYY-MM-DD 23:59:59'),
    ]

    expect(wrapper.emitted('update:modelValue')![0]).toEqual([expected])
    expect(wrapper.emitted('change')![0]).toEqual([expected])
  })

  it('向 DatePicker 透传显示配置并格式化用户选择结果', async () => {
    const wrapper = mountDateRangePicker({
      modelValue: ['2026-05-20 08:00:00', '2026-05-26 18:00:00'],
      shortcuts: true,
      type: 'datetimerange',
    })

    const picker = wrapper.get('[data-testid="date-picker-stub"]')

    expect(picker.attributes('data-type')).toBe('datetimerange')
    expect(picker.attributes('data-format')).toBe('YYYY-MM-DD HH:mm:ss')
    expect(picker.attributes('data-value-format')).toBe('YYYY-MM-DD HH:mm:ss')
    expect(picker.attributes('data-range-separator')).toBe('至')
    expect(picker.attributes('data-shortcut-count')).toBe('4')
    await picker.trigger('click')

    const expected = [
      '2026-01-03 08:30:00',
      '2026-01-04 09:45:00',
    ]

    expect(wrapper.emitted('update:modelValue')![0]).toEqual([expected])
    expect(wrapper.emitted('change')![0]).toEqual([expected])
  })
})
