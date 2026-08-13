import type { App, Plugin } from 'vue'
import type { RichTextEditor as RichTextEditorComponent } from './index'
import { defineAsyncComponent } from 'vue'

const LazyRichTextEditor = defineAsyncComponent(() =>
  import('./index').then(module => module.RichTextEditor),
)

export const RichTextEditor = Object.assign(LazyRichTextEditor, {
  install(app: App): void {
    app.component('RichTextEditor', LazyRichTextEditor)
  },
}) as typeof RichTextEditorComponent & Plugin
