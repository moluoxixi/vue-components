export type ComponentIconName
  = | 'blocks'
    | 'calendar-range'
    | 'copy'
    | 'file-pen-line'
    | 'form-input'
    | 'git-branch'
    | 'list-filter'
    | 'panel-top-open'
    | 'rows-3'
    | 'scan-text'
    | 'table-properties'
    | 'text-cursor-input'
    | 'tree-pine'

export interface DocComponent {
  apiEntry: string
  docsSourcePath: string
  packageName: string
  repositorySourcePath: string
  name: string
  slug: string
  sidebarText: string
  description: string
  icon: ComponentIconName
  searchAliases?: readonly string[]
}

export interface DocComponentGroup {
  id: 'general' | 'forms' | 'data-display' | 'rich-text'
  title: string
  description: string
  items: DocComponent[]
}

const configFormSearchAliases = ['ConfigForm', 'config form', 'config-form'] as const
const componentsPackageName = '@moluoxixi/components'
const componentsApiEntry = 'packages/components/index.ts'

type DocComponentDefinition = Omit<
  DocComponent,
  'apiEntry' | 'docsSourcePath' | 'packageName' | 'repositorySourcePath'
> & Partial<Pick<DocComponent, 'apiEntry' | 'docsSourcePath' | 'packageName' | 'repositorySourcePath'>>

function defineComponent(component: DocComponentDefinition): DocComponent {
  const defaultSourcePath = `packages/components/src/${component.name}`
  return {
    apiEntry: component.apiEntry ?? componentsApiEntry,
    docsSourcePath: component.docsSourcePath ?? defaultSourcePath,
    packageName: component.packageName ?? componentsPackageName,
    repositorySourcePath: component.repositorySourcePath ?? defaultSourcePath,
    ...component,
  }
}

/** 文档导航、总览和 API 抽取共同使用的组件清单。 */
export const componentGroups: DocComponentGroup[] = [
  {
    id: 'general',
    title: '通用',
    description: '复制等高频交互原语',
    items: [
      defineComponent({ name: 'CopyText', slug: 'copy-text', sidebarText: 'CopyText 复制文本', description: '带状态反馈的复制按钮', icon: 'copy' }),
      defineComponent({ name: 'HeadlessCopyText', slug: 'headless-copy-text', sidebarText: 'HeadlessCopyText 无头复制', description: '无头复制原语，自由组合界面', icon: 'scan-text' }),
    ],
  },
  {
    id: 'forms',
    title: '表单',
    description: '配置化表单、键盘录入、日期与异步数据选择',
    items: [
      defineComponent({ name: 'AntdConfigForm', slug: 'antd-config-form', sidebarText: 'AntdConfigForm Ant Design 配置表单', description: 'Ant Design Vue 字段绑定的配置化表单', icon: 'blocks', searchAliases: configFormSearchAliases }),
      defineComponent({ name: 'ElementConfigForm', slug: 'element-config-form', sidebarText: 'ElementConfigForm Element 配置表单', description: 'Element Plus 字段绑定的配置化表单', icon: 'form-input', searchAliases: configFormSearchAliases }),
      defineComponent({ name: 'DateRangePicker', slug: 'date-range-picker', sidebarText: 'DateRangePicker 日期范围', description: '统一输入输出的日期范围选择器', icon: 'calendar-range' }),
      defineComponent({ name: 'EnterNextContainer', slug: 'enter-next-container', sidebarText: 'EnterNextContainer 回车跳转', description: '回车顺序跳转的录入容器', icon: 'text-cursor-input' }),
      defineComponent({ name: 'RequestSelectV2', slug: 'request-select-v2', sidebarText: 'RequestSelectV2 远程选择器', description: '自动管理请求状态的虚拟选择器', icon: 'list-filter' }),
      defineComponent({ name: 'RequestCascader', slug: 'request-cascader', sidebarText: 'RequestCascader 远程级联', description: '面向远程树数据的级联选择器', icon: 'git-branch' }),
      defineComponent({ name: 'RequestTreeSelect', slug: 'request-tree-select', sidebarText: 'RequestTreeSelect 远程树选择', description: '面向远程树数据的树选择器', icon: 'tree-pine' }),
    ],
  },
  {
    id: 'data-display',
    title: '数据展示',
    description: '配置驱动与无头表格能力',
    items: [
      defineComponent({ name: 'ConfigTable', slug: 'config-table', sidebarText: 'ConfigTable 配置表格', description: '支持虚拟滚动与远程分页的配置表格', icon: 'table-properties' }),
      defineComponent({ name: 'HeadlessTable', slug: 'headless-table', sidebarText: 'HeadlessTable 无头表格', description: '适配任意 UI 层的表格核心', icon: 'rows-3' }),
      defineComponent({ name: 'PopoverTableSelect', slug: 'popover-table-select', sidebarText: 'PopoverTableSelect 弹出表格选择', description: '在弹层表格中筛选并选择数据', icon: 'panel-top-open' }),
    ],
  },
  {
    id: 'rich-text',
    title: '富文本',
    description: '面向业务内容的编辑能力',
    items: [
      defineComponent({
        apiEntry: 'packages/rich-text-editor/index.ts',
        docsSourcePath: 'packages/rich-text-editor',
        packageName: '@moluoxixi/rich-text-editor',
        repositorySourcePath: 'packages/rich-text-editor',
        name: 'RichTextEditor',
        slug: 'rich-text-editor',
        sidebarText: 'RichTextEditor 富文本编辑器',
        description: '基于 Tiptap 的完整富文本编辑器',
        icon: 'file-pen-line',
      }),
    ],
  },
]

export const documentedComponents = componentGroups.flatMap(group => group.items)
export const documentedComponentNames = documentedComponents.map(component => component.name)
export const documentedApiComponentEntries = Array.from(
  new Set(documentedComponents.map(component => component.apiEntry)),
)

export function getDocumentedComponent(componentName: string): DocComponent {
  const component = documentedComponents.find(candidate => candidate.name === componentName)
  if (!component)
    throw new Error(`Unknown documented component: ${componentName}`)
  return component
}
