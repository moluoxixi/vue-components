import { createElementPlusDocsTheme } from '@moluoxixi/vitepress-theme-element-plus'
import { fixtureContent } from './content'

export default createElementPlusDocsTheme({
  enhanceApp({ app }) {
    app.use(fixtureContent)
  },
})
