import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import WorkspaceTopbar from '../src/ui/App/components/WorkspaceTopbar/index.vue'

describe('workspace topbar', () => {
  it('按标准 tablist 键盘模型切换视图并移动焦点', async () => {
    const wrapper = mount(WorkspaceTopbar, {
      attachTo: document.body,
      props: {
        view: 'chat',
        statusLabel: '知识库可用',
        statusTone: 'success',
        statusDetail: '知识库可用',
        chatMissing: false,
        building: false,
        importing: false,
        showBuildAction: false,
        buildLabel: '更新知识库',
      },
    })
    const chat = wrapper.get('[data-testid="workspace-chat-tab"]')
    const knowledge = wrapper.get('[data-testid="workspace-knowledge-tab"]')

    expect(chat.attributes()).toMatchObject({ 'role': 'tab', 'aria-controls': 'workspace-chat-panel', 'tabindex': '0' })
    expect(knowledge.attributes('tabindex')).toBe('-1')

    ;(chat.element as HTMLElement).focus()
    await chat.trigger('keydown', { key: 'ArrowRight' })
    await flushPromises()
    expect(wrapper.emitted('select-view')?.at(-1)).toEqual(['knowledge'])
    expect(document.activeElement).toBe(knowledge.element)

    await knowledge.trigger('keydown', { key: 'Home' })
    await flushPromises()
    expect(wrapper.emitted('select-view')?.at(-1)).toEqual(['chat'])
    expect(document.activeElement).toBe(chat.element)

    await chat.trigger('keydown', { key: 'End' })
    await flushPromises()
    expect(wrapper.emitted('select-view')?.at(-1)).toEqual(['knowledge'])
    expect(document.activeElement).toBe(knowledge.element)

    wrapper.unmount()
  })
})
