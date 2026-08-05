import type { Component } from 'vue'

export interface ExampleModule {
  default: Component
}

export interface ExampleDefinition {
  name: string
  title: string
  category: string
  description: string
  order: number
  load: () => Promise<ExampleModule>
}

export const examples = [
  {
    name: 'DateRangePicker',
    title: 'DateRangePicker',
    category: '表单输入',
    description: '统一日期选择器的范围、时间范围和输出格式场景。',
    order: 10,
    load: () => import('./examples/DateRangePicker.vue'),
  },
  {
    name: 'CopyText',
    title: 'CopyText',
    category: '通用交互',
    description: '复制文本的默认视觉、插槽定制与 headless 组合能力。',
    order: 12,
    load: () => import('./examples/CopyText.vue'),
  },
  {
    name: 'RichTextEditor',
    title: 'RichTextEditor',
    category: '表单输入',
    description: '支持 HTML 双向绑定、常用格式、链接、列表、对齐和历史操作的富文本编辑器。',
    order: 15,
    load: () => import('./examples/RichTextEditor.vue'),
  },
  {
    name: 'EnterNextContainer',
    title: 'EnterNextContainer',
    category: '表单输入',
    description: '表单控件之间的 Enter 顺序聚焦和末尾事件场景。',
    order: 20,
    load: () => import('./examples/EnterNextContainer.vue'),
  },
  {
    name: 'HeadlessTable',
    title: 'HeadlessTable',
    category: '数据展示',
    description: '由无样式的表格内核驱动 Element Plus Table，列、renderer 和 slots 均由配置控制。',
    order: 25,
    load: () => import('./examples/HeadlessTable.vue'),
  },
  {
    name: 'PopoverTableSelect',
    title: 'PopoverTableSelect',
    category: '弹层选择',
    description: '输入框触发弹层表格、筛选数据并回填选中行的场景。',
    order: 30,
    load: () => import('./examples/PopoverTableSelect.vue'),
  },
  {
    name: 'ElementConfigForm',
    title: 'ElementConfigForm',
    category: '配置表单',
    description: 'components 包内置 Element Plus 配置表单的字段写回、条件字段和提交场景。',
    order: 40,
    load: () => import('./examples/ElementConfigForm.vue'),
  },
  {
    name: 'antdConfigForm',
    title: 'antdConfigForm',
    category: '配置表单',
    description: 'components 包内置 Ant Design Vue 配置表单的字段写回、checked 协议自动适配和提交场景。',
    order: 50,
    load: () => import('./examples/AntdConfigForm.vue'),
  },
] satisfies ExampleDefinition[]
