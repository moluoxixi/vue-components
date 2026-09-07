import type { Editor, JSONContent } from '@tiptap/core'
import { createDocument } from '@tiptap/core'
import { isAllowedHref } from '../utils'

export function syncEditorContent(editor: Editor, content: string | JSONContent): void {
  const document = typeof content === 'string'
    ? createDocument(content, editor.schema)
    : editor.schema.nodeFromJSON(content)
  document.check()
  if (document.type !== editor.schema.topNodeType)
    throw new Error('Rich text JSON must be a document node.')
  document.descendants((node) => {
    for (const mark of node.marks) {
      if (mark.type.name === 'link' && !isAllowedHref(String(mark.attrs.href ?? '')))
        throw new Error('Rich text JSON contains an invalid link.')
    }
  })
  if (document.eq(editor.state.doc))
    return
  // A controlled replacement is not a user undo step and must not echo to v-model.
  editor.chain().setMeta('addToHistory', false).setContent(document, { emitUpdate: false }).run()
}
