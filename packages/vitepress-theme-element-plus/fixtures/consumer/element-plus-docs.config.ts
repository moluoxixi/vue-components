import {
  defineComponentPackage,
  defineElementPlusDocsProject,
} from '@moluoxixi/vitepress-theme-element-plus'

export default defineElementPlusDocsProject({
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
  repository: {
    provider: 'local',
  },
  packages: {
    components: defineComponentPackage({
      name: '@moluoxixi/vitepress-theme-element-plus',
      root: 'packages/vitepress-theme-element-plus',
      componentSource: () => 'packages/vitepress-theme-element-plus/src/content/demo',
      load: () => import('@moluoxixi/vitepress-theme-element-plus'),
    }),
  },
  components: [{
    id: 'documentation',
    title: 'Documentation',
    description: 'Fixture documentation components',
    items: [{
      name: 'ElementPlusDocsDemo',
      sidebarText: 'Demo',
      description: 'Reusable documentation demo',
      icon: 'code',
    }],
  }],
})
