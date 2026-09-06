# @moluoxixi/rich-text-editor

基于 TipTap 3 的 Vue 3 富文本编辑器，使用 HTML 字符串作为 `v-model` 值，内置常用文本格式、标题、列表、引用、对齐、链接和撤销/重做操作。

## 安装

```bash
pnpm add @moluoxixi/rich-text-editor
```

## 组件用法

```vue
<script setup lang="ts">
import { RichTextEditor } from '@moluoxixi/rich-text-editor'
import '@moluoxixi/rich-text-editor/styles'
import { ref } from 'vue'

const content = ref('<p>开始编辑</p>')
</script>

<template>
  <RichTextEditor v-model="content" aria-label="文章内容" placeholder="请输入内容" :min-height="180" />
</template>
```

## Vue 插件用法

```ts
import RichTextEditor from '@moluoxixi/rich-text-editor'
import { createApp } from 'vue'
import App from './App.vue'
import '@moluoxixi/rich-text-editor/styles'

createApp(App).use(RichTextEditor).mount('#app')
```

插件会以 `RichTextEditor` 注册组件。按需导入与插件安装使用同一个组件实现。

## 常用配置

| 属性          | 类型               | 默认值         | 说明                                 |
| ------------- | ------------------ | -------------- | ------------------------------------ |
| `modelValue`  | `string`           | `''`           | HTML 内容                            |
| `placeholder` | `string`           | `'请输入内容'` | 空内容提示                           |
| `disabled`    | `boolean`          | `false`        | 禁止编辑和工具栏操作                 |
| `readonly`    | `boolean`          | `false`        | 只读并隐藏工具栏                     |
| `showToolbar` | `boolean`          | `true`         | 是否显示工具栏                       |
| `minHeight`   | `string \| number` | `180`          | 编辑区域最小高度                     |
| `maxHeight`   | `string \| number` | -              | 编辑区域最大高度                     |
| `extensions`  | `Extension[]`      | `[]`           | 创建时追加到默认配置后的 TipTap 扩展 |

组件发出 `update:modelValue`、`change`、`focus` 和 `blur` 事件，并通过实例暴露 `editor`、`focus(position?)` 与 `clearContent()`。`toolbar` 作用域插槽可替换默认工具栏。

## 样式

样式从独立入口导入：

```ts
import '@moluoxixi/rich-text-editor/styles'
```

编辑器使用 `--mx-rich-text-*` CSS 自定义属性，可在业务容器内覆盖颜色、边界和焦点样式。
