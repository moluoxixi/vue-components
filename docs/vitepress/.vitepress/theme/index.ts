import { createElementPlusDocsTheme } from '@moluoxixi/vitepress-theme-element-plus'
import { VueQueryPlugin } from '@tanstack/vue-query'
import { docsContent } from './content'

const theme = createElementPlusDocsTheme({
  enhanceApp({ app }) {
    app.use(VueQueryPlugin)
    app.use(docsContent)
  },
})

export default theme
