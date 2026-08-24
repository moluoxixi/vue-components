import { fileURLToPath } from 'node:url'
import { defineElementPlusDocs } from '@moluoxixi/vitepress-theme-element-plus'
import { elementPlusDocsProjectMarkdownPlugin } from '@moluoxixi/vitepress-theme-element-plus/markdown'
import project from '../element-plus-docs.config'

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
        md.use(elementPlusDocsProjectMarkdownPlugin, {
          project,
          projectRoot: fileURLToPath(new URL('../../../..', import.meta.url)),
        })
      },
    },
    vite: {
      resolve: {
        conditions: ['module', 'browser', 'development|production'],
      },
    },
  },
})
