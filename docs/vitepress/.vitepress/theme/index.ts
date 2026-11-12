import { createElementPlusDocsTheme } from '@moluoxixi/vitepress-theme-element-plus'
import { VueQueryPlugin } from '@tanstack/vue-query'
import SiteHome from './components/SiteHome.vue'
import { docsContent } from './integration'
import '@moluoxixi/rich-text-editor/styles'
// Dependencies of this site's examples; the reusable theme uses epd-* UI styles.
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'

const theme = createElementPlusDocsTheme({
  enhanceApp({ app }) {
    app.use(VueQueryPlugin)
    app.use(docsContent)
    app.component('SiteHome', SiteHome)
  },
})

export default theme
