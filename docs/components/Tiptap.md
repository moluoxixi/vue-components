# Tiptap / Lucide

## 用途

`packages/components/src/RichTextEditor` 使用 Tiptap 3 作为富文本 schema、命令、Selection 和 HTML 序列化内核；工具栏图标来自 `@lucide/vue`。`@floating-ui/dom` 满足 `@tiptap/vue-3` 的 peer 依赖。

## 依赖边界

| 包 | 版本约束 | 用途 |
|---|---|---|
| `@tiptap/core` | `^3.29.2` | Editor 类型与核心运行时。 |
| `@tiptap/pm` | `^3.29.2` | ProseMirror peer 运行时。 |
| `@tiptap/vue-3` | `^3.29.2` | Vue 3 EditorContent 和生命周期绑定。 |
| `@tiptap/starter-kit` | `^3.29.2` | 文档、段落、标题、mark、列表、链接和历史扩展。 |
| `@tiptap/extension-placeholder` | `^3.29.2` | 空文档占位符。 |
| `@tiptap/extension-text-align` | `^3.29.2` | 段落和标题对齐。 |
| `@floating-ui/dom` | `^1.8.0` | Tiptap Vue peer 依赖。 |
| `@lucide/vue` | `^1.28.0` | 工具栏与复制按钮图标。 |

这些包属于 `@moluoxixi/components` 的直接 dependencies，安装组件包时会自动安装。Vite 库构建将 `@tiptap/*`、`@floating-ui/dom` 和 `@lucide/vue` 标记为 external，避免把编辑器运行时复制进组件包产物。

## 约束

- 所有 Tiptap 包保持相同 minor/patch 版本，避免 extension 与 core 命令类型不兼容。
- 不使用已弃用的 `lucide-vue-next`；Vue 图标统一从 `@lucide/vue` 导入。
- RichTextEditor 只输出 schema 允许的 HTML，但业务展示用户内容时仍须按信任边界执行 HTML 清洗。
- Tiptap/ProseMirror 的 Selection、IME、粘贴和历史行为使用真实浏览器 E2E 验证，happy-dom 单测只验证公共契约。

## 变更记录

- 2026-08-03：引入 Tiptap 3、Floating UI 和 `@lucide/vue`，用于 RichTextEditor。
