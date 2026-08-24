import { fileURLToPath } from 'node:url'
import {
  createElementPlusDocsContentRewrites,
  defineElementPlusDocs,
} from '@moluoxixi/vitepress-theme-element-plus'
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
    rewrites: createElementPlusDocsContentRewrites(project),
    srcDir: '.generated/content',
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
