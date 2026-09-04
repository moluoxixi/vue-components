# 富文本编辑器结构治理实施计划

1. [x] 锁定根命名/默认导出、组件名和 Vue plugin 安装契约。
2. [x] 将 `src/index.vue` 移至 `src/components/RichTextEditor/index.vue`，更新本地相对导入。
3. [x] 增加组件 feature/responsibility barrels，并让包根只编排当前公开边界。
4. [x] 将 `index.ts` 与 `src` 纳入 package files，新增默认中文 README。
5. [x] 删除 manifest 精确 debt，扫描 deep import、barrel、types/runtime、composable 与 P0/P1/P2 风险。
6. [x] 运行 package test/typecheck/build、architecture、packed Node/browser、全仓 lint 与 `git diff --check`。
7. [x] 独立只读复核后提交、归档并记录 journal，不 push。

## 验证证据

- 包级基线与实现后测试：`5/5`；typecheck、build 通过，产物保持 `dist/index.js`、`dist/index.d.ts` 与 `dist/rich-text-editor.css`。
- Components Playground RichTextEditor 浏览器场景：`1/1`，输入、粗体与 HTML 同步通过。
- Package architecture：`11/11`，tracked debt 从 84 降至 83，Rich Text Editor debt 清零。
- Packed verifier：全部发布 export 通过；23 个 browser JS entries、3 个 stylesheet entries 与 packed applications 通过 8 个浏览器批次。
- `pnpm test:path-contracts`：`8/8` 并通过 playground typecheck；`pnpm lint` 与 `git diff --check` 通过。
- 三个探索审计和一个最终只读审计未发现阻断；确认 SFC 除相对 import 外行为等价，barrel 均为 export-only。
