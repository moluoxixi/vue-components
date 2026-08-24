import { defineElementPlusDocs } from '@moluoxixi/vitepress-theme-element-plus'
import { elementPlusDocsProjectMarkdownPlugin } from '@moluoxixi/vitepress-theme-element-plus/markdown'
import project from '../element-plus-docs.config'

export default defineElementPlusDocs({
  site: {
    title: 'Consumer fixture',
    siteTitle: 'Consumer fixture',
    locales: { 'en-US': { label: 'English', lang: 'en-US' } },
    defaultLocale: 'en-US',
  },
  search: 'local',
  vitepress: {
    markdown: {
      config(md) {
        md.use(elementPlusDocsProjectMarkdownPlugin, { project })
      },
    },
    vite: {
      resolve: {
        conditions: ['module', 'browser', 'development|production'],
      },
    },
  },
})
