import type { Editor } from '@tiptap/core'
import { Extension } from '@tiptap/core'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createApp, h, nextTick } from 'vue'
import RichTextEditorDefault, { RichTextEditor } from '../index'
import { normalizeHref } from '../src/utils'

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
  it('keeps the root component and Vue plugin contract stable', () => {
    const app = createApp({ render: () => null })

    expect(RichTextEditorDefault).toBe(RichTextEditor)
    expect((RichTextEditor as { name?: string }).name).toBe('RichTextEditor')
    app.use(RichTextEditor)
    expect(app.component('RichTextEditor')).toBe(RichTextEditor)
  })

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

  it('工具栏撤销按钮执行历史命令', async () => {
    const wrapper = await mountEditor({ modelValue: '<p>history</p>' })
    const editor = getEditor(wrapper)
    editor.commands.selectAll()
    editor.commands.toggleBold()
    await nextTick()

    await wrapper.get('button[aria-label="撤销"]').trigger('click')
    expect(editor.getHTML()).toBe('<p>history</p>')
  })

  it('规范化链接时拒绝协议相对外链', () => {
    expect(normalizeHref('//attacker.example')).toBe('')
    expect(normalizeHref('/docs')).toBe('/docs')
    expect(normalizeHref('example.com')).toBe('https://example.com')
    expect(normalizeHref('javascript:alert(1)')).toBe('')
  })

  it('通过链接面板写入链接并支持关闭', async () => {
    const wrapper = await mountEditor({ modelValue: '<p>链接文本</p>' })
    const editor = getEditor(wrapper)
    editor.commands.selectAll()
    await wrapper.get('button[aria-label="链接"]').trigger('click')
    await nextTick()

    const input = wrapper.get('input[aria-label="链接地址"]')
    await input.setValue('example.com')
    await wrapper.get('form.mx-rich-text-editor__link-panel').trigger('submit')
    await nextTick()

    expect(editor.getHTML()).toContain('href="https://example.com"')
    expect(wrapper.find('input[aria-label="链接地址"]').exists()).toBe(false)
  })

  it('追加自定义 TipTap 扩展而不改变默认能力', async () => {
    const extension = Extension.create({ name: 'testExtension' })
    const wrapper = await mountEditor({ extensions: [extension] })
    const editor = getEditor(wrapper)

    expect(editor.extensionManager.extensions.some(item => item.name === 'testExtension')).toBe(true)
    expect(wrapper.get('button[aria-label="粗体"]').exists()).toBe(true)
  })
})
