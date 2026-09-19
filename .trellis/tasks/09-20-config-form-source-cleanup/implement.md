# ConfigForm Source 收尾实施计划

## 执行门禁

- [x] 用户已确认按 ConfigForm 产品边界执行；运行 `task.py start` 后加载 `trellis-before-dev`。
- [x] 记录并保护当前用户改动；实现和提交均按明确 path/hunk 操作。
- [x] 不增加兼容层，不放宽测试、不禁用门禁、不直接接受视觉快照。

## 阶段 1：清理 ExportSnapshot 身份

- [x] 从 snapshot types/services/barrels/consumers/tests 删除 `CONFIG_FORM_EXPORT_GENERATOR_VERSION`、`generatorVersion` 和 `currentGeneratorVersion`。
- [x] 保留 compilation key、committed/draft origin stale 判定、双文件集冻结和失败保留旧快照行为。
- [x] 调整单测，使每条身份和原子刷新行为有独立可失败断言。

## 阶段 2：硬切 Source archive API

- [x] 将 `WorkspaceArchiveInput`、`createWorkspaceArchive`、`downloadWorkspaceArchive` 一次性改为 Source 命名。
- [x] 更新 export Dialog、barrel 和 archive/download 单测，不导出旧 alias。
- [x] 删除模板测试中的重复 archive 用例，由 export snapshot/download 测试唯一拥有该行为。

## 阶段 3：清理死文案与旧路径

- [x] 在保留用户新增 JSON 文案的前提下，仅删除无引用的 `fileTree.generatedSource` 中英文项。
- [x] 扩展 Workbench architecture removed-path/symbol 断言，覆盖旧 generator/viewer/archive 残留。
- [x] 用 `rg` 复核当前生产代码和当前规范；排除 archive task、历史 Changeset 与 git 历史。

## 阶段 4：硬切 Core response 合同

- [x] 将 value-reference type/context/parser/evaluator 从 event 改为 response，并将 Data Source runtime 注入改为 `response`。
- [x] 更新 Core 单测与 README；增加旧 `kind: 'event'`、`$event` 和旧上下文字段的负向覆盖。
- [x] 增加窄范围架构门禁，证明 response 注入点不再出现旧符号，同时保留合法 UI/Runtime 事件。
- [x] 添加 `@moluoxixi/config-form-core` minor Changeset，不修改已有 Changeset。

## 阶段 5：更新长期规范

- [x] 收敛 Designer state management 中过时的导出快照章节，把所有权指向 Workbench。
- [x] 更新 Workbench quality、Core architecture、Studio domain contracts 与 ConfigForm ROADMAP。
- [x] 文档统一使用 `rawSource`、`configBindings`、`SourceFileSetV1` 和 response 语义。

## 阶段 6：验证

- [x] Source：test、typecheck、build、Node import smoke、generated consumer。
- [x] Core：test、typecheck、build，重点覆盖 value-reference 与 Data Source。
- [x] Workbench：单 worker 全量 unit，确认 44 files / 540 tests 或更新后的完整计数全绿。
- [x] 架构：compiler、Workbench、ConfigForm boundaries 定向门禁全绿。
- [x] E2E：定向运行 `exports pinned source and config files through the readonly workspace`、`keeps raw and ConfigForm exports read-only and dependency-distinct` 与 Source accessibility 场景。
- [x] 复跑完整 Workbench E2E，确认 Source 失败为 0；既有 UI/视觉失败按最终范围处理或如实列出。
- [x] 运行 `git diff --check`，再逐 path/hunk 审计暂存范围，确保不含用户 JSON/Workbench 改动。

建议命令：

```powershell
pnpm --filter @moluoxixi/config-form-source test
pnpm --filter @moluoxixi/config-form-source typecheck
pnpm --filter @moluoxixi/config-form-source build
pnpm --filter @moluoxixi/config-form-core test
pnpm --filter @moluoxixi/config-form-core typecheck
pnpm --filter @moluoxixi/config-form-core build
pnpm --filter @config-form/workbench test
pnpm --filter @config-form/workbench typecheck
pnpm exec vitest run scripts/__tests__/config-form-boundaries.test.mjs
pnpm --filter @config-form/workbench exec playwright test --config playwright.config.ts --workers=1 --grep "exports pinned source|keeps raw and ConfigForm exports|auxiliary workspaces accessible"
pnpm test:package-architecture
git diff --check
```

`pnpm test:package-architecture` 的无关既有违规不得通过 allowlist 隐藏；本任务记录并排除 `qiankun-router-kit` 与 `vite-plugin-style-scope` 的既有债务。

## 提交与回滚点

- [x] `trellis-check` 完成 spec、lint/typecheck、测试、依赖方向和脏工作区复核。
- [x] `trellis-update-spec` 固化最终合同。
- [ ] 仅暂存本任务拥有的 hunk，提交后再验证用户工作区改动仍完整存在。
- [ ] 任一阶段出现无法隔离的用户改动冲突时停止该文件，不通过覆盖或回滚解决。

## 验证记录

- Source：7 files / 50 tests；typecheck、build、Node import 与生成消费工程 typecheck/build 通过。
- Core：12 files / 102 tests；typecheck、build、Runtime 消费者 typecheck 与定向 ESLint 通过。
- Workbench：44 files / 538 tests；typecheck、build、Element Plus/Monaco bundle 检查通过。减少的 2 项为本任务删除的 generator drift 与重复 template archive 用例。
- 架构：Compiler 2/2、ConfigForm boundaries 7/7、Workbench architecture 17/17 通过。全仓 package architecture 仍仅有范围外两个包的 27 条既有债务。
- E2E：Source 双导出和两个 provider accessibility 共 4/4 通过；任务早期完整基线为 39 通过、37 失败，Source 直接失败为 0，失败仍是 21 项既有 UI 漂移与 16 项待审主题基线。
- `pnpm changeset status` 与 `git diff --check` 通过；Changesets 仍输出仓库既有 peer-range 提示。
