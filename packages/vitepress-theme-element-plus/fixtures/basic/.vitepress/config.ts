import { defineElementPlusDocs } from '@moluoxixi/vitepress-theme-element-plus'

export default defineElementPlusDocs({
  site: {
    title: 'Basic documentation',
    siteTitle: 'Basic docs',
    locales: { 'en-US': { label: 'English', lang: 'en-US' } },
    defaultLocale: 'en-US',
  },
  search: 'local',
  vitepress: {
    vite: {
      resolve: {
        conditions: ['module', 'browser', 'development|production'],
      },
    },
  },
})
