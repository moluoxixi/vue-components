# @moluoxixi/rich-text-editor

基于 TipTap 3 的 Vue 3 编辑器，支持 HTML/JSON 内容、常用格式、标题、列表、对齐、链接和历史操作。保留上游内核，业务定制通过扩展和工具栏插槽完成。

## 安装

```bash
pnpm add @moluoxixi/rich-text-editor vue @tiptap/core @tiptap/vue-3 @tiptap/starter-kit @tiptap/extension-placeholder @tiptap/extension-text-align
```

TipTap 包应使用一致的 3.x 版本，生产环境锁定已验证版本。

## 组件与插件

```vue
<script setup lang="ts">
import { RichTextEditor } from '@moluoxixi/rich-text-editor'
import { ref } from 'vue'
import '@moluoxixi/rich-text-editor/styles'
const content = ref('<p>开始编辑</p>')
</script>
<template>
  <RichTextEditor v-model="content" aria-label="文章内容" />
</template>
```

默认导出和命名导出是同一个组件；`app.use(RichTextEditor)` 注册组件名 RichTextEditor。`@moluoxixi/rich-text-editor/styles` 是唯一公开 CSS 子入口，必须显式导入。主题覆盖使用 `--mx-rich-text-*` CSS 变量。

## 内容契约

默认 `v-model` 是 HTML 字符串，空文档输出 `''`。编辑器仅保留当前 schema 支持的 HTML 元素和属性；HTML 不保证字节级原样返回。

`v-model:json-value` 可保存 TipTap JSON，默认空文档为 `{ type: 'doc', content: [{ type: 'paragraph', attrs: { textAlign: null } }] }`，包含 schema 默认属性。同时传入两种模型时，**JSON 是唯一输入来源**；用户编辑仍输出 HTML 和 JSON。将 `jsonValue` 设为 `undefined` 会恢复 HTML 输入。深层 JSON 修改受支持。外部内容更新不发 change/update、不加入本地撤销历史；等价文档保留选区。

非法 JSON 发出 `contentError(Error)` 并保留当前文档；初始化失败显示空文档。数据必须符合当前扩展 schema。JSON 的 schema 版本和迁移由存储方管理。

```vue
<script setup lang="ts">
import type { JSONContent } from '@tiptap/core'
import { RichTextEditor } from '@moluoxixi/rich-text-editor'
import { ref } from 'vue'
import '@moluoxixi/rich-text-editor/styles'

const document = ref<JSONContent>({ type: 'doc', content: [{ type: 'paragraph' }] })
</script>
<template>
  <RichTextEditor v-model:json-value="document" />
</template>
```

## Props

| 属性                  | 类型                               | 默认值 / 语义                                                |
| --------------------- | ---------------------------------- | ------------------------------------------------------------ |
| modelValue            | string                             | `''`，HTML                                                   |
| jsonValue             | JSONContent                        | 未设置；设置后优先于 HTML                                    |
| placeholder           | string                             | 请输入内容；可动态修改                                       |
| disabled              | boolean                            | false；禁止编辑和高层修改命令                                |
| readonly              | boolean                            | false；禁止编辑、隐藏工具栏，内容仍可选中                    |
| showToolbar           | boolean                            | true；关闭时也关闭链接编辑面板                               |
| toolbarItems          | readonly RichTextEditorCommandId[] | 全部内置格式命令；按指定顺序展示；不包含正文选择器和链接入口 |
| extensions            | Extensions                         | 创建期追加；支持 Extension、Node、Mark                       |
| minHeight / maxHeight | number 或 string                   | 180 / 未设置；数字单位 px                                    |
| ariaLabel             | string                             | 富文本编辑器                                                 |
| autofocus             | boolean、start、end、all 或 number | false；仅创建时生效                                          |

`extensions` 必须具有唯一名称，包括组合扩展的子扩展；与内置扩展重名会明确抛错。内置 StarterKit、Placeholder、TextAlign 已包含 bold、link 等，不要重复注册。修改扩展/schema 时使用 Vue `key` 重建，并提前迁移内容；组件不会动态替换 schema。

## 事件

| 事件              | 参数                | 触发                         |
| ----------------- | ------------------- | ---------------------------- |
| update:modelValue | HTML string         | 文档发生用户/命令修改        |
| update:jsonValue  | JSONContent         | jsonValue 已启用时的文档修改 |
| change            | HTML string, Editor | 与文档更新同步               |
| focus / blur      | FocusEvent, Editor  | 编辑区域的焦点进入/离开      |
| contentError      | Error               | 初始或外部 JSON 内容无效     |

禁用、只读、placeholder、ARIA、选区变化不会产生内容更新事件。

## 命令与状态

通过 `ref<RichTextEditorExpose>()` 访问：

- `commands.execute(id)`、`commands.canExecute(id)`、`commands.isActive(id)`。
- `commands.setBlockType('paragraph' | 'heading-1' | 'heading-2' | 'heading-3')`。
- `commands.setLink(href)`、`commands.removeLink()`、`commands.clearContent()`。
- `commands.undo()`、`redo()`、`toggleBold()`、`toggleItalic()`、`toggleUnderline()`。
- `state`：ready、editable、blockType、blocks、commands[id].active/enabled、link。
- `getHTML()`、`getJSON()`、`focus(position?)`、`clearContent()`。

修改命令返回 boolean，执行前检查当前可编辑状态和 TipTap `can()`；禁用、只读、销毁或 schema 不允许时返回 false。读取 `state` 保持响应式，不要一次性解构快照后长期缓存。

命令 ID：
`undo`、`redo`、`bold`、`italic`、`underline`、`strike`、`code`、`bulletList`、`orderedList`、`blockquote`、`horizontalRule`、`alignLeft`、`alignCenter`、`alignRight`、`clearFormatting`。

原始 `editor: Editor | null` 和现有事件的 Editor 参数保留兼容，只供高级扩展使用。直接调用 Editor 可绕过组件的禁用与内容策略，不应作为业务按钮的默认入口。

## 工具栏定制

`toolbar` 替换默认内容；`toolbar-before` / `toolbar-after` 在默认内容两侧追加工具。三个插槽共享 `{ editor, disabled, readonly, commands, state, openLinkPanel }`。

```vue
<RichTextEditor v-model="content" :toolbar-items="['undo', 'redo', 'bold', 'italic']">
  <template #toolbar-after="{ commands, state }">
    <button type="button" :disabled="!state.editable" @click="commands.clearContent()">清空</button>
  </template>
</RichTextEditor>
```

自定义按钮必须使用 `type="button"`。调用 `openLinkPanel()` 可复用内置链接编辑；默认链接区域不创建嵌套 form，Enter 应用、Escape 关闭并恢复焦点。

## 链接与内容展示

输入、HTML 解析、粘贴和自动链接共用协议政策：允许 http/https/mailto/tel、锚点、同源根路径；拒绝协议相对地址、反斜杠、控制字符及含用户名密码的 HTTP URL。普通域名补 https。无效输入保留原链接并显示错误；空输入或移除命令删除链接。JSON 中不合法链接视为内容错误。

HTML 输出是 schema 序列化结果，不是通用 HTML 消毒器。自定义节点、服务端持久化和展示端仍需使用自己的可信内容策略，禁止把任意外部 HTML 当成本组件已验证的输出。

## 兼容与验证

ESM-only，Vue 3.5+，TipTap 3.x。五个直接 TipTap peers 及其扩展应保持同版本，建议业务锁定版本。当前矩阵覆盖 3.29.0、3.29.2、3.31.3，不代表未来所有 3.x 已经测试。

```bash
pnpm --filter @moluoxixi/rich-text-editor test
pnpm --filter @moluoxixi/rich-text-editor typecheck
pnpm --filter @moluoxixi/rich-text-editor build
pnpm --filter @moluoxixi/rich-text-editor test:consumer
```

消费者验证从真实 tarball 安装，覆盖 Node/SSR、严格 NodeNext 类型、Vite、桌面/移动 Chromium、样式、焦点、宿主表单和禁用切换。报告与截图在 `.playwright/consumer-report`。SSR 输出组件外壳，交互编辑器在客户端挂载。
