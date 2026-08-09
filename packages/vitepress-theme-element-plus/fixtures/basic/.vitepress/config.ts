import { defineElementPlusDocs } from '@moluoxixi/vitepress-theme-element-plus'
import { elementPlusDocsDemoPlugin } from '@moluoxixi/vitepress-theme-element-plus/markdown'

export default defineElementPlusDocs({
  site: {
    title: 'Basic documentation',
    siteTitle: 'Basic docs',
    locales: { 'en-US': { label: 'English', lang: 'en-US' } },
    defaultLocale: 'en-US',
  },
  search: 'local',
  vitepress: {
    markdown: {
      config(md) {
        md.use(elementPlusDocsDemoPlugin)
      },
    },
    vite: {
      resolve: {
        conditions: ['module', 'browser', 'development|production'],
      },
    },
  },
})
