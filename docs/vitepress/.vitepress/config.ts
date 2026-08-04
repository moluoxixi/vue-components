import { defineConfig } from 'vitepress'
import { componentGroups } from './component-manifest'
import { demoPlugin } from './plugins/demo'

export default defineConfig({
  lang: 'zh-CN',
  title: 'MoluoXixi Components',
  description: '基于 Element Plus 的业务组件库',
  base: '/',
  lastUpdated: true,

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
  ],

  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'MX Components',
    returnToTopLabel: '返回顶部',
    sidebarMenuLabel: '菜单',
    darkModeSwitchLabel: '主题',
    lightModeSwitchTitle: '切换到浅色主题',
    darkModeSwitchTitle: '切换到深色主题',

    nav: [
      { text: '概览', link: '/' },
      { text: '指南', link: '/guide/getting-started', activeMatch: '/guide/' },
      { text: '组件', link: '/components/', activeMatch: '/components/' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: '指南',
          items: [
            { text: '快速开始', link: '/guide/getting-started' },
          ],
        },
      ],
      '/components/': componentGroups.map((group, index) => ({
        text: group.title,
        items: [
          ...(index === 0 ? [{ text: '组件总览', link: '/components/' }] : []),
          ...group.items.map(component => ({
            text: component.sidebarText,
            link: `/components/${component.slug}`,
          })),
        ],
      })),
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/moluoxixi/vue-components' },
    ],

    search: {
      provider: 'local',
      options: {
        translations: {
          button: {
            buttonText: '搜索',
            buttonAriaLabel: '搜索文档',
          },
          modal: {
            noResultsText: '未找到相关结果',
            resetButtonTitle: '清除查询',
            footer: {
              selectText: '选择',
              navigateText: '切换',
              closeText: '关闭',
            },
          },
        },
      },
    },

    outline: {
      level: [2, 3],
      label: '本页目录',
    },

    docFooter: {
      prev: '上一页',
      next: '下一页',
    },

    lastUpdated: {
      text: '最后更新于',
    },
  },

  markdown: {
    theme: {
      light: 'github-light',
      dark: 'github-dark',
    },
    config(md) {
      md.use(demoPlugin)
    },
  },

  vite: {
    resolve: {
      alias: {},
    },
    optimizeDeps: {
      include: ['@lucide/vue', 'element-plus', 'vue3-sfc-loader'],
    },
    ssr: {
      noExternal: ['element-plus', 'vue3-sfc-loader'],
    },
  },
})
