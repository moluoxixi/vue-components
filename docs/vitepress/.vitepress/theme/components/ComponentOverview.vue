<script setup lang="ts">
import {
  CalendarRange,
  Copy,
  FilePenLine,
  GitBranch,
  ListFilter,
  PanelTopOpen,
  Rows3,
  ScanText,
  TableProperties,
  TextCursorInput,
  TreePine,
} from '@lucide/vue'
import OverviewCard from './OverviewCard.vue'

const groups = [
  {
    title: '通用',
    description: '复制等高频交互原语',
    items: [
      { name: 'CopyText', desc: '带状态反馈的复制按钮', link: '/components/copy-text.html', icon: Copy },
      { name: 'HeadlessCopyText', desc: '无头复制原语，自由组合界面', link: '/components/headless-copy-text.html', icon: ScanText },
    ],
  },
  {
    title: '表单',
    description: '键盘录入、日期与异步数据选择',
    items: [
      { name: 'DateRangePicker', desc: '统一输入输出的日期范围选择器', link: '/components/date-range-picker.html', icon: CalendarRange },
      { name: 'EnterNextContainer', desc: '回车顺序跳转的录入容器', link: '/components/enter-next-container.html', icon: TextCursorInput },
      { name: 'RequestSelectV2', desc: '自动管理请求状态的虚拟选择器', link: '/components/request-select-v2.html', icon: ListFilter },
      { name: 'RequestCascader', desc: '面向远程树数据的级联选择器', link: '/components/request-cascader.html', icon: GitBranch },
      { name: 'RequestTreeSelect', desc: '面向远程树数据的树选择器', link: '/components/request-tree-select.html', icon: TreePine },
    ],
  },
  {
    title: '数据展示',
    description: '配置驱动与无头表格能力',
    items: [
      { name: 'ConfigTable', desc: '支持虚拟滚动与远程分页的配置表格', link: '/components/config-table.html', icon: TableProperties },
      { name: 'HeadlessTable', desc: '适配任意 UI 层的表格核心', link: '/components/headless-table.html', icon: Rows3 },
      { name: 'PopoverTableSelect', desc: '在弹层表格中筛选并选择数据', link: '/components/popover-table-select.html', icon: PanelTopOpen },
    ],
  },
  {
    title: '富文本',
    description: '面向业务内容的编辑能力',
    items: [
      { name: 'RichTextEditor', desc: '基于 Tiptap 的完整富文本编辑器', link: '/components/rich-text-editor.html', icon: FilePenLine },
    ],
  },
]
</script>

<template>
  <div class="component-overview">
    <section v-for="group in groups" :key="group.title" class="overview-group">
      <div class="overview-group-heading">
        <div>
          <h2>{{ group.title }}</h2>
          <p>{{ group.description }}</p>
        </div>
        <span>{{ group.items.length }}</span>
      </div>
      <OverviewCard :items="group.items" />
    </section>
  </div>
</template>
