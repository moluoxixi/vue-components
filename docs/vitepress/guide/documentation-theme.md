# 文档主题与复用

文档方案保留 VitePress `DefaultTheme` 作为布局运行时，并在其上组合组件库专用的页面生成、API、示例、GitHub 元数据和视觉样式。这样可以直接复用 VitePress 已验证的本地搜索、响应式导航、本页目录、暗色模式、上一页/下一页和无障碍行为。

## 迁移到另一个组件库

1. 复制 `docs/vitepress`，并在它的 `package.json` 中把组件库 workspace 依赖替换为目标包。
2. 修改 `.vitepress/docs-site.ts`。品牌、logo、包名、API 入口、样式入口、GitHub 仓库、组件源码根目录、公开路由和 locale 路径都在这里定义。主题通过 `@docs-components` 稳定别名消费目标包，无需再改 Vue 组件中的 import。
3. 修改 `.vitepress/component-manifest.ts`，使其与新组件库的公开 Vue 组件一一对应。API 提取器会从 `componentEntry` 读取契约，并在缺失或多出组件时终止构建。
4. 可选在 `<componentRoot>/<Component>/docs/index.md` 和 `index.en.md` 编写正文与示例。没有正文时，路由仍会生成标题、简介、API 和贡献者，头部固定提供组件更新日志弹窗入口。
5. 调整 `.vitepress/docs-i18n.ts` 的文案。`docsLocales` 驱动 VitePress locale、路由前缀、rewrite 和源文档文件；新增语种时再为该语种添加一个与 `en/routes/[slug].paths.mts` 相同的薄路由适配文件。
6. 运行 `pnpm --dir docs/vitepress sync-github-metadata` 生成新快照，再运行 `pnpm --dir docs/vitepress build`。

普通 `dev` 和 `build` 不访问 GitHub，只读取已提交的 `.vitepress/github-metadata.json`；但会先校验仓库身份、manifest 覆盖、组件路径和数据结构，不会把缺失数据静默显示为 0。同步命令支持 `GITHUB_TOKEN`，会固定配置分支的 head、处理分页、排除 Pull Request，并在完整成功后替换旧快照。

组件 API 名称、类型和描述来自源码契约，不在 Markdown 中重复维护。主题操作文案和生成页面框架完整支持中英文；组件正文和源码 JSDoc 的翻译由 locale 源文档与组件作者逐步补齐。

## 为什么不完全重写主题

完全重写只能移除一层 DefaultTheme 依赖，却需要重新实现搜索、移动端菜单、键盘导航、目录同步、暗色模式、locale 切换和文档翻页。当前项目的定制需求集中在内容生成、API 表格、GitHub 数据和视觉 token，DefaultTheme 并未阻碍这些边界。因此继续扩展 DefaultTheme 是当前评估结果；只有当产品需要完全不同的信息架构时，才值得替换布局运行时。
