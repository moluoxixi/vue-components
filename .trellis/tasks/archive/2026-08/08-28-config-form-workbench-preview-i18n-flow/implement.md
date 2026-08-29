# 生产级画布与事件编排实施计划

## 阶段 0：基线与视觉验收样例

- [ ] 固化现有 Designer/Workbench 的组件矩阵、嵌套层级、响应式断点、Light/Dark 截图和 Preview DOM 快照。
- [ ] 为每个内置 material 建立“同一 Model 在 RuntimeSurface design/preview 下的 DOM/layout 对比”基线。
- [ ] 记录当前 Sortable ghost、slot fallback、末尾 drop、date/time 宽度和多级嵌套的失败用例，作为重构前后对照。

## 阶段 1：共享 RuntimeSurface

- [ ] 从 `packages/ConfigForm/runtime/src/renderer/ConfigFormRenderer.vue` 抽取递归渲染、slot、响应式 layout 和 field binding 原语，新增 `RuntimeSurface`/metadata hook。
- [ ] 让 runtime node cell 暴露稳定 `data-config-node-id`、path、slot 和可测量边界；保证不会破坏现有 ConfigForm API。
- [ ] 在 `packages/ConfigForm/designer` 删除 `DesignerNodePreview` 的组件级重复渲染路径，改为 RuntimeSurface + editor context。
- [ ] 增加 `designPolicy`/副作用隔离：事件拦截、网络/计时器/导航 adapter、unsafe diagnostic；默认仍使用真实注册组件和真实 CSS。
- [ ] 验证 Canvas 与 Preview 使用相同 Model、Registry、props、slot 和 breakpoint 时 DOM 树与布局一致。

## 阶段 2：Candidate Drag + EditorOverlay

- [ ] 新增 `DragSession`、`DropTargetDescriptor`、`DropTargetResolver` 和 candidate model reducer；源节点/Palette 物料均走同一条路径。
- [ ] 评估并接入 Pragmatic Drag and Drop element adapter；禁止 SortableJS 自动重排业务 DOM，必要时保留仅用于兼容层但 `applyDefault=false`。
- [ ] 将 candidate snapshot 交给 RuntimeSurface 渲染，拖拽 ghost 只增加 opacity、shadow 和 pointer-events:none；移除静态 summary/slot fallback 作为最终预览。
- [ ] 新增 EditorOverlay：selection bounds、hover、before/after/inside indicator、resize handle、diagnostic spot；使用 ResizeObserver + requestAnimationFrame 测量。
- [ ] 覆盖深层嵌套、跨容器、最后一个元素、空 slot、非法 target、取消、越界、自动滚屏、触控和键盘拖拽。

## 阶段 3：Flow IR 与 deterministic Interpreter

- [ ] 在 `packages/ConfigForm/core/src/flow/` 定义 versioned JSON-only IR、schema、graph analysis、semantic hash 和 Model Operations。
- [ ] 扩展 `LowCodePageModel.flows`、migration、history inverse 和 registry diagnostics；任何函数/源码/未知 ref 都拒绝。
- [ ] 实现 `FlowExecutionPlan` 与 deterministic interpreter：trigger、condition、reaction、action、success/failure/end、事件队列和可达性校验。
- [ ] 实现 Flow Action Registry、schema validation、AbortController、timeout、latest/queue/ignore concurrency 和 stale revision 隔离。
- [ ] 以 adapter 形式接入 XState actor/invoke（如确有需要）；增加“无 XState 执行计划测试”和 adapter 等价性测试。

## 阶段 4：Flow Workspace

- [ ] 引入 Vue Flow，开启 controlled mode；实现节点面板、custom nodes/handles/edges、条件标签和即时连接校验。
- [ ] 新增 Flow workspace/辅助视图，复用现有三栏 shell、Inspector、i18n、theme tokens 和 Export Preview。
- [ ] 所有新增/连接/删除/复制/移动/配置操作接入 Model command dispatcher、batch、Undo/Redo 和 revision coordinator。
- [ ] Preview 监听 Flow runtime trace，显示 action 状态、错误节点和取消原因，但不把 runtime state 写回 Model。

## 阶段 5：Config / Source / 工程导出

- [ ] 在 `config-codec` 中实现受控 `defineFlow()` AST 生成/诊断，Config 弹窗继续只读 JSON/Tree/TS。
- [ ] 重写 standalone Source generator，输出不使用 ConfigForm DSL 的 Vue/TypeScript 工程，包含流程事件入口、条件、reaction、registry action、Abort/timeout 和错误分支。
- [ ] 生成完整 `package.json`、入口、样式、类型声明和 registry dependency manifest；revision stale 或缺依赖时禁止下载。
- [ ] 新增导出快照、复制/下载、type-check、Vite build、旧模板迁移和文件树浏览器测试。

## 阶段 6：生产质量门禁

- [ ] 运行 core、runtime、designer、workbench 全量 lint/typecheck/unit/integration/browser/visual regression。
- [ ] 使用 1440px、900px、390px，Light/Dark，date/time、所有 Element Plus/Ant Design materials 和三层嵌套做矩阵测试。
- [ ] 检查单一 Model 数据流，清理 source/config drafts、DOM reorder、双向 watch 和旧 preview fallback。
- [ ] 更新 `.trellis/spec/`、架构 README、组件注册表文档、Flow Action Registry 文档和故障排查指南。

## 关键验证命令

```powershell
pnpm --filter @moluoxixi/config-form-core test
pnpm --filter @moluoxixi/config-form-core typecheck
pnpm --filter @moluoxixi/config-form typecheck
pnpm --filter @moluoxixi/config-form-designer test
pnpm --filter @moluoxixi/config-form-designer typecheck
pnpm --filter @config-form/workbench test
pnpm --filter @config-form/workbench typecheck
pnpm --filter @config-form/workbench build
pnpm --filter @config-form/workbench verify:templates
```

高风险改动点：runtime renderer 的递归/slot 原语、`DesignerNodePreview` 替换、拖拽 adapter、Model history、Flow interpreter、Preview coordinator、`config-codec` 和 standalone Source generator。每个阶段独立提交并保留 feature flag，便于回滚。

## 本轮执行记录（2026-08-29）

- 已完成并验证 Core Flow IR、Execution Plan、Interpreter、语义 hash、并发/取消/超时和模型操作校验。
- 已完成并验证 RuntimeSurface 的公开入口、节点 metadata、设计态事件拦截，以及 Designer 候选拖拽预览和嵌套/末尾投放修复。
- 已完成并验证 Workbench Flow 面板、只读 Config/Source 导出弹窗、完整 standalone Source 工程文件树、revision 隔离和暗色主题边界。
- FlowWorkspace 支持显式 `DesignerLocaleOptions` 并保留 provider fallback；Workbench 将同一 locale 同时传给 Designer 与 Flow，覆盖兄弟组件无法读取 Designer 内部 provider 的边界。
- Workbench 在模型提交和持久化读取时会校验宿主 Flow Action Registry。
- 全量测试通过：core 31、runtime 198、designer 128、designer-antd-vue 16、designer-element-plus 23、workbench 86，共 482 个测试。
- 全仓 `pnpm typecheck`（61/61 tasks）、`pnpm lint`、Workbench production build 和 `git diff --check` 均通过。
- 离线 `verify:templates` 完成 4/4 集成构建：Element Plus/Ant Design 运行时工程以及两种 standalone Source 工程均安装、type-check、Vite build 通过。
- Source 导出补齐了并发策略（latest/queue/ignore）、Abort/timeout、field.change 入口、reaction 投影和 revision 防旧结果覆盖；Core Interpreter 的 `onError: 'end'` 语义也有回归测试。
- 浏览器实测：1422px 暗色外壳为 `rgb(15, 16, 18)`，Runtime sheet 保持白色；页面无横向溢出；导出项保持 `nowrap` 且约 32px 高；Flow 以独立 modal 打开并可正确关闭。

本轮实现与质量检查已完成；后续按产品发布流程执行 commit/归档即可。
