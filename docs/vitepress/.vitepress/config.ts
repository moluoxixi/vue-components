import { defineConfig } from 'vitepress'
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
      '/components/': [
        {
          text: '通用',
          items: [
            { text: '组件总览', link: '/components/' },
            { text: 'CopyText 复制文本', link: '/components/copy-text' },
            { text: 'HeadlessCopyText 无头复制', link: '/components/headless-copy-text' },
          ],
        },
        {
          text: '表单',
          items: [
            { text: 'DateRangePicker 日期范围', link: '/components/date-range-picker' },
            { text: 'EnterNextContainer 回车跳转', link: '/components/enter-next-container' },
            { text: 'RequestSelectV2 远程选择器', link: '/components/request-select-v2' },
            { text: 'RequestCascader 远程级联', link: '/components/request-cascader' },
            { text: 'RequestTreeSelect 远程树选择', link: '/components/request-tree-select' },
          ],
        },
        {
          text: '数据展示',
          items: [
            { text: 'ConfigTable 配置表格', link: '/components/config-table' },
            { text: 'HeadlessTable 无头表格', link: '/components/headless-table' },
            { text: 'PopoverTableSelect 弹出表格选择', link: '/components/popover-table-select' },
          ],
        },
        {
          text: '富文本',
          items: [
            { text: 'RichTextEditor 富文本编辑器', link: '/components/rich-text-editor' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/moluoxixi/vue-components' },
    ],

    search: {
      provider: 'local',
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
