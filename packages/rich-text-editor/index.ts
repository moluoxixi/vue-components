import type { App, Plugin } from 'vue'
import { RichTextEditorSource } from './src/components'

export type * from './src/types'

export const RichTextEditor = Object.assign(RichTextEditorSource, {
  install(app: App) {
    app.component('RichTextEditor', RichTextEditorSource)
  },
}) as typeof RichTextEditorSource & Plugin

export default RichTextEditor
