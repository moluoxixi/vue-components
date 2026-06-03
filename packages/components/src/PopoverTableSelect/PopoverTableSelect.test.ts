import type { PopoverTableRow } from './index'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { PopoverTableSelect } from './index'
import PopoverTableSelectBase from './src/base/index.vue'

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

function defineScrollMetrics(element: HTMLElement, metrics: { clientHeight: number, scrollHeight: number, scrollTop: number }): void {
  Object.defineProperties(element, {
    clientHeight: { configurable: true, value: metrics.clientHeight },
    scrollHeight: { configurable: true, value: metrics.scrollHeight },
    scrollTop: { configurable: true, value: metrics.scrollTop },
  })
}

function createVirtualInput(): HTMLInputElement {
  const input = document.createElement('input')
  document.body.append(input)
  return input
}

function createElPopoverStub(update: () => void) {
  return defineComponent({
    name: 'ElPopover',
    setup(_, { expose, slots }) {
      /**
       * 暴露 Element Plus popover 的定位更新链路，验证基座组件何时触发 popper update。
       */
      expose({
        popperRef: {
          popperInstanceRef: { update },
        },
      })

      return () => h('div', { 'data-testid': 'el-popover-stub' }, slots.default?.())
    },
  })
}

describe('popover table select', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.useRealTimers()
  })

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

  it('调度配置变化和组件卸载时取消尚未触发的选择事件', async () => {
    vi.useFakeTimers()
    const wrapper = mount(PopoverTableSelect, {
      props: {
        debounce: 20,
        popType: 'input',
        throttle: 0,
      },
      global: {
        stubs: {
          ElInput: InputStub,
          PopoverTableSelectBase: BaseStub,
        },
      },
    })

    await nextTick()
    await nextTick()

    await wrapper.get('[data-testid="select-row"]').trigger('click')
    expect(wrapper.emitted('select')).toBeUndefined()

    await wrapper.setProps({ debounce: 40 })
    vi.advanceTimersByTime(20)
    expect(wrapper.emitted('select')).toBeUndefined()

    await wrapper.get('[data-testid="select-row"]').trigger('click')
    wrapper.unmount()
    vi.advanceTimersByTime(40)

    expect(wrapper.emitted('select')).toBeUndefined()
  })

  it('隐藏状态下数据和列变化不会触发弹层定位更新', async () => {
    const update = vi.fn()
    const wrapper = mount(PopoverTableSelectBase, {
      props: {
        columns: [{ field: 'name' }],
        data: [{ name: '初始仓库' }],
        modelValue: false,
        virtualRef: createVirtualInput(),
      },
      global: {
        stubs: {
          ElPopover: createElPopoverStub(update),
        },
      },
    })

    await nextTick()
    await nextTick()
    expect(update).not.toHaveBeenCalled()

    await wrapper.setProps({
      columns: [{ field: 'name' }, { field: 'code' }],
      data: [{ code: 'C-001', name: '更新仓库' }],
    })
    await nextTick()
    await nextTick()
    expect(update).not.toHaveBeenCalled()

    await wrapper.setProps({ modelValue: true })
    await nextTick()
    await nextTick()

    expect(update).toHaveBeenCalledTimes(1)
  })

  it('滚动保持在底部边界时只触发一次加载边界事件', async () => {
    const wrapper = mount(PopoverTableSelectBase, {
      props: {
        columns: [{ field: 'name' }],
        data: [{ name: '初始仓库' }],
        modelValue: true,
        scrollY: { enabled: true, threshold: 0 },
        virtualRef: createVirtualInput(),
      },
      global: {
        stubs: {
          ElPopover: createElPopoverStub(vi.fn()),
        },
      },
    })
    const scrollWrap = wrapper.get('.mx-popover-table-select-base__table-wrap')

    defineScrollMetrics(scrollWrap.element as HTMLElement, {
      clientHeight: 100,
      scrollHeight: 200,
      scrollTop: 100,
    })
    await scrollWrap.trigger('scroll')
    await scrollWrap.trigger('scroll')

    expect(wrapper.emitted('scrollBoundary')).toEqual([[{ direction: 'bottom' }]])

    defineScrollMetrics(scrollWrap.element as HTMLElement, {
      clientHeight: 100,
      scrollHeight: 200,
      scrollTop: 20,
    })
    await scrollWrap.trigger('scroll')

    defineScrollMetrics(scrollWrap.element as HTMLElement, {
      clientHeight: 100,
      scrollHeight: 200,
      scrollTop: 100,
    })
    await scrollWrap.trigger('scroll')

    expect(wrapper.emitted('scrollBoundary')).toEqual([
      [{ direction: 'bottom' }],
      [{ direction: 'bottom' }],
    ])
  })
})
