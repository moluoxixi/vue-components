import type { Extensions, JSONContent } from '@tiptap/core'
import type { RichTextEditorCommandId } from './commands'
import type { RichTextEditorAutofocus, RichTextEditorDimension } from './shared'

export interface RichTextEditorProps {
  /** HTML input. Empty HTML output is ''. Ignored as input while jsonValue is defined. */
  modelValue?: string
  /** JSON source of truth when defined; bind using v-model:json-value. */
  jsonValue?: JSONContent
  placeholder?: string
  /** Disable user editing and high-level commands. */
  disabled?: boolean
  /** Selectable content without toolbar; high-level mutation commands are disabled. */
  readonly?: boolean
  showToolbar?: boolean
  minHeight?: RichTextEditorDimension
  maxHeight?: RichTextEditorDimension
  /** Creation only. */
  autofocus?: RichTextEditorAutofocus
  ariaLabel?: string
  /** Creation only. Additional extensions, nodes and marks with unique names. */
  extensions?: Extensions
  /** Ordered subset of default toolbar commands. Omit for all commands. */
  toolbarItems?: readonly RichTextEditorCommandId[]
}
