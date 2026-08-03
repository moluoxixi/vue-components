# RichTextEditor

`RichTextEditor` 是基于 Tiptap 的 Vue 3 富文本编辑器，以 HTML 字符串作为 `v-model` 契约。内置工具栏支持标题、粗体、斜体、下划线、删除线、行内代码、列表、引用、分隔线、文本对齐、链接、清除格式和撤销/重做。

## 引入

```ts
import { RichTextEditor } from '@moluoxixi/components'
```

## Props

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `modelValue` | `string` | `''` | HTML 内容；空文档输出空字符串。 |
| `placeholder` | `string` | `请输入内容` | 空文档占位内容。 |
| `disabled` | `boolean` | `false` | 禁止编辑并禁用内置工具栏。 |
| `readonly` | `boolean` | `false` | 只读展示并隐藏工具栏。 |
| `showToolbar` | `boolean` | `true` | 是否显示内置工具栏或 `toolbar` 插槽。 |
| `minHeight` | `number \| string` | `180` | 编辑区最小高度，数字按像素处理。 |
| `maxHeight` | `number \| string` | `undefined` | 编辑区最大高度，超出后内部滚动。 |
| `autofocus` | `boolean \| 'start' \| 'end' \| 'all' \| number` | `false` | 初始化焦点位置。 |
| `ariaLabel` | `string` | `富文本编辑器` | 编辑区无障碍名称。 |

## 事件

| 名称 | 参数 | 说明 |
|---|---|---|
| `update:modelValue` | `(html: string)` | 文档内容变化时同步 HTML。 |
| `change` | `(html: string, editor: Editor)` | 文档内容变化时触发，并提供 Tiptap Editor 实例。 |
| `focus` | `(event: FocusEvent, editor: Editor)` | 编辑区获得焦点时触发。 |
| `blur` | `(event: FocusEvent, editor: Editor)` | 编辑区失去焦点时触发。 |

外部 `modelValue` 变化会更新编辑器，但不会反向触发 `update:modelValue` 或 `change`。

## 插槽与实例

| 名称 | 作用域 | 说明 |
|---|---|---|
| `toolbar` | `{ editor, disabled, readonly }` | 完整替换内置工具栏。 |

组件实例暴露：

| 字段 | 类型 | 说明 |
|---|---|---|
| `editor` | `Editor \| null` | Tiptap Editor 实例。 |
| `focus` | `(position?) => void` | 聚焦指定位置，默认文档末尾。 |
| `clearContent` | `() => void` | 清空内容并按正常编辑流程发出更新事件。 |

## 示例

```vue
<script setup lang="ts">
import { RichTextEditor } from '@moluoxixi/components'
import { ref } from 'vue'

const html = ref('<p>初始内容</p>')
</script>

<template>
  <RichTextEditor
    v-model="html"
    placeholder="填写发布说明"
    :min-height="220"
    :max-height="480"
  />
</template>
```

## 安全与测试

- 编辑器仅保留已注册 Tiptap schema 支持的节点与 mark；HTML 仍属于用户输入。将内容交给 `v-html` 或服务端展示前，应按业务信任边界再次执行 HTML 清洗。
- 链接默认不开启编辑区内点击跳转，并输出 `noopener noreferrer nofollow`。
- 单元测试可通过暴露的 Editor 实例验证序列化和命令；浏览器 E2E 应覆盖真实输入、Selection、快捷键和 Clipboard/Paste 行为。

## 变更记录

- 2026-08-03：新增 `RichTextEditor`。
