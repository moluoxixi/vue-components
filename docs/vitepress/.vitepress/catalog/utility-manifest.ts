export interface DocUtility {
  packageName: string
  slug: string
  sidebarText: string
  description: string
  sourcePath: string
}

export interface DocUtilityGroup {
  id: 'runtime' | 'tooling'
  title: string
  description: string
  items: DocUtility[]
}

/** 工具导航、总览和生成路由共同使用的唯一清单。 */
export const utilityGroups: DocUtilityGroup[] = [
  {
    id: 'runtime',
    title: '运行时工具',
    description: '跨框架的数据、网络、文件与浏览器存储能力',
    items: [
      {
        packageName: '@moluoxixi/utils',
        slug: 'utils',
        sidebarText: 'Utils 通用工具',
        description: '跨环境通用函数与 Node.js 项目清单工具',
        sourcePath: 'packages/utils/README.md',
      },
      {
        packageName: '@moluoxixi/ajax-package',
        slug: 'ajax-package',
        sidebarText: 'Ajax Package HTTP 客户端',
        description: '基于 Axios 的无 UI HTTP 客户端',
        sourcePath: 'packages/ajax-package/README.md',
      },
      {
        packageName: '@moluoxixi/excel',
        slug: 'excel',
        sidebarText: 'Excel 导入导出',
        description: '无 UI 依赖的 Excel 与 CSV 数据工具',
        sourcePath: 'packages/excel/README.md',
      },
      {
        packageName: '@moluoxixi/indexed-db',
        slug: 'indexed-db',
        sidebarText: 'IndexedDB 存储',
        description: '显式配置的 IndexedDB key-value 存储',
        sourcePath: 'packages/indexed-db/README.md',
      },
    ],
  },
  {
    id: 'tooling',
    title: '工程工具',
    description: '用于代码质量、样式处理和构建配置的工程包',
    items: [
      {
        packageName: '@moluoxixi/i18n-tool',
        slug: 'i18n-tool',
        sidebarText: 'I18n Tool 国际化工作台',
        description: '本地扫描、AI 翻译、审阅并安全写回 JSON 语言资源',
        sourcePath: 'packages/i18n-tool/README.md',
      },
      {
        packageName: '@moluoxixi/eslint-config',
        slug: 'eslint-config',
        sidebarText: 'ESLint Config',
        description: '基于 Antfu ESLint Config 的共享配置工厂',
        sourcePath: 'packages/eslint-config/README.md',
      },
      {
        packageName: '@moluoxixi/postcss-selector-prefix',
        slug: 'postcss-selector-prefix',
        sidebarText: 'PostCSS Selector Prefix',
        description: '基于选择器 AST 的 class 与 id 前缀替换插件',
        sourcePath: 'packages/postcss-selector-prefix/README.md',
      },
      {
        packageName: '@moluoxixi/vite-config',
        slug: 'vite-config',
        sidebarText: 'Vite Config',
        description: '按依赖图装配插件的 Vite 配置预设',
        sourcePath: 'packages/vite-config/README.md',
      },
    ],
  },
]

export const documentedUtilities = utilityGroups.flatMap(group => group.items)
export const documentedUtilityPackageNames = documentedUtilities.map(utility => utility.packageName)
