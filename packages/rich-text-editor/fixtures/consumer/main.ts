import type { RichTextEditorExpose, RichTextEditorToolbarScope } from '@moluoxixi/rich-text-editor'
import { RichTextEditor } from '@moluoxixi/rich-text-editor'
import { createApp, h, ref } from 'vue'
import '@moluoxixi/rich-text-editor/styles'
import './style.css'

const html = ref('<h2>发布说明</h2><p>编辑内容并检查格式、链接和历史记录。</p>')
const disabled = ref(false)
const readonly = ref(false)
const editor = ref<RichTextEditorExpose>()
const submits = ref(0)
const errors = ref<string[]>([])
const app = createApp({
  setup() {
    return () => [
      h('h1', '富文本编辑器'),
      h('div', { class: 'settings' }, [
        h('label', [h('input', { type: 'checkbox', checked: disabled.value, onChange: () => { disabled.value = !disabled.value } }), '禁用']),
        h('label', [h('input', { type: 'checkbox', checked: readonly.value, onChange: () => { readonly.value = !readonly.value } }), '只读']),
      ]),
      h('form', {
        onSubmit: (event: Event) => {
          event.preventDefault()
          submits.value += 1
        },
      }, [
        h(RichTextEditor, {
          'ref': editor,
          'modelValue': html.value,
          'onUpdate:modelValue': (value: string) => { html.value = value },
          'onContentError': (error: Error) => { errors.value.push(error.message) },
          'ariaLabel': '文章内容',
          'disabled': disabled.value,
          'readonly': readonly.value,
          'minHeight': 240,
          'maxHeight': 420,
        }, {
          'toolbar-after': ({ commands, state }: RichTextEditorToolbarScope) => h('button', {
            'type': 'button',
            'aria-label': '清空内容',
            'disabled': !state.editable,
            'onClick': () => commands.clearContent(),
          }, '清空'),
        }),
      ]),
      h('pre', { 'data-testid': 'html' }, html.value),
    ]
  },
})
app.mount('#app')
Object.assign(window, { richTextFixture: { editor, html, disabled, readonly, submits, errors, unmount: () => app.unmount() } })
