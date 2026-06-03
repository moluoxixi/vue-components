import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { EnterNextContainer } from './index'

async function waitForContainerMounted(): Promise<void> {
  await nextTick()
  await nextTick()
}

describe('enter next container', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('按 Enter 将焦点移动到下一个可用控件并在末尾触发事件', async () => {
    const wrapper = mount(EnterNextContainer, {
      attachTo: document.body,
      props: {
        focusNum: 1,
      },
      slots: {
        default: `
          <input data-testid="first" />
          <input data-testid="second" />
          <textarea data-testid="third"></textarea>
        `,
      },
    })

    await waitForContainerMounted()

    const first = wrapper.get<HTMLInputElement>('[data-testid="first"]')
    const second = wrapper.get<HTMLInputElement>('[data-testid="second"]')
    const third = wrapper.get<HTMLTextAreaElement>('[data-testid="third"]')

    expect(document.activeElement).toBe(first.element)

    await first.trigger('keyup', { key: 'Enter' })
    expect(document.activeElement).toBe(second.element)

    await second.trigger('keyup', { key: 'Enter' })
    expect(document.activeElement).toBe(third.element)

    await third.trigger('keyup', { key: 'Enter' })
    expect(wrapper.emitted('noNextInput')![0]).toEqual([third.element])
  })

  it('下拉控件展开但没有活动选项时暴露 noSelectValue', async () => {
    const wrapper = mount(EnterNextContainer, {
      attachTo: document.body,
      slots: {
        default: `
          <input aria-expanded="true" data-testid="select-like" />
          <input data-testid="next" />
        `,
      },
    })

    await waitForContainerMounted()

    const selectLike = wrapper.get<HTMLInputElement>('[data-testid="select-like"]')
    selectLike.element.focus()

    await selectLike.trigger('keyup', { key: 'Enter' })

    expect(wrapper.emitted('noSelectValue')![0]).toEqual([selectLike.element])
    expect(document.activeElement).toBe(selectLike.element)
  })

  it('virtualRef 组件实例缺少 DOM 节点时抛出明确错误', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const wrapper = mount(EnterNextContainer, {
      attachTo: document.body,
      props: {
        virtualRef: host,
      },
    })

    await waitForContainerMounted()

    await expect(wrapper.setProps({
      virtualRef: { $el: null } as any,
    })).rejects.toThrow('[EnterNextContainer] A DOM element is required before collecting inputs.')
  })
})
