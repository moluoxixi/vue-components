import type { Theme } from 'vitepress'
import * as MxComponents from '@moluoxixi/components'
import { VueQueryPlugin } from '@tanstack/vue-query'
import ElementPlus, { ID_INJECTION_KEY, ZINDEX_INJECTION_KEY } from 'element-plus'
import DefaultTheme from 'vitepress/theme'
import ApiDocs from './components/ApiDocs.vue'
import ApiTable from './components/ApiTable.vue'
import ComponentDocMeta from './components/ComponentDocMeta.vue'
import ComponentOverview from './components/ComponentOverview.vue'
import Demo from './components/Demo.vue'
import DocContributors from './components/DocContributors.vue'
import OverviewHome from './components/OverviewHome.vue'
import TypeCell from './components/TypeCell.vue'
import 'element-plus/dist/index.css'
import '@moluoxixi/components/styles'
import './styles/index.css'

const theme: Theme = {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.provide(ID_INJECTION_KEY, { prefix: 1024, current: 0 })
    app.provide(ZINDEX_INJECTION_KEY, { current: 0 })
    app.use(ElementPlus)
    app.use(VueQueryPlugin)
    // Register all library components globally so demos can use them without explicit imports.
    // Only PascalCase exports are Vue components (lowercase keys are utilities/plugins).
    // Call app.component() directly — withInstall's install() throws when the bundler
    // strips the component's name property; fall back to the export key instead.
    Object.entries(MxComponents).forEach(([key, comp]) => {
      const c = comp as any
      if (/^[A-Z]/.test(key) && c && typeof c === 'object') {
        const name: string = (typeof c.name === 'string' && c.name) || key
        app.component(name, c)
      }
    })
    app.component('Demo', Demo)
    app.component('ApiDocs', ApiDocs)
    app.component('ApiTable', ApiTable)
    app.component('ComponentOverview', ComponentOverview)
    app.component('ComponentDocMeta', ComponentDocMeta)
    app.component('DocContributors', DocContributors)
    app.component('TypeCell', TypeCell)
    app.component('OverviewHome', OverviewHome)
  },
}

export default theme
