export type RichTextEditorCommandId
  = | 'undo' | 'redo' | 'bold' | 'italic' | 'underline' | 'strike' | 'code'
    | 'bulletList' | 'orderedList' | 'blockquote' | 'horizontalRule'
    | 'alignLeft' | 'alignCenter' | 'alignRight' | 'clearFormatting'

export type RichTextEditorBlockType = 'paragraph' | 'heading-1' | 'heading-2' | 'heading-3'

export interface RichTextEditorCommandState {
  active: boolean
  enabled: boolean
}

export interface RichTextEditorState {
  ready: boolean
  editable: boolean
  blockType: RichTextEditorBlockType
  blocks: Record<RichTextEditorBlockType, boolean>
  commands: Record<RichTextEditorCommandId, RichTextEditorCommandState>
  link: RichTextEditorCommandState & { href: string }
}

export interface RichTextEditorCommands {
  execute: (id: RichTextEditorCommandId) => boolean
  canExecute: (id: RichTextEditorCommandId) => boolean
  isActive: (id: RichTextEditorCommandId) => boolean
  setBlockType: (type: RichTextEditorBlockType) => boolean
  setLink: (href: string) => boolean
  removeLink: () => boolean
  clearContent: () => boolean
  undo: () => boolean
  redo: () => boolean
  toggleBold: () => boolean
  toggleItalic: () => boolean
  toggleUnderline: () => boolean
}
