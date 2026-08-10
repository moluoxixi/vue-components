import type { DocComponent, DocComponentGroup } from './component-manifest.ts'
import type { DocsLocale } from './docs-site.ts'
import type { DocUtility, DocUtilityGroup } from './utility-manifest.ts'
import { componentGroups } from './component-manifest.ts'
import { localePath as createLocalePath, defaultDocsLocale, docsLocales } from './docs-site.ts'
import { utilityGroups } from './utility-manifest.ts'

export type { DocsLocale } from './docs-site.ts'

export interface DocsMessages {
  siteDescription: string
  nav: {
    overview: string
    guide: string
    components: string
    utilities: string
    gettingStarted: string
    customization: string
    componentOverview: string
    utilityOverview: string
  }
  theme: {
    returnToTop: string
    menu: string
    theme: string
    lightMode: string
    darkMode: string
    search: string
    searchAria: string
    noResults: string
    resetSearch: string
    select: string
    navigate: string
    close: string
    outline: string
    previous: string
    next: string
    lastUpdated: string
    languageMenu: string
    skipToContent: string
    notFound: {
      title: string
      quote: string
      linkLabel: string
      linkText: string
    }
  }
  route: {
    api: string
    contributors: string
    componentOverview: string
    componentOverviewDescription: string
  }
  meta: {
    aria: string
    usage: string
    feedback: string
    documentation: string
    copyImport: string
    copied: string
    submitIssue: string
    openIssues: string
    editPage: string
    addDocs: string
    componentOverview: string
    changelog: string
  }
  contributors: {
    aria: string
    contribution: string
    empty: string
  }
  changelog: {
    aria: string
    empty: string
    commitLink: string
  }
  api: {
    permanentLink: string
    empty: string
    name: string
    type: string
    parameters: string
    scope: string
    defaultValue: string
    required: string
    description: string
    yes: string
    typeDetails: string
    tableAria: string
    sections: Record<'emits' | 'expose' | 'props' | 'slots', string>
  }
  demo: {
    compileError: string
    loading: string
    actions: string
    copied: string
    copyCode: string
    codeCopied: string
    collapseCode: string
    expandCode: string
    collapseExampleCode: string
    expandExampleCode: string
    foldCodeRegion: string
    foldedLine: string
    foldedLines: string
    openCodeSandbox: string
    openElementPlusPlayground: string
    openPlayground: string
    openStackBlitz: string
    playgroundUnavailable: string
    sourceLanguage: string
    unfoldCodeRegion: string
    viewSource: string
  }
  playground: {
    title: string
    editor: string
    preview: string
    run: string
    running: string
    reset: string
    copy: string
    copied: string
    editorAria: string
    diagnostics: string
  }
  overview: {
    brandKicker: string
    intro: string
    gettingStarted: string
    browseComponents: string
    factsAria: string
    componentDocs: string
    runtime: string
    typedContracts: string
    visualInteraction: string
    catalogKicker: string
    title: string
    searchPlaceholder: string
    searchAria: string
    noResults: string
  }
}

const messages: Record<DocsLocale, DocsMessages> = {
  'zh-CN': {
    siteDescription: '基于 Element Plus 的业务组件库',
    nav: {
      overview: '概览',
      guide: '指南',
      components: '组件',
      utilities: '工具',
      gettingStarted: '快速开始',
      customization: '文档定制',
      componentOverview: '组件总览',
      utilityOverview: '工具总览',
    },
    theme: {
      returnToTop: '返回顶部',
      menu: '菜单',
      theme: '主题',
      lightMode: '切换到浅色主题',
      darkMode: '切换到深色主题',
      search: '搜索',
      searchAria: '搜索文档',
      noResults: '未找到相关结果',
      resetSearch: '清除查询',
      select: '选择',
      navigate: '切换',
      close: '关闭',
      outline: '本页目录',
      previous: '上一页',
      next: '下一页',
      lastUpdated: '最后更新于',
      languageMenu: '切换语言',
      skipToContent: '跳转到正文',
      notFound: {
        title: '页面未找到',
        quote: '请检查地址，或返回首页继续浏览文档。',
        linkLabel: '返回首页',
        linkText: '返回首页',
      },
    },
    route: { api: 'API', contributors: '组件贡献者', componentOverview: '组件总览', componentOverviewDescription: '按使用场景浏览 MX Components。每个页面均提供自动生成的 API，并可展示组件提交历史。' },
    meta: { aria: '组件文档信息', usage: '使用', feedback: '反馈', documentation: '文档', copyImport: '复制导入语句', copied: '已复制导入语句', submitIssue: '提交问题', openIssues: '待解决', editPage: '编辑此页', addDocs: '补充文档', componentOverview: '组件总览', changelog: '更新日志' },
    contributors: { aria: '{name} 组件贡献者', contribution: '为 {name} 贡献 {count} 次提交', empty: '暂无贡献记录' },
    changelog: { aria: '{name} 更新日志', empty: '暂无提交记录', commitLink: '在 GitHub 查看提交 {sha}' },
    api: { permanentLink: '{section}的永久链接', empty: '该组件没有公开的组件契约。', name: '名称', type: '类型', parameters: '参数', scope: '作用域', defaultValue: '默认值', required: '必填', description: '说明', yes: '是', typeDetails: '查看类型详情：{type}', tableAria: '{section} API', sections: { props: 'Props', emits: 'Emits', slots: 'Slots', expose: 'Expose' } },
    demo: { compileError: '编译错误', loading: '加载中…', actions: '示例操作', copied: '已复制', copyCode: '复制代码', codeCopied: '代码已复制', collapseCode: '收起代码', expandCode: '展开代码', collapseExampleCode: '收起示例代码', expandExampleCode: '展开示例代码', foldCodeRegion: '折叠代码区域', foldedLine: '已折叠 {lines} 行', foldedLines: '已折叠 {lines} 行', openCodeSandbox: '在 CodeSandbox 中编辑', openElementPlusPlayground: '在 Vue Playground 中编辑', openPlayground: '在轻量演练场中编辑', openStackBlitz: '在 StackBlitz 中编辑', playgroundUnavailable: '无法打开演练场', sourceLanguage: '示例源码语言', unfoldCodeRegion: '展开代码区域', viewSource: '在 GitHub 查看示例源码' },
    playground: { title: '组件演练场', editor: '单文件组件', preview: '预览', run: '运行', running: '运行中', reset: '重置', copy: '复制', copied: '已复制', editorAria: 'Vue 单文件组件源码', diagnostics: '运行错误' },
    overview: { brandKicker: 'Vue 3 组件库', intro: '基于 Element Plus 的业务组件库，覆盖高频表单、数据展示与内容编辑场景。', gettingStarted: '快速开始', browseComponents: '浏览组件', factsAria: '组件库概况', componentDocs: '组件文档', runtime: '运行基础', typedContracts: '完整契约', visualInteraction: '视觉与交互', catalogKicker: 'Component Overview', title: '组件总览', searchPlaceholder: '搜索组件', searchAria: '搜索组件', noResults: '未找到匹配的组件' },
  },
  'en-US': {
    siteDescription: 'Business components built on Element Plus',
    nav: {
      overview: 'Overview',
      guide: 'Guide',
      components: 'Components',
      utilities: 'Utilities',
      gettingStarted: 'Getting Started',
      customization: 'Documentation Theme',
      componentOverview: 'Component Overview',
      utilityOverview: 'Utility Overview',
    },
    theme: {
      returnToTop: 'Return to top',
      menu: 'Menu',
      theme: 'Theme',
      lightMode: 'Switch to light theme',
      darkMode: 'Switch to dark theme',
      search: 'Search',
      searchAria: 'Search documentation',
      noResults: 'No results found',
      resetSearch: 'Reset search',
      select: 'Select',
      navigate: 'Navigate',
      close: 'Close',
      outline: 'On this page',
      previous: 'Previous',
      next: 'Next',
      lastUpdated: 'Last updated',
      languageMenu: 'Change language',
      skipToContent: 'Skip to content',
      notFound: {
        title: 'Page not found',
        quote: 'Check the address or return home to continue browsing the documentation.',
        linkLabel: 'Go to home page',
        linkText: 'Take me home',
      },
    },
    route: { api: 'API', contributors: 'Component Contributors', componentOverview: 'Component Overview', componentOverviewDescription: 'Browse MX Components by use case. Every page includes generated API documentation and component commit history.' },
    meta: { aria: 'Component documentation information', usage: 'Usage', feedback: 'Feedback', documentation: 'Docs', copyImport: 'Copy import statement', copied: 'Import statement copied', submitIssue: 'New issue', openIssues: 'Open issues', editPage: 'Edit this page', addDocs: 'Add documentation', componentOverview: 'Overview', changelog: 'Changelog' },
    contributors: { aria: '{name} component contributors', contribution: '{count} commits to {name}', empty: 'No contributor records yet' },
    changelog: { aria: '{name} changelog', empty: 'No commits yet', commitLink: 'View commit {sha} on GitHub' },
    api: { permanentLink: 'Permanent link to {section}', empty: 'This component has no public component contract.', name: 'Name', type: 'Type', parameters: 'Parameters', scope: 'Scope', defaultValue: 'Default', required: 'Required', description: 'Description', yes: 'Yes', typeDetails: 'View type details: {type}', tableAria: '{section} API', sections: { props: 'Props', emits: 'Emits', slots: 'Slots', expose: 'Expose' } },
    demo: { compileError: 'Compilation error', loading: 'Loading…', actions: 'Example actions', copied: 'Copied', copyCode: 'Copy code', codeCopied: 'Code copied', collapseCode: 'Collapse code', expandCode: 'Expand code', collapseExampleCode: 'Collapse example source', expandExampleCode: 'Expand example source', foldCodeRegion: 'Fold code region', foldedLine: '{lines} line folded', foldedLines: '{lines} lines folded', openCodeSandbox: 'Edit in CodeSandbox', openElementPlusPlayground: 'Edit in Vue Playground', openPlayground: 'Edit in lightweight playground', openStackBlitz: 'Edit in StackBlitz', playgroundUnavailable: 'Unable to open playground', sourceLanguage: 'Example source language', unfoldCodeRegion: 'Unfold code region', viewSource: 'View example source on GitHub' },
    playground: { title: 'Component Playground', editor: 'Single File Component', preview: 'Preview', run: 'Run', running: 'Running', reset: 'Reset', copy: 'Copy', copied: 'Copied', editorAria: 'Vue Single File Component source', diagnostics: 'Runtime error' },
    overview: { brandKicker: 'Vue 3 Component Library', intro: 'Business components built on Element Plus for forms, data presentation, and rich content editing.', gettingStarted: 'Getting Started', browseComponents: 'Browse Components', factsAria: 'Library overview', componentDocs: 'component docs', runtime: 'runtime', typedContracts: 'typed contracts', visualInteraction: 'visual language', catalogKicker: 'Component Overview', title: 'Components', searchPlaceholder: 'Search Components', searchAria: 'Search components', noResults: 'No matching components found' },
  },
}

const englishGroups: Record<DocComponentGroup['id'], Pick<DocComponentGroup, 'description' | 'title'>> = {
  'general': { title: 'General', description: 'Common interaction primitives such as copy actions' },
  'forms': { title: 'Forms', description: 'Schema-driven forms, keyboard input, dates, and asynchronous selectors' },
  'data-display': { title: 'Data Display', description: 'Config-driven and headless table capabilities' },
  'rich-text': { title: 'Rich Text', description: 'Editing capabilities for business content' },
}

const englishComponents: Record<string, Pick<DocComponent, 'description' | 'sidebarText'>> = {
  AntdConfigForm: { sidebarText: 'AntdConfigForm Ant Design Form', description: 'Schema-driven forms with Ant Design Vue field bindings' },
  ConfigTable: { sidebarText: 'ConfigTable Configurable Table', description: 'Configurable tables with virtual scrolling and remote pagination' },
  CopyText: { sidebarText: 'CopyText Copy Action', description: 'Copy actions with built-in status feedback' },
  DateRangePicker: { sidebarText: 'DateRangePicker Date Range', description: 'Date range selection with normalized input and output' },
  ElementConfigForm: { sidebarText: 'ElementConfigForm Element Form', description: 'Schema-driven forms with Element Plus field bindings' },
  EnterNextContainer: { sidebarText: 'EnterNextContainer Enter Navigation', description: 'Move through form controls in order with Enter' },
  HeadlessCopyText: { sidebarText: 'HeadlessCopyText Headless Copy', description: 'Headless copy primitives for custom interfaces' },
  HeadlessTable: { sidebarText: 'HeadlessTable Table Core', description: 'A table core adaptable to any UI layer' },
  PopoverTableSelect: { sidebarText: 'PopoverTableSelect Table Selector', description: 'Filter and select records inside a popover table' },
  RequestCascader: { sidebarText: 'RequestCascader Remote Cascader', description: 'Cascader selection backed by remote tree data' },
  RequestSelectV2: { sidebarText: 'RequestSelectV2 Remote Select', description: 'Virtualized selection with managed request state' },
  RequestTreeSelect: { sidebarText: 'RequestTreeSelect Remote Tree Select', description: 'Tree selection backed by remote data' },
  RichTextEditor: { sidebarText: 'RichTextEditor Rich Text Editor', description: 'A complete rich text editor powered by Tiptap' },
}

const englishUtilityGroups: Record<DocUtilityGroup['id'], Pick<DocUtilityGroup, 'description' | 'title'>> = {
  runtime: { title: 'Runtime Utilities', description: 'Framework-independent data, network, file, and browser storage capabilities' },
  tooling: { title: 'Tooling', description: 'Packages for code quality, stylesheet processing, and build configuration' },
}

const englishUtilities: Record<string, Pick<DocUtility, 'description' | 'sidebarText'>> = {
  '@moluoxixi/utils': { sidebarText: 'Utils', description: 'Cross-runtime functions and Node.js project manifest utilities' },
  '@moluoxixi/ajax-package': { sidebarText: 'Ajax Package', description: 'A UI-independent HTTP client built on Axios' },
  '@moluoxixi/excel': { sidebarText: 'Excel', description: 'UI-independent Excel and CSV data utilities' },
  '@moluoxixi/indexed-db': { sidebarText: 'IndexedDB', description: 'Explicitly configured IndexedDB key-value storage' },
  '@moluoxixi/eslint-config': { sidebarText: 'ESLint Config', description: 'A shared configuration factory built on Antfu ESLint Config' },
  '@moluoxixi/postcss-selector-prefix': { sidebarText: 'PostCSS Selector Prefix', description: 'AST-based class and id selector prefix replacement' },
  '@moluoxixi/vite-config': { sidebarText: 'Vite Config', description: 'A Vite preset that assembles plugins from the dependency graph' },
}

export function resolveDocsLocale(lang: string | undefined, localeIndex?: string): DocsLocale {
  const normalized = lang?.toLowerCase()
  const byLanguage = (Object.keys(docsLocales) as DocsLocale[]).find((locale) => {
    const configured = docsLocales[locale].lang.toLowerCase()
    return normalized === configured || normalized?.split('-')[0] === configured.split('-')[0]
  })
  if (byLanguage)
    return byLanguage

  const normalizedIndex = localeIndex?.toLowerCase()
  return (Object.keys(docsLocales) as DocsLocale[]).find(locale => docsLocales[locale].siteKey.toLowerCase() === normalizedIndex)
    ?? defaultDocsLocale
}

export function getDocsMessages(locale: DocsLocale): DocsMessages {
  return messages[locale]
}

export function formatDocsMessage(template: string, values: Record<string, number | string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`))
}

export function localePath(locale: DocsLocale, path: string): string {
  return createLocalePath(locale, path)
}

export function getLocalizedComponentGroups(locale: DocsLocale): DocComponentGroup[] {
  if (locale === 'zh-CN')
    return componentGroups

  return componentGroups.map(group => ({
    ...group,
    ...englishGroups[group.id],
    items: group.items.map(component => ({
      ...component,
      ...englishComponents[component.name],
    })),
  }))
}

export function getLocalizedComponents(locale: DocsLocale): DocComponent[] {
  return getLocalizedComponentGroups(locale).flatMap(group => group.items)
}

export function getLocalizedUtilityGroups(locale: DocsLocale): DocUtilityGroup[] {
  if (locale === 'zh-CN')
    return utilityGroups

  return utilityGroups.map(group => ({
    ...group,
    ...englishUtilityGroups[group.id],
    items: group.items.map(utility => ({
      ...utility,
      ...englishUtilities[utility.packageName],
    })),
  }))
}

export function getLocalizedUtilities(locale: DocsLocale): DocUtility[] {
  return getLocalizedUtilityGroups(locale).flatMap(group => group.items)
}
