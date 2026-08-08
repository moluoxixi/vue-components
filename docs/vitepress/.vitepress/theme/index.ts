import { createElementPlusDocsTheme } from '@moluoxixi/vitepress-theme-element-plus'
import { VueQueryPlugin } from '@tanstack/vue-query'
import { defineAsyncComponent } from 'vue'
import ComponentOverview from './catalog/ComponentOverview.vue'
import OverviewHome from './catalog/OverviewHome.vue'
import ComponentDocMeta from './component-meta/ComponentDocMeta.vue'
import DocContributors from './component-meta/DocContributors.vue'
import Demo from './playground/Demo.vue'

const ApiDocs = defineAsyncComponent(() => import('./api/ApiDocs.vue'))
const Playground = defineAsyncComponent(() => import('./playground/Playground.vue'))

const theme = createElementPlusDocsTheme({
  enhanceApp({ app }) {
    app.use(VueQueryPlugin)
    app.component('Demo', Demo)
    app.component('ApiDocs', ApiDocs)
    app.component('ComponentOverview', ComponentOverview)
    app.component('ComponentDocMeta', ComponentDocMeta)
    app.component('DocContributors', DocContributors)
    app.component('OverviewHome', OverviewHome)
    app.component('Playground', Playground)
  },
})

export default theme
