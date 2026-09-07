import type { ChainedCommands, Editor } from '@tiptap/core'
import type { RichTextEditorBlockType, RichTextEditorCommandId, RichTextEditorCommands, RichTextEditorState } from '../types'
import { normalizeHref } from '../utils'

interface CommandDefinition {
  apply: (chain: ChainedCommands) => ChainedCommands
  active?: (editor: Editor) => boolean
}

const definitions: Record<RichTextEditorCommandId, CommandDefinition> = {
  undo: { apply: chain => chain.undo() },
  redo: { apply: chain => chain.redo() },
  bold: { apply: chain => chain.toggleBold(), active: editor => editor.isActive('bold') },
  italic: { apply: chain => chain.toggleItalic(), active: editor => editor.isActive('italic') },
  underline: { apply: chain => chain.toggleUnderline(), active: editor => editor.isActive('underline') },
  strike: { apply: chain => chain.toggleStrike(), active: editor => editor.isActive('strike') },
  code: { apply: chain => chain.toggleCode(), active: editor => editor.isActive('code') },
  bulletList: { apply: chain => chain.toggleBulletList(), active: editor => editor.isActive('bulletList') },
  orderedList: { apply: chain => chain.toggleOrderedList(), active: editor => editor.isActive('orderedList') },
  blockquote: { apply: chain => chain.toggleBlockquote(), active: editor => editor.isActive('blockquote') },
  horizontalRule: { apply: chain => chain.setHorizontalRule() },
  alignLeft: { apply: chain => chain.setTextAlign('left'), active: editor => editor.isActive({ textAlign: 'left' }) },
  alignCenter: { apply: chain => chain.setTextAlign('center'), active: editor => editor.isActive({ textAlign: 'center' }) },
  alignRight: { apply: chain => chain.setTextAlign('right'), active: editor => editor.isActive({ textAlign: 'right' }) },
  clearFormatting: { apply: chain => chain.unsetAllMarks().clearNodes() },
}

export const richTextCommandIds = Object.keys(definitions) as RichTextEditorCommandId[]
export const richTextBlockTypes: RichTextEditorBlockType[] = ['paragraph', 'heading-1', 'heading-2', 'heading-3']

function blockCommand(type: RichTextEditorBlockType): CommandDefinition['apply'] {
  const levels = { 'heading-1': 1, 'heading-2': 2, 'heading-3': 3 } as const
  return chain => type === 'paragraph' ? chain.setParagraph() : chain.setHeading({ level: levels[type] })
}

export function createRichTextEditorCommands(getEditor: () => Editor | null | undefined, isEditable: () => boolean) {
  const available = () => {
    const editor = getEditor()
    return editor && !editor.isDestroyed && editor.isEditable && isEditable() ? editor : null
  }
  const can = (apply: CommandDefinition['apply']) => {
    const editor = available()
    return editor ? apply(editor.can().chain()).run() : false
  }
  const run = (apply: CommandDefinition['apply']) => {
    const editor = available()
    if (!editor || !can(apply))
      return false
    return apply(editor.chain().focus()).run()
  }
  const commands: RichTextEditorCommands = {
    canExecute: id => Object.hasOwn(definitions, id) && can(definitions[id].apply),
    isActive: (id) => {
      const editor = getEditor()
      return !!editor && !editor.isDestroyed && Object.hasOwn(definitions, id) && (definitions[id].active?.(editor) ?? false)
    },
    execute: id => Object.hasOwn(definitions, id) && run(definitions[id].apply),
    setBlockType: type => richTextBlockTypes.includes(type) && run(blockCommand(type)),
    setLink: (value) => {
      const href = normalizeHref(value)
      return !!href && run(chain => chain.extendMarkRange('link').setLink({ href }))
    },
    removeLink: () => run(chain => chain.extendMarkRange('link').unsetLink()),
    clearContent: () => run(chain => chain.clearContent()),
    undo: () => commands.execute('undo'),
    redo: () => commands.execute('redo'),
    toggleBold: () => commands.execute('bold'),
    toggleItalic: () => commands.execute('italic'),
    toggleUnderline: () => commands.execute('underline'),
  }

  function snapshot(): RichTextEditorState {
    const editor = getEditor()
    const ready = !!editor && !editor.isDestroyed
    const state: RichTextEditorState = {
      ready,
      editable: !!available(),
      blockType: 'paragraph',
      blocks: { 'paragraph': false, 'heading-1': false, 'heading-2': false, 'heading-3': false },
      commands: {} as RichTextEditorState['commands'],
      link: { active: false, enabled: false, href: '' },
    }
    for (const id of richTextCommandIds)
      state.commands[id] = { active: commands.isActive(id), enabled: commands.canExecute(id) }
    for (const type of richTextBlockTypes)
      state.blocks[type] = can(blockCommand(type))
    if (ready) {
      for (const level of [1, 2, 3] as const) {
        if (editor.isActive('heading', { level }))
          state.blockType = (`heading-${level}`) as RichTextEditorBlockType
      }
      state.link = {
        active: editor.isActive('link'),
        enabled: can(chain => chain.extendMarkRange('link').setLink({ href: 'https://example.com' })),
        href: editor.getAttributes('link').href ?? '',
      }
    }
    return state
  }

  return { commands, snapshot }
}
