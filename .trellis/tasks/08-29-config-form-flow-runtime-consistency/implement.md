# 实施计划

## 顺序

- [x] 1. 为 Core 解释器补失败用例：忽略 signal 的 action、正常完成 listener cleanup、queued abort、latest/queue/ignore 重叠调度。
- [x] 2. 重构 Core abort scope 与 queue 生命周期，使所有 run 确定性结算并保持公开类型兼容。
- [x] 3. 在 Workbench preview 层新增 `PreviewFlowCoordinator` 及值差量/投影聚合单测。
- [x] 4. 将 `App.vue` 的 `runPreviewFlows` 接到 coordinator，删除全局 trigger revision，并验证 revision/page/unmount 清理。
- [x] 5. 更新独立 Source 的自包含流程 runtime，加入显式 status、按 Flow 投影保留、abort scope 和差量提交。
- [x] 6. 建立可执行生成源码测试，覆盖 latest、queue、ignore、abort、timeout、错误策略及多 Flow 顺序；保留完整工程构建测试。
- [x] 7. 执行浏览器验证：page.mount、form.submit、field.change，重叠触发、页面切换、控制台与 Flow 弹窗回归。
- [x] 8. 完成反证式审查：确认测试不是只检查实现关键字，确认不运行 Flow 时现有表单、导出和多页面行为无回归。

## 质量门

- [x] `pnpm --filter @moluoxixi/config-form-core test`
- [x] `pnpm --filter @moluoxixi/config-form-core typecheck`
- [x] `pnpm --filter @config-form/workbench test`
- [x] `pnpm --filter @config-form/workbench typecheck`
- [x] `pnpm --filter @config-form/workbench build`
- [x] `pnpm test:config-form-packages`
- [x] 相关包 lint 与 `git diff --check`
- [x] 至少一个 Element Plus 和一个 Ant Design Vue 导出工程安装、type-check、build

## 高风险点

- `packages/ConfigForm/core/src/flow/interpreter.ts`：active/queue 的所有结算路径必须保持一一对应。
- `packages/ConfigForm/workbench/src/App.vue`：revision 生命周期、Preview refs 和 coordinator 的发布边界。
- `packages/ConfigForm/workbench/src/project/export/source.ts`：模板字符串修改必须由可执行测试和工程构建共同约束。

## 开工前复核

- [x] PRD、设计和本计划已经用户确认。
- [x] 读取 Core、Workbench、Designer 的适用规范以及 `trellis-before-dev`。
- [x] 确认工作区无无关改动；不触碰 `.trellis/tasks/08-28-migrate-vercel-ai-sdk`。

## 验证记录

- Core：34 tests；typecheck、build 通过。
- Runtime：200 tests；typecheck、build 通过；真实父组件 `v-model` 回归覆盖外部替换与单次回传。
- Workbench：119 tests；typecheck、production build 通过；仅保留既有大 chunk 警告。
- ConfigForm 包矩阵：11/11 构建成功，公共包边界验证通过。
- 真实导出工程：Element/Ant 完整工程与纯 Source 工程共 4 套，均完成 install、typecheck、build。
- 浏览器：`page.mount`、`field.change`、工具栏真实 `submit()` 驱动的 `form.submit` 均更新 Preview；操作时间戳后无新增 warning/error。
- ESLint：本次 TypeScript 变更无错误；仓库 ESLint 当前未匹配两个 `.vue` 文件，该现状由 Vue typecheck、测试和生产构建补充覆盖。
- `git diff --check` 通过；仅有仓库既有 LF/CRLF 提示。
