import { createElementPlusDocsTheme } from '@moluoxixi/vitepress-theme-element-plus'
import { VueQueryPlugin } from '@tanstack/vue-query'
import { defineAsyncComponent } from 'vue'
import ComponentDocMeta from './components/ComponentDocMeta.vue'
import ComponentOverview from './components/ComponentOverview.vue'
import Demo from './components/Demo.vue'
import DocContributors from './components/DocContributors.vue'
import OverviewHome from './components/OverviewHome.vue'

const ApiDocs = defineAsyncComponent(() => import('./components/ApiDocs.vue'))
const Playground = defineAsyncComponent(() => import('./components/Playground.vue'))

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
