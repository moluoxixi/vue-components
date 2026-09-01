# ConfigForm 独立模板管理实施计划

## 实施顺序

- [x] 1. 建立 JSON-safe template manifest、seed、Provider 与 catalog service；加入四个本地内置模板和稳定诊断码。
- [x] 2. 抽取通用 page identity remap，覆盖 node/field/reaction/flow 引用和确定性 factory；保留现有模板 API 的薄兼容层。
- [x] 3. 建立 compatibility/instantiate/preview service，复用 Model schema、Registry、Compiler、`createProjectSnapshot` 和 `PreviewRuntimeHostFrame`。
- [x] 4. 将 UI 状态改为 App 级 `designer | create` 视图与显式 `project | page` 目标；删除 `templatePickerOpen`、`TemplateDialog` 和隐式 `selectTemplate`。
- [x] 5. 新建 `TemplateCreationWorkspace`，完成搜索、category/provider filter、目录键盘、详情、真实 Runtime 预览、阻断诊断、busy/empty/error 状态。
- [x] 6. 接通首启、Topbar、Pages 的新建项目/页面入口和返回焦点；创建项目走 Repository，创建页面走一次 Project Command。
- [x] 7. 补齐 locale、Light/Dark 与 1440/900/390 CSS；迁移 E2E helper 和视觉快照。
- [x] 8. 更新架构边界测试、ConfigForm README 和必要的 state spec，确认 Designer/Runtime/Project 边界未回流。
- [x] 9. 执行定向测试、两套 provider E2E、axe、视觉检查、typecheck/build、根 lint 与 ConfigForm gate。
- [x] 10. 自我质疑至少两轮：先审查数据/事务/竞态，再审查 UI/键盘/长文本/移动端；每个发现都要有代码或测试证据。

## 重点测试矩阵

### Catalog 与实例化

- 非法/重复/危险 template/provider id、非整数 version、非 JSON seed、unknown category/adapter。
- Provider rejection、跨 Provider id 冲突、稳定排序和 service 返回深只读副本。
- 四个内置模板 schema-valid；blank 为零节点，profile 为三字段且名称本地化。
- 同模板连续实例化的 project/page/node/field/reaction/flow identity 全部不同；源 seed hash 不变。
- 映射后 root/slot/validation/condition/reaction/flow 引用一致；opaque config 不被字符串替换。

### 兼容性与原子性

- project target 的 Element/Ant adapter/Registry 成功矩阵。
- page target 同 provider 可创建，跨 provider、缺组件、版本/fingerprint 不匹配禁用并诊断。
- compiler 预检失败、Repository create 失败、Project Command 失败、过期请求和双击均不改变当前会话或产生半实体。
- page add 只增加一次 editVersion/history，Undo/Redo 完整移除/恢复页面。

### UI 与 Runtime

- 搜索/筛选/无结果、选中/详情、目录 ArrowUp/Down/Home/End/Enter、Escape/Back 和焦点恢复。
- 预览 adapter 快速反序切换不显示 stale 结果；Runtime 输入不污染 active Preview。
- 1440/900/390 × Light/Dark × zh-CN/en-US；长 displayName、长 Registry key 和多条 diagnostics。
- Element Plus 与 Ant Design Vue 的项目/页面创建、RuntimeHost 可见性和 Designer 返回路径。
- axe 对首次创建、目录、兼容错误、移动详情和成功返回状态均无 WCAG A/AA 违规。

## 验证命令

```bash
pnpm --filter @config-form/workbench test
pnpm --filter @config-form/workbench typecheck
pnpm --filter @config-form/workbench build
pnpm --filter @config-form/workbench test:e2e
pnpm test:config-form-packages
pnpm lint
git diff --check
python ./.trellis/scripts/task.py validate .trellis/tasks/08-31-config-form-template-management
```

Playwright 必须显式包含：

```bash
pnpm --filter @config-form/workbench exec playwright test e2e/template-management.spec.ts e2e/accessibility.spec.ts --config playwright.config.ts
```

## 高风险文件与回滚点

- `src/app/WorkbenchShell.vue`、`src/App.vue`、`src/app/workbench-ui-store.ts`：先完成 App 级 view coordinator 再删除旧 Dialog，避免无入口状态。
- `src/app/workbench-controller.ts`：保持 Repository/Project Command 事务边界，不把 compiler 或 browse state 移入 controller。
- `src/project/templates/**`：兼容导出必须在现有 export/fixture 测试通过后再收口。
- `src/project/identity-remap.ts`：任何引用映射缺口都必须先修复并加 fixture，不允许通过跳过 schema 校验推进。
- `src/runtime-host/**`：原则上不改协议；若预览需要协议变更，返回设计阶段重新评审。
- E2E 快照：只接受人工查看后的目标差异，不用无差别 update 掩盖布局回归。

## 开工前检查

- [x] PRD、design、implement 已由用户在最终规划摘要之后明确批准。
- [x] `implement.jsonl` 与 `check.jsonl` 均为真实 spec/research 条目。
- [x] `task.py start` 成功，任务状态为 `in_progress`。
- [x] 实现前加载 `trellis-before-dev`；实现完成后运行独立 `trellis-check`。
