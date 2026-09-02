# 技术设计

## 边界

修复分布在 `docs/vitepress`、`packages/vitepress-theme-element-plus`、组件文档和 GitHub CI。主题包继续拥有 CLI、公共内容组件和独立 consumer 验收；文档项目只提供作者内容、产品目录和项目配置。

## 方案

### 生命周期

为主题 CLI 补齐或复用 `preview` 命令，使预览与 `dev`、`build` 使用同一项目配置和仓库上下文。文档包的 `preview` 只能调用该入口，不能直接调用 VitePress。

### Demo

把 HeadlessTable 插槽返回的 `Cell` 通过 Vue 动态组件语法渲染。中英文示例保持结构一致。

### Consumer E2E 与 CI

将 fixture 作者页移动到配置声明的 `content/` 目录，由 prepare 投影到 `.generated/content`。E2E 先断言当前路径和 fixture 独有内容，再验证 Demo、Playground、ApiDocs，防止 404 回退产生假阳性。根 E2E 与 CI 显式加入主题 E2E及报告目录。

### Utilities 国际化

工具清单声明按 locale 可用的内容源。路由生成器仅为存在对应语言来源的工具生成页面；英文导航与搜索索引使用同一过滤结果。中文 README 不作为英文正文回退。

### Provider 标识

从已解析 provider ID 生成仓库入口图标。优先使用 VitePress 支持的内置品牌图标；没有内置图标的平台使用主题包拥有的可访问文本/自定义图标，不伪装成 GitHub。

### 源码目录

沿用 ConfigForm 目录规范的职责原则，但不复制其业务目录：主题包的 `src/node` 与 `src/markdown` 各自作为 feature，只保留 `index.ts`，将 CLI 生命周期、内容投影、准备流程、插件、服务、类型和工具放入明确的子目录并由局部 barrel 汇总。`docs/vitepress/.vitepress` 只保留 VitePress 约定入口与项目级 catalog/site/theme 配置，各子目录同样提供稳定 barrel。包根 `index.ts`、`node.ts`、`markdown.ts`、`repository-node.ts` 等 npm 入口只聚合当前 API，不承载业务逻辑，也不保留旧内部路径转发；公开 `./repository/node` 由 `repository-node.ts` 聚合，内部 repository barrel 只导出仓库职责。

目录调整只改变内部物理位置；公开导出名称、生成内容路径、仓库 provider 契约和页面运行语义不变。测试改为从当前 feature barrel 或公开入口导入，并增加结构门禁防止平铺文件回归。

## 风险与回滚

- `preview` 依赖 CLI 已有的 prepare 语义，必须验证不会重新同步不必要的 provider 数据。
- fixture 路径调整会改变截图，应只在功能断言稳定后更新基线。
- Utilities 过滤会减少英文页面数量，这是避免错误内容的预期行为；未来有英文 README 后可恢复对应路由。
- 每组改动均可按生命周期、Demo、E2E、国际化、图标独立回滚。
