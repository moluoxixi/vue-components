import { createElementPlusDocsTheme } from '@moluoxixi/vitepress-theme-element-plus'
import { VueQueryPlugin } from '@tanstack/vue-query'
import { docsContent } from './content'
import '@moluoxixi/rich-text-editor/styles'

const theme = createElementPlusDocsTheme({
  enhanceApp({ app }) {
    app.use(VueQueryPlugin)
    app.use(docsContent)
  },
})

export default theme
