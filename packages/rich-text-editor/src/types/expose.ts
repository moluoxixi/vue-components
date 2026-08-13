import type { Editor } from '@tiptap/core'
import type { RichTextEditorAutofocus } from './shared'

export interface RichTextEditorExpose {
  editor: Editor | null
  focus: (position?: RichTextEditorAutofocus) => void
  clearContent: () => void
}
