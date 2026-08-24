# 文档路由壳生成物收敛

## 目标

把不可编辑、可再生产的组件与工具 Markdown 路由壳从 Git 源码中移除，由文档 `dev/build` 的 prepare 生命周期自动创建和刷新；保留真实作者正文、VitePress 本地搜索、国际化导航与公开 URL。

## 背景

- 当前 Git 跟踪 40 个带 `Generated ... Do not edit directly` 标记的路由壳：中英文组件各 13 个，中英文工具各 7 个。
- 组件真实正文位于组件 package 的 `docs/index.md` / `docs/index.en.md`，工具真实正文位于对应 package README。
- `components/index.md`、`en/components/index.md`、`utils/index.md`、`en/utils/index.md` 是人工维护的概览页，生成器明确保留，不能按生成物删除。
- `element-plus-docs dev/build` 已在 VitePress 扫描页面前运行组件和工具路由生成器。
- 当前中文默认 locale 使用内容根与根 URL；不存在 `docs/vitepress/zh/`，英文使用 `en/` 和 `/en`。

## 需求

- R1. 从 Git 索引移除且只移除 40 个生成路由壳；保留四个概览 `index.md`、guide、playground、首页和 changelog 等作者文件。
- R2. `.generated/content/` 是 VitePress 运行时内容根，按 locale 分为 `zh/`、`en/`；普通页面、组件页和工具页均位于各 locale 内，整个目录统一受现有 ignore 管理。
- R3. `pnpm -C docs/vitepress dev`、`build` 和 `prepare:docs` 在干净 checkout 下先重建 runtime content tree，再生成完整中英文组件/工具路由，最后由 VitePress 消费。
- R4. 路由生成测试自行建立生成前置条件，不依赖仓库预提交产物；测试结束不污染 Git 状态。
- R5. 本地搜索继续索引每个组件/工具独立页以及组件 `searchAliases`，中英文搜索分桶不变。
- R6. 中文作者源统一放入 `docs/vitepress/zh/`、英文作者源放入 `en/`；runtime staging 对称投影到 `.generated/content/zh`、`.generated/content/en`。VitePress 将 `zh/**` rewrite 到根 URL，英文继续使用 `/en/**`。
- R7. 中英文主题复用文档与 docs code-spec 明确路由壳是 ignored build-time 内容产物。
- R8. `public/logo.svg` 随 runtime staging 同步；是否保留作者页 lastUpdated 作为独立展示决策，不得混称为作者/贡献者信息。
- R9. dev server 监听作者源与 public assets，将新增、修改和删除增量同步到 runtime staging，并触发 VitePress 热更新。

## 验收标准

- [ ] `git ls-files` 不再列出 40 个生成路由壳，但仍列出四个概览页和所有作者正文。
- [ ] 删除生成壳后执行 prepare/dev/build 可重新生成 26 个组件页和 14 个工具页。
- [ ] prepare/build 后所有 runtime 页面只位于 `.generated/content/{zh,en}`，components/utils 位于各 locale 子树，`git status --short` 不含任何 runtime content。
- [ ] 中文物理内容位于 `zh/`，但首页仍为 `/`，组件/工具仍为 `/components`、`/utils`；英文仍为 `/en/...`。
- [ ] 中英文组件、工具导航和 local search 均正常，搜索结果不暴露 `/zh` 前缀。
- [ ] docs 测试、typecheck、GitHub/local 生产构建和路径契约测试通过。

## 不在范围

- 不把组件 package 的真实 `docs/index*.md` 或工具 README 改成生成物。
- 不删除四个概览 `index.md`。
- 不用当前 VitePress 动态 route loader 替代物理 Markdown；其 local search 不索引 loader 内存 content。
- 不复制 `.vitepress` 配置、scripts、node_modules 或 package metadata 到 runtime content tree；只投影明确的作者内容和 public assets。

## 关键决策

- runtime content 使用对称的 `content/{zh,en}` 物理目录；`zh` 通过 rewrite 只在运行时物理路径存在，公开 URL 不带 `/zh`。
- components/utils 路由壳只存在于 `.generated/content/{zh,en}/{components,utils}`，不在作者源目录留下 ignored 文件。
