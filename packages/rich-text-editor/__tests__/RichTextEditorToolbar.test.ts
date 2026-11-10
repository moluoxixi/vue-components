import type { RichTextEditorCommandId } from '../src/types'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import RichTextEditorToolbar from '../src/components/RichTextEditor/components/RichTextEditorToolbar.vue'
import { createRichTextEditorCommands, richTextCommandIds } from '../src/services'

enableAutoUnmount(afterEach)

describe('rich text editor toolbar', () => {
  it('renders default commands and preserves custom order while filtering duplicates and unknown IDs', async () => {
    const { commands, snapshot } = createRichTextEditorCommands(() => undefined, () => true)
    const wrapper = mount(RichTextEditorToolbar, { props: { commands, state: snapshot() } })
    const commandLabels = () => wrapper.findAll('.mx-rich-text-editor__tool').map(button => button.attributes('aria-label'))

    expect(commandLabels()).toHaveLength(richTextCommandIds.length + 1)
    await wrapper.setProps({ items: ['italic', 'bold', 'italic', 'missing' as RichTextEditorCommandId] })
    expect(commandLabels()).toEqual(['斜体', '粗体', '链接'])
    await wrapper.setProps({ items: [] })
    expect(commandLabels()).toEqual(['链接'])
  })

  it('updates derived command and block states when the state prop changes', async () => {
    const { commands, snapshot } = createRichTextEditorCommands(() => undefined, () => true)
    const execute = vi.spyOn(commands, 'execute')
    const state = snapshot()
    state.editable = true
    state.commands.bold.enabled = true
    state.blocks.paragraph = true
    const wrapper = mount(RichTextEditorToolbar, { props: { commands, state, items: ['bold'] } })
    const bold = wrapper.get('button[aria-label="粗体"]')

    expect(bold.attributes('disabled')).toBeUndefined()
    expect(bold.attributes('title')).toBe('粗体')
    expect(bold.attributes('aria-pressed')).toBe('false')
    expect(wrapper.get('option[value="heading-1"]').attributes('disabled')).toBeDefined()
    await bold.trigger('click')
    expect(execute).toHaveBeenCalledWith('bold')

    await wrapper.setProps({
      state: {
        ...state,
        commands: { ...state.commands, bold: { active: true, enabled: false } },
        blocks: { ...state.blocks, 'heading-1': true },
      },
    })
    expect(bold.attributes('disabled')).toBeDefined()
    expect(bold.attributes('title')).toBeUndefined()
    expect(bold.attributes('aria-pressed')).toBe('true')
    expect(bold.classes()).toContain('is-active')
    expect(wrapper.get('option[value="heading-1"]').attributes('disabled')).toBeUndefined()

    await wrapper.setProps({ state })
    expect(bold.attributes('disabled')).toBeUndefined()
    expect(bold.attributes('aria-pressed')).toBe('false')
    expect(wrapper.get('option[value="heading-1"]').attributes('disabled')).toBeDefined()
  })
})
