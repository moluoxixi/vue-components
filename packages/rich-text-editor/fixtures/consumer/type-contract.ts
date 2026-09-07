import type { RichTextEditorCommands, RichTextEditorExpose, RichTextEditorProps, RichTextEditorToolbarScope } from '@moluoxixi/rich-text-editor'
import EditorDefault, { RichTextEditor } from '@moluoxixi/rich-text-editor'
import { Mark, Node } from '@tiptap/core'
import { defineComponent, h } from 'vue'

const props: RichTextEditorProps = {
  modelValue: '<p>HTML</p>',
  jsonValue: { type: 'doc', content: [{ type: 'paragraph' }] },
  extensions: [Node.create({ name: 'consumerNode' }), Mark.create({ name: 'consumerMark' })],
  toolbarItems: ['bold', 'italic'],
}
function commands(api: RichTextEditorExpose, scope: RichTextEditorToolbarScope): boolean {
  const shared: RichTextEditorCommands = scope.commands
  api.focus('end')
  api.getJSON()
  api.getHTML()
  return shared.setLink('/docs') && api.commands.execute('bold') && api.state.commands.bold.enabled
}
export { commands, EditorDefault, props }
export const HtmlConsumer = defineComponent({
  setup: () => () => h(RichTextEditor, {
    'modelValue': '',
    'onUpdate:modelValue': (html: string) => html.toUpperCase(),
    'onChange': (html: string) => html.toUpperCase(),
  }),
})
