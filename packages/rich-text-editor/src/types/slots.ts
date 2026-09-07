import type { Editor } from '@tiptap/core'
import type { RichTextEditorCommands, RichTextEditorState } from './commands'

export interface RichTextEditorToolbarScope {
  /** Advanced extensions may use the raw Editor; ordinary tools should use commands. */
  editor: Editor
  disabled: boolean
  readonly: boolean
  commands: RichTextEditorCommands
  state: RichTextEditorState
  openLinkPanel: () => void
}

export interface RichTextEditorSlots {
  'toolbar'?: (scope: RichTextEditorToolbarScope) => any
  'toolbar-before'?: (scope: RichTextEditorToolbarScope) => any
  'toolbar-after'?: (scope: RichTextEditorToolbarScope) => any
}
