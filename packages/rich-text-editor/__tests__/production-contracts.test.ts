import type { JSONContent } from '@tiptap/core'
import type { RichTextEditorCommandId, RichTextEditorExpose, RichTextEditorToolbarScope } from '../index'
import { Extension, Mark, Node } from '@tiptap/core'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { h, nextTick, ref } from 'vue'
import { RichTextEditor } from '../index'
import { createRichTextEditorExtensions } from '../src/services'
import { isAllowedHref, normalizeHref } from '../src/utils'

enableAutoUnmount(afterEach)
async function setup(props: Record<string, unknown> = {}, slots = {}) {
  const wrapper = mount(RichTextEditor, { props, slots, attachTo: document.body })
  await nextTick()
  await flushPromises()
  const api = wrapper.vm as unknown as RichTextEditorExpose
  return { wrapper, api, editor: api.editor! }
}
const json = (text: string): JSONContent => ({ type: 'doc', content: [{ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] }] })

describe('production editor contracts', () => {
  it('supports headings and empty JSON output through the public API', async () => {
    const { api, wrapper } = await setup({ jsonValue: json('title') })
    expect(api.commands.setBlockType('heading-3')).toBe(true)
    expect(api.getHTML()).toBe('<h3>title</h3>')
    expect(api.commands.setBlockType('paragraph')).toBe(true)
    api.clearContent()
    expect(api.getHTML()).toBe('')
    const empty = { type: 'doc', content: [{ type: 'paragraph', attrs: { textAlign: null } }] }
    expect(api.getJSON()).toEqual(empty)
    expect(wrapper.emitted('update:jsonValue')?.at(-1)).toEqual([empty])
  })

  it('observes deep JSON edits and applies creation-only extensions predictably', async () => {
    const value = ref(json('before'))
    const owner = mount({
      setup: () => () => h(RichTextEditor, { jsonValue: value.value }),
    })
    await nextTick()
    await flushPromises()
    value.value.content![0].content![0].text = 'after'
    await nextTick()
    expect(owner.text()).toContain('after')
    const { api, wrapper, editor } = await setup({ extensions: [Extension.create({ name: 'first' })] })
    await wrapper.setProps({ extensions: [Extension.create({ name: 'second' })] })
    expect(api.editor).toBe(editor)
    expect(editor.extensionManager.extensions.some(item => item.name === 'first')).toBe(true)
    expect(editor.extensionManager.extensions.some(item => item.name === 'second')).toBe(false)
  })

  it('does not mutate the document when checking capabilities or refresh an equal snapshot', async () => {
    const { api, editor } = await setup({ modelValue: '<p>stable</p>' })
    const before = editor.state.doc
    const transaction = vi.fn()
    editor.on('transaction', transaction)
    for (const id of Object.keys(api.state.commands) as RichTextEditorCommandId[])
      api.commands.canExecute(id)
    expect(transaction).not.toHaveBeenCalled()
    expect(editor.state.doc).toBe(before)
    const snapshot = api.state
    editor.view.dispatch(editor.state.tr)
    expect(api.state).toBe(snapshot)
  })

  it('updates readiness after the raw editor is destroyed', async () => {
    const { api, editor, wrapper } = await setup()
    editor.destroy()
    await nextTick()
    expect(api.state.ready).toBe(false)
    expect(wrapper.find('[role="toolbar"]').exists()).toBe(false)
    expect(api.commands.clearContent()).toBe(false)
  })

  it('preserves focus and blur event payloads and creation autofocus', async () => {
    const { wrapper, editor, api } = await setup({ autofocus: 'end', modelValue: '<p>focus</p>' })
    await vi.waitFor(() => expect(editor.isFocused).toBe(true))
    expect(wrapper.emitted('focus')?.[0]?.[1]).toBe(editor)
    expect(editor.state.selection.from).toBe(6)
    await wrapper.get('[role="textbox"]').trigger('blur')
    expect(wrapper.emitted('blur')?.at(-1)?.[1]).toBe(editor)
    api.focus('start')
    await vi.waitFor(() => expect(editor.state.selection.from).toBe(1))
  })
  it.each([
    ['bold', '<strong>'],
    ['italic', '<em>'],
    ['underline', '<u>'],
    ['strike', '<s>'],
    ['code', '<code>'],
    ['bulletList', '<ul>'],
    ['orderedList', '<ol>'],
    ['blockquote', '<blockquote>'],
    ['horizontalRule', '<hr>'],
    ['alignLeft', 'text-align: left'],
    ['alignCenter', 'text-align: center'],
    ['alignRight', 'text-align: right'],
  ] as const)('executes %s through the same command contract as the toolbar', async (id, fragment) => {
    const { editor, api } = await setup({ modelValue: '<p>sample</p>' })
    editor.commands.selectAll()
    expect(api.commands.canExecute(id)).toBe(true)
    expect(api.commands.execute(id)).toBe(true)
    expect(api.getHTML()).toContain(fragment)
  })

  it('clears formatting and supports undo AND redo', async () => {
    const { editor, api, wrapper } = await setup({ modelValue: '<p>history</p>' })
    editor.commands.selectAll()
    api.commands.toggleBold()
    await nextTick()
    await wrapper.get('[aria-label="撤销"]').trigger('click')
    expect(api.getHTML()).toBe('<p>history</p>')
    await wrapper.get('[aria-label="重做"]').trigger('click')
    expect(api.getHTML()).toContain('<strong>')
    expect(api.commands.execute('clearFormatting')).toBe(true)
    expect(api.getHTML()).toBe('<p>history</p>')
  })

  it('updates active state on selection-only changes and disables invalid schema commands', async () => {
    const { editor, api, wrapper } = await setup({ modelValue: '<p><strong>bold</strong> plain</p><pre><code>code</code></pre>' })
    editor.commands.setTextSelection(2)
    await nextTick()
    expect(wrapper.get('[aria-label="粗体"]').attributes('aria-pressed')).toBe('true')
    editor.commands.setTextSelection(8)
    await nextTick()
    expect(wrapper.get('[aria-label="粗体"]').attributes('aria-pressed')).toBe('false')
    editor.commands.setTextSelection(editor.state.doc.content.size - 2)
    await nextTick()
    expect(api.state.commands.bold.enabled).toBe(false)
    expect(wrapper.get('[aria-label="粗体"]').attributes('disabled')).toBeDefined()
    expect(api.commands.toggleBold()).toBe(false)
  })

  it('guards every public mutation on disabled and readonly transitions without emitting content', async () => {
    const { editor, api, wrapper } = await setup({ modelValue: '<p>locked</p>' })
    editor.commands.selectAll()
    for (const key of ['disabled', 'readonly'] as const) {
      await wrapper.setProps({ [key]: true })
      expect(api.state.editable).toBe(false)
      expect(api.commands.toggleBold()).toBe(false)
      expect(api.commands.clearContent()).toBe(false)
      expect(api.commands.setLink('example.com')).toBe(false)
      expect(api.commands.setBlockType('heading-1')).toBe(false)
      expect(api.getHTML()).toBe('<p>locked</p>')
      expect(wrapper.emitted('update:modelValue')).toBeUndefined()
      await wrapper.setProps({ [key]: false })
      expect(api.state.editable).toBe(true)
    }
  })

  it('syncs JSON as the authoritative input and emits both models exactly once', async () => {
    const { api, editor, wrapper } = await setup({ modelValue: '<p>ignored</p>', jsonValue: json('initial') })
    expect(api.getHTML()).toBe('<p>initial</p>')
    await wrapper.setProps({ modelValue: '<p>still ignored</p>', jsonValue: json('external') })
    expect(api.getHTML()).toBe('<p>external</p>')
    expect(wrapper.emitted('update:jsonValue')).toBeUndefined()
    editor.commands.selectAll()
    api.commands.toggleBold()
    await nextTick()
    expect(wrapper.emitted('update:modelValue')).toHaveLength(1)
    expect(wrapper.emitted('update:jsonValue')).toHaveLength(1)
    expect(wrapper.emitted('update:jsonValue')?.[0]).toEqual([api.getJSON()])
    await wrapper.setProps({ jsonValue: undefined })
    expect(api.getHTML()).toBe('<p>still ignored</p>')
  })

  it('does not echo a real v-model JSON binding or destroy the selection on equivalent input', async () => {
    const value = ref(json('bound'))
    const { api, editor, wrapper } = await setup({
      'jsonValue': value.value,
      'onUpdate:jsonValue': (next: JSONContent) => { value.value = next },
    })
    editor.commands.setTextSelection({ from: 1, to: 3 })
    api.commands.toggleBold()
    await nextTick()
    const selection = editor.state.selection.toJSON()
    const same = JSON.parse(JSON.stringify(value.value))
    await wrapper.setProps({ jsonValue: same })
    expect(editor.state.selection.toJSON()).toEqual(selection)
    expect(wrapper.emitted('update:jsonValue')).toHaveLength(1)
    await wrapper.setProps({ jsonValue: undefined, modelValue: '<p><b>bo</b>und</p>' })
    expect(editor.state.selection.toJSON()).toEqual(selection)
  })

  it('preserves content on invalid initial and external JSON and reports the error', async () => {
    const invalid = { type: 'missingNode' }
    const { wrapper, api } = await setup({ jsonValue: invalid })
    expect(wrapper.emitted('contentError')).toHaveLength(1)
    expect(api.getHTML()).toBe('')
    await wrapper.setProps({ jsonValue: json('valid') })
    await wrapper.setProps({ jsonValue: { type: 'doc', content: [{ type: 'text', text: 'invalid top-level' }] } })
    expect(api.getHTML()).toBe('<p>valid</p>')
    expect(wrapper.emitted('contentError')).toHaveLength(2)
  })

  it('updates placeholder, aria and dimensions at runtime without content changes', async () => {
    const { wrapper } = await setup()
    await wrapper.setProps({ placeholder: 'Changed', ariaLabel: 'Body', minHeight: 220, maxHeight: '320px' })
    expect(wrapper.get('p').attributes('data-placeholder')).toBe('Changed')
    expect(wrapper.get('[role="textbox"]').attributes('aria-label')).toBe('Body')
    expect(wrapper.attributes('style')).toContain('220px')
    expect(wrapper.attributes('style')).toContain('320px')
    expect(wrapper.emitted('change')).toBeUndefined()
  })

  it('provides high-level commands and reactive state to incremental toolbar slots', async () => {
    const { wrapper, editor } = await setup({ modelValue: '<p>slot</p>', toolbarItems: ['bold'] }, {
      'toolbar-after': ({ commands, state }: RichTextEditorToolbarScope) => h('button', {
        'aria-label': 'custom italic',
        'disabled': !state.commands.italic.enabled,
        'onClick': () => commands.toggleItalic(),
      }, String(state.commands.italic.active)),
    })
    expect(wrapper.find('[aria-label="粗体"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="撤销"]').exists()).toBe(false)
    editor.commands.selectAll()
    await wrapper.get('[aria-label="custom italic"]').trigger('click')
    expect(wrapper.get('[aria-label="custom italic"]').text()).toBe('true')
    await wrapper.setProps({ disabled: true })
    expect(wrapper.get('[aria-label="custom italic"]').attributes('disabled')).toBeDefined()
  })

  it('supports custom Node/Mark roundtrips and rejects duplicate extensions', async () => {
    const Badge = Node.create({ name: 'badge', group: 'inline', inline: true, atom: true, parseHTML: () => [{ tag: 'span[data-badge]' }], renderHTML: () => ['span', { 'data-badge': '' }, 'badge'] })
    const Highlight = Mark.create({ name: 'highlight', parseHTML: () => [{ tag: 'mark' }], renderHTML: () => ['mark', 0] })
    const { api } = await setup({ extensions: [Badge, Highlight], modelValue: '<p><mark>custom</mark><span data-badge></span></p>' })
    expect(api.getHTML()).toContain('<mark>custom</mark>')
    expect(api.getJSON()?.content?.[0].content?.[1].type).toBe('badge')
    expect(() => createRichTextEditorExtensions({ placeholder: () => '', extensions: [Extension.create({ name: 'bold' })] })).toThrow('Duplicate rich text extension: bold')
  })

  it('does not add external content replacements to undo history', async () => {
    const { wrapper, api } = await setup({ modelValue: '<p>first</p>' })
    await wrapper.setProps({ modelValue: '<p>second</p>' })
    expect(api.commands.canExecute('undo')).toBe(false)
  })

  it('detaches subscriptions, destroys the instance and invalidates stale commands', async () => {
    const { wrapper, editor, api } = await setup({ modelValue: '<p>dispose</p>' })
    const off = vi.spyOn(editor, 'off')
    const commands = api.commands
    wrapper.unmount()
    expect(editor.isDestroyed).toBe(true)
    expect(commands.toggleBold()).toBe(false)
    expect(off).toHaveBeenCalledWith('transaction', expect.any(Function))
    expect(off).toHaveBeenCalledWith('destroy', expect.any(Function))
  })

  it('rejects unknown command IDs at runtime', async () => {
    const { api } = await setup()
    expect(api.commands.execute('missing' as RichTextEditorCommandId)).toBe(false)
  })
})

describe('link policy and interaction', () => {
  it('does not apply an IME confirmation Enter and cancels a stale selected target', async () => {
    const { wrapper, editor, api } = await setup({ modelValue: '<p>target</p>' })
    editor.commands.selectAll()
    await wrapper.get('[aria-label="链接"]').trigger('click')
    const input = wrapper.get('[aria-label="链接地址"]')
    await input.setValue('example.com')
    await input.trigger('keydown', { key: 'Enter', isComposing: true })
    expect(api.getHTML()).not.toContain('href=')
    expect(wrapper.find('[aria-label="链接地址"]').exists()).toBe(true)
    editor.commands.setTextSelection(2)
    await nextTick()
    expect(wrapper.find('[aria-label="链接地址"]').exists()).toBe(false)
  })
  it.each(['//evil.test', '/\\evil.test', 'https:\\evil.test', 'javascript:alert(1)', 'data:text/html,test', 'ftp://evil.test', 'java\nscript:alert(1)', 'https://', 'https://user:password@evil.test'])('rejects %s', (href) => {
    expect(isAllowedHref(href)).toBe(false)
    expect(normalizeHref(href)).toBe('')
  })
  it.each(['https://example.com', 'http://example.com', '/docs', '#anchor', 'mailto:test@example.com', 'tel:+1234'])('allows %s', (href) => {
    expect(isAllowedHref(href)).toBe(true)
  })
  it('normalizes bare domains with the URL parser', () => {
    expect(normalizeHref(' example.com/docs ')).toBe('https://example.com/docs')
    expect(normalizeHref('not a url')).toBe('')
  })
  it('keeps existing links intact after invalid input and restores focus on Escape', async () => {
    const { wrapper, editor, api } = await setup({ modelValue: '<p><a href="https://example.com">link</a></p>' })
    editor.commands.setTextSelection(2)
    await wrapper.get('[aria-label="链接"]').trigger('click')
    const input = wrapper.get<HTMLInputElement>('[aria-label="链接地址"]')
    expect(document.activeElement).toBe(input.element)
    await input.setValue('javascript:alert(1)')
    await wrapper.get('[aria-label="应用链接"]').trigger('click')
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
    expect(api.getHTML()).toContain('href="https://example.com"')
    await input.trigger('keydown', { key: 'Escape' })
    expect(wrapper.find('[aria-label="链接地址"]').exists()).toBe(false)
    expect(document.activeElement).toBe(wrapper.get('[aria-label="链接"]').element)
  })
  it('closes the panel on hidden toolbar, readonly and external content replacement', async () => {
    const { wrapper, editor } = await setup({ modelValue: '<p>target</p>' })
    for (const props of [{ showToolbar: false }, { readonly: true }, { modelValue: '<p>new target</p>' }]) {
      editor.commands.selectAll()
      await wrapper.get('[aria-label="链接"]').trigger('click')
      expect(wrapper.find('[aria-label="链接地址"]').exists()).toBe(true)
      await wrapper.setProps(props)
      expect(wrapper.find('[aria-label="链接地址"]').exists()).toBe(false)
      await wrapper.setProps({ showToolbar: true, readonly: false })
    }
  })
  it('removes links explicitly and has no nested form', async () => {
    const { wrapper, editor, api } = await setup({ modelValue: '<p><a href="https://example.com">link</a></p>' })
    editor.commands.setTextSelection(2)
    await wrapper.get('[aria-label="链接"]').trigger('click')
    expect(wrapper.find('form').exists()).toBe(false)
    await wrapper.get('[aria-label="移除链接"]').trigger('click')
    expect(api.getHTML()).toBe('<p>link</p>')
  })
  it('applies the same policy to HTML parsing and JSON input', async () => {
    const { wrapper, api } = await setup({ modelValue: '<p><a href="//evil.test">unsafe</a><a href="/docs">safe</a></p>' })
    expect(api.getHTML()).not.toContain('//evil.test')
    expect(api.getHTML()).toContain('href="/docs"')
    await wrapper.setProps({ jsonValue: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'unsafe', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] }] } })
    expect(wrapper.emitted('contentError')).toHaveLength(1)
    expect(api.getHTML()).toContain('safe')
  })
})
