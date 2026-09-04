# 富文本编辑器结构治理

## 目标

治理 rich-text-editor 的公开组件、插件入口与内部职责。

## 背景

- Manifest 仅登记一条本任务债务：公开编辑器实现位于 `src/index.vue`，没有进入 `src/components` 责任目录。
- 包根 `index.ts` 是稳定公开入口，提供命名导出、默认导出和 Vue plugin `install()`；`./styles` 是稳定样式入口。
- 发布 manifest 声明 `source: ./index.ts`，但 `files` 当前只包含 `dist`，导致 tarball 缺失 source condition 指向的 `index.ts` 与 `src`。
- 编辑器实现约 512 行，但当前仍是单一 TipTap 生命周期、受控值、工具栏和链接面板 owner；本任务不按行数机械拆分行为。

## 需求

- 清零 manifest 中归属本任务的组件所有权债务。
- 将实现归入 `src/components/RichTextEditor`，通过 `src/components/index.ts` 暴露责任边界，包根只编排公开组件与 types。
- 保持命名导出、默认导出、组件名和 Vue plugin 安装行为不变，并增加公开入口回归测试。
- 将根 `index.ts` 与 `src` 纳入发布文件，保证 workspace source condition 和发布 tarball 一致。
- 新增默认中文 README，说明组件导入、插件安装、样式入口和主要 props/expose 用法。
- 保持编辑器公开 API、内容模型和交互行为不变。

## 验收标准

- [x] `src/index.vue` 不存在，实现位于 `src/components/RichTextEditor/index.vue`，责任 barrel 仅导出。
- [x] 对应 architecture debt 删除且没有新增 unknown/stale 诊断。
- [x] 根入口的命名/默认导出、组件名、plugin install、公开 types 与 `./styles` 保持不变。
- [x] 发布 tarball 包含 `index.ts`、`src`、README 和 `dist`，typed/Node/browser smoke 通过。
- [x] 包级 test、typecheck、build、全仓 architecture/lint 与 `git diff --check` 通过。

## 约束

- 不保留旧私有路径 forwarding shim。
- 不在本任务中改变无关公共行为或格式化无关文件。
- 不拆分 TipTap 编辑器内部交互，不改变 HTML 输出、toolbar、link、disabled/readonly 或 expose 语义。
