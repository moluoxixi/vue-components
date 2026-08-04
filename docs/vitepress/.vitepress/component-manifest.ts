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
  name: string
  slug: string
  sidebarText: string
  description: string
  icon: ComponentIconName
}

export interface DocComponentGroup {
  title: string
  description: string
  items: DocComponent[]
}

/** 文档导航、总览和 API 抽取共同使用的组件清单。 */
export const componentGroups: DocComponentGroup[] = [
  {
    title: '通用',
    description: '复制等高频交互原语',
    items: [
      { name: 'CopyText', slug: 'copy-text', sidebarText: 'CopyText 复制文本', description: '带状态反馈的复制按钮', icon: 'copy' },
      { name: 'HeadlessCopyText', slug: 'headless-copy-text', sidebarText: 'HeadlessCopyText 无头复制', description: '无头复制原语，自由组合界面', icon: 'scan-text' },
    ],
  },
  {
    title: '表单',
    description: '配置化表单、键盘录入、日期与异步数据选择',
    items: [
      { name: 'AntdConfigForm', slug: 'antd-config-form', sidebarText: 'AntdConfigForm Ant Design 配置表单', description: 'Ant Design Vue 字段绑定的配置化表单', icon: 'blocks' },
      { name: 'ElementConfigForm', slug: 'element-config-form', sidebarText: 'ElementConfigForm Element 配置表单', description: 'Element Plus 字段绑定的配置化表单', icon: 'form-input' },
      { name: 'DateRangePicker', slug: 'date-range-picker', sidebarText: 'DateRangePicker 日期范围', description: '统一输入输出的日期范围选择器', icon: 'calendar-range' },
      { name: 'EnterNextContainer', slug: 'enter-next-container', sidebarText: 'EnterNextContainer 回车跳转', description: '回车顺序跳转的录入容器', icon: 'text-cursor-input' },
      { name: 'RequestSelectV2', slug: 'request-select-v2', sidebarText: 'RequestSelectV2 远程选择器', description: '自动管理请求状态的虚拟选择器', icon: 'list-filter' },
      { name: 'RequestCascader', slug: 'request-cascader', sidebarText: 'RequestCascader 远程级联', description: '面向远程树数据的级联选择器', icon: 'git-branch' },
      { name: 'RequestTreeSelect', slug: 'request-tree-select', sidebarText: 'RequestTreeSelect 远程树选择', description: '面向远程树数据的树选择器', icon: 'tree-pine' },
    ],
  },
  {
    title: '数据展示',
    description: '配置驱动与无头表格能力',
    items: [
      { name: 'ConfigTable', slug: 'config-table', sidebarText: 'ConfigTable 配置表格', description: '支持虚拟滚动与远程分页的配置表格', icon: 'table-properties' },
      { name: 'HeadlessTable', slug: 'headless-table', sidebarText: 'HeadlessTable 无头表格', description: '适配任意 UI 层的表格核心', icon: 'rows-3' },
      { name: 'PopoverTableSelect', slug: 'popover-table-select', sidebarText: 'PopoverTableSelect 弹出表格选择', description: '在弹层表格中筛选并选择数据', icon: 'panel-top-open' },
    ],
  },
  {
    title: '富文本',
    description: '面向业务内容的编辑能力',
    items: [
      { name: 'RichTextEditor', slug: 'rich-text-editor', sidebarText: 'RichTextEditor 富文本编辑器', description: '基于 Tiptap 的完整富文本编辑器', icon: 'file-pen-line' },
    ],
  },
]

export const documentedComponents = componentGroups.flatMap(group => group.items)
export const documentedComponentNames = documentedComponents.map(component => component.name)
