import type { Editor } from '@tiptap/core'

export interface RichTextEditorEmits {
  (event: 'update:modelValue', value: string): void
  (event: 'change', value: string, editor: Editor): void
  (event: 'focus', eventObject: FocusEvent, editor: Editor): void
  (event: 'blur', eventObject: FocusEvent, editor: Editor): void
}
