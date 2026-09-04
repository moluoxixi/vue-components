# 发布包源码与 README 合同收口

## 目标

修复发布包中 `exports["."].source`、`files`、包内 README 和 `sideEffects` 的一致性，并让静态门禁在发布前阻止同类回归。

## 背景

- `ajax-package`、`eslint-config`、`excel`、`indexed-db`、`postcss-selector-prefix`、`utils` 声明 `source: "./index.ts"`，但发布 `files` 未包含 `index.ts` 与 `src`。
- `ConfigForm/designer`、`designer-antd-vue`、`designer-element-plus`、`vue-backend` 和 `vitepress-theme-element-plus` 是发布包，但缺少包根 README。
- `ai-doc-assistant` 与 `hooks` 未显式声明 `sideEffects`；复核确认 `hooks` 是纯导出，而 `ai-doc-assistant` 的 CLI 和独立 UI 是执行入口，必须保留精确副作用模式。
- 全量入口复核还发现 `i18n-tool` 的独立 UI 和 `vitepress-theme-element-plus` 的 CLI adapter 与其既有 `sideEffects` 声明不一致，需要在同一发布合同批次修正。
- 现有 packed consumer 验证覆盖运行时和类型入口，但 package architecture 尚未静态检查上述元数据合同。

## 需求

- 六个具有源码导出条件的包必须把 `index.ts` 与 `src` 纳入发布文件清单，且不改变现有运行时、类型或子路径导出。
- 五个缺失 README 的发布包必须增加默认中文包内 README，至少说明职责、安装、基本用法、公开入口和开发验证；英文文档可作为链接或补充，不作为默认入口。
- 所有发布包必须依据真实副作用行为显式声明 `sideEffects`；本批修正 `ai-doc-assistant`、`hooks`、`i18n-tool` 与 `vitepress-theme-element-plus`，不得为了通过门禁错误 tree-shake CLI、UI mount 或样式入口。
- package architecture 增加发布文件、README 与显式 `sideEffects` 检查，并以 fixtures 覆盖正反例。
- 不修改公共 API，不移动生产实现，不改 release workflow。

## 验收标准

- [x] 六个目标包的 packed tarball 同时包含根 `index.ts` 与 `src/`，source condition 不再指向缺失文件。
- [x] 五个目标发布包均有内容准确的中文 `README.md`，示例只使用真实公开入口。
- [x] 所有发布包显式声明与真实行为一致的 `sideEffects`。
- [x] package architecture fixtures 能分别阻止 source/files 不一致、README 缺失和 `sideEffects` 缺失。
- [x] `pnpm test:package-architecture` 通过且 33 个包保持 0 tracked debt。
- [x] `pnpm test:pack` 以及目标包 lint、typecheck、test、build 通过。
- [x] `git diff --check` 通过，未包含用户现有 release workflow 修改。

## 范围外

- 不重写已有包 README 的文案或文档站结构。
- 不新增发布流程或改变 npm 发布策略。
- 不借此任务调整包入口、导出名称或运行时行为。

## 阻塞问题

无。
