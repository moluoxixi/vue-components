import type { Editor } from '@tiptap/core'

export interface RichTextEditorToolbarScope {
  editor: Editor
  disabled: boolean
  readonly: boolean
}

export interface RichTextEditorSlots {
  toolbar?: (scope: RichTextEditorToolbarScope) => any
}
