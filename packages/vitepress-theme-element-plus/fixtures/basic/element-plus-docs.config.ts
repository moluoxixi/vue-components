import {
  defineComponentPackage,
  defineElementPlusDocsProject,
} from '@moluoxixi/vitepress-theme-element-plus'

export default defineElementPlusDocsProject({
  components: [],
  documentation: {
    componentsRoute: 'components',
    defaultLocale: 'en-US',
    locales: {
      'en-US': {
        label: 'English',
        pathPrefix: '',
        sourceDirectory: 'content',
        sourceDoc: 'docs/index.md',
      },
    },
  },
  packages: {
    theme: defineComponentPackage({
      componentSource: () => 'packages/vitepress-theme-element-plus',
      load: () => import('@moluoxixi/vitepress-theme-element-plus'),
      name: '@moluoxixi/vitepress-theme-element-plus',
      root: 'packages/vitepress-theme-element-plus',
    }),
  },
  repository: { provider: 'local' },
})
