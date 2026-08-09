import { createElementPlusDocsTheme } from '@moluoxixi/vitepress-theme-element-plus'
import { VueQueryPlugin } from '@tanstack/vue-query'
import { defineAsyncComponent } from 'vue'
import { docsContent } from './content'
import Demo from './playground/Demo.vue'

const ApiDocs = defineAsyncComponent(() => import('./api/ApiDocs.vue'))
const Playground = defineAsyncComponent(() => import('./playground/Playground.vue'))

const theme = createElementPlusDocsTheme({
  enhanceApp({ app }) {
    app.use(VueQueryPlugin)
    app.use(docsContent)
    app.component('Demo', Demo)
    app.component('ApiDocs', ApiDocs)
    app.component('Playground', Playground)
  },
})

export default theme
