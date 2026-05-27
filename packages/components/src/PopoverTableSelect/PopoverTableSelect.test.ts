import type { PopoverTableRow } from './index'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { PopoverTableSelect } from './index'

const selectedRow: PopoverTableRow = {
  code: 'C-009',
  name: '测试仓',
}

const InputStub = defineComponent({
  name: 'ElInput',
  props: {
    modelValue: { type: String, default: '' },
    placeholder: { type: String, default: '' },
  },
  emits: ['blur', 'clear', 'focus', 'input', 'update:modelValue'],
  setup(props, { emit }) {
    /**
     * 模拟 Element Plus Input 的 v-model 与 input 事件双契约。
     * 外层组件依赖两者分别维护本地展示值和对外 inputValue。
     */
    function handleInput(event: Event): void {
      const value = (event.target as HTMLInputElement).value
      emit('update:modelValue', value)
      emit('input', value)
    }

    return () => h('div', { 'data-testid': 'input-stub' }, [
      h('input', {
        'data-testid': 'popover-input',
        'onBlur': () => emit('blur'),
        'onFocus': () => emit('focus'),
        'onInput': handleInput,
        'placeholder': props.placeholder,
        'value': props.modelValue,
      }),
      h('button', {
        'data-testid': 'clear-input',
        'onClick': () => emit('clear'),
        'type': 'button',
      }, 'clear'),
    ])
  },
})

const BaseStub = defineComponent({
  name: 'PopoverTableSelectBase',
  props: {
    loading: Boolean,
    modelValue: Boolean,
    popoverProps: { type: Object, default: () => ({}) },
    virtualRef: { type: Object, default: null },
  },
  emits: ['enter', 'scrollBoundary', 'select'],
  setup(props, { emit, slots }) {
    /**
     * 模拟弹层表格的三个关键用户动作：
     * 选择行、键盘确认行、滚动到底部。
     */
    return () => h('section', { 'data-testid': 'table-base-stub' }, [
      h('span', { 'data-testid': 'base-visible' }, props.modelValue ? 'open' : 'closed'),
      slots.default?.({ row: selectedRow, value: selectedRow.name }),
      h('button', {
        'data-testid': 'select-row',
        'onClick': () => emit('select', selectedRow),
        'type': 'button',
      }, 'select'),
      h('button', {
        'data-testid': 'enter-row',
        'onClick': () => emit('enter', selectedRow),
        'type': 'button',
      }, 'enter'),
      h('button', {
        'data-testid': 'load-more',
        'onClick': () => emit('scrollBoundary', { direction: 'bottom' }),
        'type': 'button',
      }, 'load more'),
    ])
  },
})

describe('popover table select', () => {
  it('同步输入值并透传弹层表格选择、确认和加载事件', async () => {
    const updateInputValue = vi.fn()
    const onInput = vi.fn()

    const wrapper = mount(PopoverTableSelect, {
      props: {
        'enableLoadMore': true,
        'hasMore': true,
        'inputValue': '初始仓库',
        'onInput': onInput,
        'onUpdate:inputValue': updateInputValue,
        'popType': 'input',
        'throttle': 0,
      },
      global: {
        stubs: {
          ElInput: InputStub,
          PopoverTableSelectBase: BaseStub,
        },
      },
    })

    await wrapper.get('[data-testid="popover-input"]').trigger('focus')
    expect(wrapper.get('[data-testid="base-visible"]').text()).toBe('open')

    await wrapper.get('[data-testid="popover-input"]').setValue('华南')
    await wrapper.get('[data-testid="select-row"]').trigger('click')
    await wrapper.get('[data-testid="enter-row"]').trigger('click')
    await wrapper.get('[data-testid="load-more"]').trigger('click')
    await wrapper.get('[data-testid="clear-input"]').trigger('click')

    expect(updateInputValue).toHaveBeenCalledWith('华南')
    expect(updateInputValue).toHaveBeenCalledWith('')
    expect(onInput).toHaveBeenCalledWith('华南')
    expect(wrapper.emitted('focus')![0]).toEqual([])
    expect(wrapper.emitted('input')).toEqual([[''], ['华南']])
    expect(wrapper.emitted('select')![0]).toEqual([selectedRow])
    expect(wrapper.emitted('enter')![0]).toEqual([selectedRow])
    expect(wrapper.emitted('loadMore')![0]).toEqual([])
    expect(wrapper.emitted('clear')![0]).toEqual([])
  })
})
