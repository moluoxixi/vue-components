import type { Theme } from 'vitepress'
import { VueQueryPlugin } from '@tanstack/vue-query'
import { ID_INJECTION_KEY, ZINDEX_INJECTION_KEY } from 'element-plus'
import DefaultTheme from 'vitepress/theme'
import { defineAsyncComponent } from 'vue'
import ComponentDocMeta from './components/ComponentDocMeta.vue'
import ComponentOverview from './components/ComponentOverview.vue'
import Demo from './components/Demo.vue'
import DocContributors from './components/DocContributors.vue'
import OverviewHome from './components/OverviewHome.vue'
import 'element-plus/dist/index.css'
import '@docs-components/styles'
import './styles/index.css'

const ApiDocs = defineAsyncComponent(() => import('./components/ApiDocs.vue'))
const Playground = defineAsyncComponent(() => import('./components/Playground.vue'))

const theme: Theme = {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.provide(ID_INJECTION_KEY, { prefix: 1024, current: 0 })
    app.provide(ZINDEX_INJECTION_KEY, { current: 0 })
    app.use(VueQueryPlugin)
    app.component('Demo', Demo)
    app.component('ApiDocs', ApiDocs)
    app.component('ComponentOverview', ComponentOverview)
    app.component('ComponentDocMeta', ComponentDocMeta)
    app.component('DocContributors', DocContributors)
    app.component('OverviewHome', OverviewHome)
    app.component('Playground', Playground)
  },
}

export default theme
