# 技术设计

## 架构边界

Tailwind 仅属于 `@config-form/workbench` 主应用的样式构建层。它不进入项目文档、编译产物、Prototype Runtime、iframe Runtime Host、Source generator 或 Provider adapter。Workbench 的 `src/styles/index.css` 仍是同步级联清单，新增专用 Tailwind 入口后由主入口统一加载。

```text
Workbench main entry
  -> src/styles/index.css
     -> foundation.css         全局 reset 所有者
     -> theme.css              --wb-* 主题 token 所有者
     -> feature owner CSS      第三方内部结构、复杂状态、媒体规则
     -> tailwind.css           清单最后一项；Tailwind theme + utilities，无 Preflight
        -> @source Export Dialog only

runtime-host.html
  -> Runtime Host 自有 bootstrap/styles
  -X-> Workbench tailwind.css
```

## Tailwind 入口

新增 `src/styles/tailwind.css`，使用 Tailwind v4 的拆分入口：

```css
@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/utilities.css" layer(utilities) source(none);

@source "../features/export/index.vue";

@theme inline {
  /* 将 Tailwind 语义名映射到现有 --wb-* 变量，不复制 palette 值。 */
}
```

不得使用完整的 `@import "tailwindcss"`，因为它会引入 Preflight。`source(none)` 是隔离合同，不可改为自动扫描；后续每迁移一个 Workbench owner，再显式增加一个窄 `@source`。

`tailwind.css` 必须是 `src/styles/index.css` 的最后一个 `@import`。Vite 的 Tailwind 插件会先把该入口展开成 `@layer` / `@property` 规则；若其后仍有 owner `@import`，PostCSS 会把这些导入判定为出现在普通规则之后。这个源码顺序不会提高 utility 的级联优先级：Tailwind 输出始终位于命名 layer，未分层的 feature owner CSS 仍按合同覆盖对应集成规则。

## 主题合同

`theme.css` 继续拥有 palette、明暗模式及 Element Plus 桥接。Tailwind 只声明别名，例如 `--color-wb-text: var(--wb-text)`、`--color-wb-surface: var(--wb-surface)` 和 `--shadow-wb-overlay: var(--wb-shadow-overlay)`。模板使用 `text-wb-text`、`bg-wb-elevated` 等语义 utility，不使用固定色阶替代产品 token。

本阶段沿用 `wb-*` utility 命名，不单独引入 `studio-*` 别名。现有 `--wb-*` 已是 Workbench 主题、Element Plus 桥接和 feature owner CSS 的统一语义词汇；只重命名 Tailwind 一侧会形成两套名称指向同一真值。若后续产品与包正式从 Workbench 迁移为 Studio，应在独立任务中原子重命名底层 token、桥接和 utility，而不是长期保留双命名空间。

## Export Dialog 迁移策略

下列职责迁入模板 utility：

- Workbench 自有 wrapper 的 flex/grid、尺寸、overflow、间距、字号和语义色。
- Header、body、footer 及 action group 等不依赖第三方根节点的普通布局。

下列职责保留在 `features/export/style/index.css`：

- `.el-dialog__header`、`.el-dialog__body`、`.el-dialog__footer` 等 Element Plus 内部结构。
- Dialog、ElAlert、ElButton 与 Source Viewer 根节点的集成尺寸、边框、状态和第三方内部结构。
- Element Plus 按钮 hover 等需结合内部组件状态的规则。
- 700px 以下的 dialog 强制全屏和需要稳定语义钩子的响应式规则。
- `color-mix()` 等用 utility 表达会明显降低可读性的复杂声明。

现有 `export-*` 与 `dialog-action` 类名保留为测试/语义钩子。迁移某项声明后必须从 CSS 删除对应旧声明，因为未分层 CSS 的优先级高于 Tailwind layer。

## 构建与兼容

- `package.json` 增加 `tailwindcss` 与 `@tailwindcss/vite` 的 `catalog:build` 开发依赖。
- `vite.config.ts` 注册官方 Tailwind Vite 插件；保留 Vue、自动组件和 Element Plus Sass 配置。
- 主 Workbench 构建同时包含 `index.html` 与 `runtime-host.html`，但 Runtime Host 只有自身入口显式导入的 CSS；测试需证明它没有导入 Workbench 样式清单。
- 不修改 Source Viewer 包。Workbench 只为 Viewer 根元素分配可用空间。

## 测试策略

单元合同测试检查配置与源码边界，而不是只断言 class 字符串：

- Tailwind 入口使用 theme/utilities 拆分导入、`source(none)`、精确 `@source`，且没有 Preflight。
- `@theme inline` 映射必要的 `--wb-*` token。
- Vite 使用官方插件，Runtime Host bootstrap 不导入 Workbench 样式清单。
- Export Dialog 模板包含关键 utility，保留 CSS 只拥有第三方根节点集成、复杂状态、Source Viewer 接入及响应式特例，不再拥有已迁移声明。
- 现有 Export Dialog 行为测试继续覆盖成功、单模式失败、刷新和禁用状态。
- Playwright 继续覆盖 Raw/Config 两种导出、桌面/移动端和 axe；必要时增加稳定的 computed-style/几何断言，证明 utility 确实生效。

## 回滚点

Tailwind 接入和 Export Dialog 迁移保持在同一任务中，但修改局限于 Workbench。若构建或样式合同无法稳定通过，可删除插件/入口并恢复 Export Dialog 自有 CSS，不涉及数据迁移或公共 API 回滚。
