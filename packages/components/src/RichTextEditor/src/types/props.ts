import type {
  RichTextEditorAutofocus,
  RichTextEditorDimension,
} from './shared'

export interface RichTextEditorProps {
  /** HTML content controlled through v-model. Empty content is emitted as an empty string. */
  modelValue?: string
  /** Placeholder rendered while the document is empty. */
  placeholder?: string
  /** Disable editing and toolbar commands. */
  disabled?: boolean
  /** Render selectable, non-editable content without the toolbar. */
  readonly?: boolean
  /** Show the built-in toolbar or the toolbar slot. */
  showToolbar?: boolean
  /** Minimum height of the editable surface. Numbers are interpreted as pixels. */
  minHeight?: RichTextEditorDimension
  /** Maximum height of the editable surface. Numbers are interpreted as pixels. */
  maxHeight?: RichTextEditorDimension
  /** Initial cursor position when the editor is created. */
  autofocus?: RichTextEditorAutofocus
  /** Accessible name for the editable surface. */
  ariaLabel?: string
}
