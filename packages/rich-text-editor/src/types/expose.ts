import type { Editor, JSONContent } from '@tiptap/core'
import type { RichTextEditorCommands, RichTextEditorState } from './commands'
import type { RichTextEditorAutofocus } from './shared'

export interface RichTextEditorExpose {
  /** Compatibility escape hatch. Prefer commands and state for ordinary integrations. */
  editor: Editor | null
  commands: RichTextEditorCommands
  state: RichTextEditorState
  focus: (position?: RichTextEditorAutofocus) => void
  clearContent: () => void
  getHTML: () => string
  getJSON: () => JSONContent | null
}
