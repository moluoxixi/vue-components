import type { Editor } from '@tiptap/core'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { h, nextTick } from 'vue'
import { RichTextEditor } from '../index'

async function mountEditor(props: Record<string, unknown> = {}, slots: Record<string, any> = {}) {
  const wrapper = mount(RichTextEditor, { props, slots })
  await nextTick()
  await flushPromises()
  return wrapper
}

function getEditor(wrapper: Awaited<ReturnType<typeof mountEditor>>): Editor {
  return (wrapper.vm as unknown as { editor: Editor }).editor
}

describe('rich text editor', () => {
  it('同步外部 HTML，并把编辑结果按 HTML 发出', async () => {
    const wrapper = await mountEditor({ modelValue: '<p>初始内容</p>' })
    const editor = getEditor(wrapper)

    expect(wrapper.text()).toContain('初始内容')

    await wrapper.setProps({ modelValue: '<h2>外部更新</h2>' })
    expect(editor.getHTML()).toBe('<h2>外部更新</h2>')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()

    editor.commands.setContent('<p>用户内容</p>')
    await nextTick()

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['<p>用户内容</p>'])
    expect(wrapper.emitted('change')?.at(-1)?.[0]).toBe('<p>用户内容</p>')
  })

  it('工具栏命令格式化当前选区并更新激活状态', async () => {
    const wrapper = await mountEditor({ modelValue: '<p>format me</p>' })
    const editor = getEditor(wrapper)

    editor.commands.selectAll()
    await wrapper.get('button[aria-label="粗体"]').trigger('click')
    await nextTick()

    expect(editor.getHTML()).toBe('<p><strong>format me</strong></p>')
    expect(wrapper.get('button[aria-label="粗体"]').attributes('aria-pressed')).toBe('true')
  })

  it('分别处理禁用和只读状态', async () => {
    const disabledWrapper = await mountEditor({ disabled: true, modelValue: '<p>disabled</p>' })

    expect(disabledWrapper.get('[role="textbox"]').attributes('contenteditable')).toBe('false')
    expect(disabledWrapper.get('[role="textbox"]').attributes('aria-disabled')).toBe('true')
    expect(disabledWrapper.get('button[aria-label="粗体"]').attributes('disabled')).toBeDefined()

    const readonlyWrapper = await mountEditor({ modelValue: '<p>readonly</p>', readonly: true })
    expect(readonlyWrapper.find('[role="toolbar"]').exists()).toBe(false)
    expect(readonlyWrapper.get('[role="textbox"]').attributes('aria-readonly')).toBe('true')
    expect(readonlyWrapper.get('[role="textbox"]').attributes('contenteditable')).toBe('false')
  })

  it('允许使用作用域插槽替换内置工具栏', async () => {
    const wrapper = await mountEditor(
      { modelValue: '<p>slot toolbar</p>' },
      {
        toolbar: ({ editor }: { editor: Editor }) => h('button', {
          'aria-label': '自定义清空',
          'onClick': () => editor.commands.clearContent(),
          'type': 'button',
        }, 'clear'),
      },
    )

    expect(wrapper.find('button[aria-label="粗体"]').exists()).toBe(false)
    await wrapper.get('button[aria-label="自定义清空"]').trigger('click')
    await nextTick()

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([''])
  })
})
