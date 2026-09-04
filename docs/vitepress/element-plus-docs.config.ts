import {
  defineComponentPackage,
  defineElementPlusDocsProject,
} from '@moluoxixi/vitepress-theme-element-plus'

const configFormSearchAliases = ['ConfigForm', 'config form', 'config-form'] as const

export default defineElementPlusDocsProject({
  components: [
    {
      id: 'general',
      title: '通用',
      description: '复制等高频交互原语',
      items: [
        { name: 'CopyText', slug: 'copy-text', sidebarText: 'CopyText 复制文本', description: '带状态反馈的复制按钮', icon: 'copy' },
        { name: 'HeadlessCopyText', slug: 'headless-copy-text', sidebarText: 'HeadlessCopyText 无头复制', description: '无头复制原语，自由组合界面', icon: 'scan-text' },
      ],
    },
    {
      id: 'forms',
      title: '表单',
      description: '配置化表单、键盘录入、日期与异步数据选择',
      items: [
        {
          name: 'AntdConfigForm',
          package: 'configFormAntdVue',
          slug: 'antd-config-form',
          sidebarText: 'AntdConfigForm Ant Design 表单',
          description: '面向 Ant Design Vue 的配置化表单适配器',
          icon: 'blocks',
          searchAliases: configFormSearchAliases,
        },
        {
          name: 'ElementConfigForm',
          package: 'configFormElement',
          slug: 'element-config-form',
          sidebarText: 'ElementConfigForm Element 表单',
          description: '面向 Element Plus 的配置化表单适配器',
          icon: 'form-input',
          searchAliases: configFormSearchAliases,
        },
        { name: 'DateRangePicker', slug: 'date-range-picker', sidebarText: 'DateRangePicker 日期范围', description: '统一输入输出的日期范围选择器', icon: 'calendar-range' },
        { name: 'EnterNextContainer', slug: 'enter-next-container', sidebarText: 'EnterNextContainer 回车跳转', description: '回车顺序跳转的录入容器', icon: 'text-cursor-input' },
        { name: 'RequestSelectV2', slug: 'request-select-v2', sidebarText: 'RequestSelectV2 远程选择器', description: '自动管理请求状态的虚拟选择器', icon: 'list-filter' },
        { name: 'RequestCascader', slug: 'request-cascader', sidebarText: 'RequestCascader 远程级联', description: '面向远程树数据的级联选择器', icon: 'git-branch' },
        { name: 'RequestTreeSelect', slug: 'request-tree-select', sidebarText: 'RequestTreeSelect 远程树选择', description: '面向远程树数据的树选择器', icon: 'tree-pine' },
      ],
    },
    {
      id: 'data-display',
      title: '数据展示',
      description: '配置驱动与无头表格能力',
      items: [
        { name: 'ConfigTable', slug: 'config-table', sidebarText: 'ConfigTable 配置表格', description: '支持虚拟滚动与远程分页的配置表格', icon: 'table-properties' },
        { name: 'HeadlessTable', slug: 'headless-table', sidebarText: 'HeadlessTable 无头表格', description: '适配任意 UI 层的表格核心', icon: 'rows-3' },
        { name: 'PopoverTableSelect', slug: 'popover-table-select', sidebarText: 'PopoverTableSelect 弹出表格选择', description: '在弹层表格中筛选并选择数据', icon: 'panel-top-open' },
      ],
    },
    {
      id: 'rich-text',
      title: '富文本',
      description: '面向业务内容的编辑能力',
      items: [
        {
          name: 'RichTextEditor',
          package: 'richTextEditor',
          slug: 'rich-text-editor',
          sidebarText: 'RichTextEditor 富文本编辑器',
          description: '基于 Tiptap 的完整富文本编辑器',
          icon: 'file-pen-line',
        },
      ],
    },
  ],
  documentation: {
    componentsRoute: 'components',
    defaultLocale: 'zh-CN',
    locales: {
      'zh-CN': {
        label: '简体中文',
        lang: 'zh-CN',
        pathPrefix: '',
        siteKey: 'root',
        sourceDirectory: 'zh',
        sourceDoc: 'docs/index.md',
      },
      'en-US': {
        label: 'English',
        lang: 'en-US',
        pathPrefix: '/en',
        siteKey: 'en',
        sourceDirectory: 'en',
        sourceDoc: 'docs/index.en.md',
      },
    },
  },
  packages: {
    configFormAntdVue: defineComponentPackage({
      name: '@moluoxixi/config-form-antd-vue',
      root: 'packages/ConfigForm/antd',
      apiEntry: 'packages/ConfigForm/antd/index.ts',
      componentSource: () => 'packages/ConfigForm/antd',
      load: () => import('@moluoxixi/config-form-antd-vue'),
      styles: ['@moluoxixi/config-form-antd-vue/styles'],
    }),
    configFormElement: defineComponentPackage({
      name: '@moluoxixi/config-form-element',
      root: 'packages/ConfigForm/element',
      apiEntry: 'packages/ConfigForm/element/index.ts',
      componentSource: () => 'packages/ConfigForm/element',
      load: () => import('@moluoxixi/config-form-element'),
      styles: ['@moluoxixi/config-form-element/styles'],
    }),
    components: defineComponentPackage({
      name: '@moluoxixi/components',
      root: 'packages/components',
      componentSource: name => `packages/components/src/${name}`,
      load: () => import('@moluoxixi/components'),
      loadPlaygroundManifest: () => import('@moluoxixi/components/playground-manifest'),
      styles: ['@moluoxixi/components/styles'],
    }),
    richTextEditor: defineComponentPackage({
      name: '@moluoxixi/rich-text-editor',
      root: 'packages/rich-text-editor',
      componentSource: () => 'packages/rich-text-editor',
      load: () => import('@moluoxixi/rich-text-editor'),
      styles: ['@moluoxixi/rich-text-editor/styles'],
    }),
  },
  prepare: {
    commands: [
      { name: 'workspace dependencies', command: 'pnpm', args: ['run', 'build:workspace-content-packages'] },
      { name: 'component routes', command: 'node', args: ['scripts/generate-component-routes.mts'] },
      { name: 'utility routes', command: 'node', args: ['scripts/generate-utility-routes.mts'] },
      { name: 'API contracts', command: 'node', args: ['scripts/extract-api.mts'] },
    ],
  },
  repository: {
    provider: 'github',
    url: 'https://github.com/moluoxixi/vue-components',
  },
  repositoryProviders: {
    local: {
      provider: 'local',
      url: 'https://github.com/moluoxixi/vue-components',
    },
    gitlab: {
      provider: 'gitlab',
      url: 'https://jihulab.com/moluoxixi/vue-components-provider-fixture',
      contributorProfiles: {
        'gitlab:c5bd8c158c76d1ee0e04dfc5460fa34092caf55172fe6154706c94ce08ddc31b': 'moluoxixi',
      },
    },
    gitee: {
      provider: 'gitee',
      url: 'https://gitee.com/moluoxixi/vue-components-provider-fixture',
    },
    yunxiao: {
      provider: 'yunxiao',
      url: 'https://codeup.aliyun.com/64bac376132d10ed34af0a23/vue-components-provider-fixture',
      repositoryId: '7356176',
      contributorAccounts: {
        'yunxiao:c5bd8c158c76d1ee0e04dfc5460fa34092caf55172fe6154706c94ce08ddc31b': 'aliyun:aliyun1879222502_fD9Ql',
        'yunxiao:d5b8d2b82909bab605c5eb4e0761ac30e81a9da6d907c4fa4c44b38d54546036': 'aliyun:aliyun1879222502_fD9Ql',
      },
    },
  },
})
