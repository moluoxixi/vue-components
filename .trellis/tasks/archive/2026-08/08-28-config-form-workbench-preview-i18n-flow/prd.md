# 生产级 Design-first 画布与事件编排

## 目标

把当前“设计态预览”和“运行态预览”之间的渲染差异彻底消除，建设可投入生产的 Design-first 编辑器：用户在真实 Runtime 组件树上设计，拖拽过程中看到的也是同一棵组件树的候选投影；选择框、投放线、尺寸句柄和工具栏属于独立编辑覆盖层，不改变业务渲染。

同时引入受控的页面事件编排能力，用可审计、可序列化的流程图替代散落的配置化表单函数。画布、流程运行时、Preview、Config 和 Source 都从同一份 Config Model 产生，任何异步结果都不能越过 revision 边界污染新状态。

## 背景与证据

- 当前 `DesignerPalette.vue` 为物料单独渲染 `DesignerNodePreview`，容器 slot 使用 fallback；`DesignerNodeList.vue` 依赖 SortableJS ghost/clone，再在 drop 结束时提交 Model。
- Canvas 的 `DesignerNodePreview` 与 Runtime 的 `ConfigFormRenderer` 是两套渲染入口；因此响应式布局、容器 slot、组件默认值和副作用无法保证完全一致。
- GrapesJS 使用 Component Model + View 渲染真实组件，并用 Canvas Spots 作为独立 target/select overlay；Craft.js 用 connect/drag connector 把真实 DOM 注册为可选中、可拖拽、可投放节点；Plasmic 用 host frame 隔离真实组件运行环境；Builder 用注册表同时驱动编辑器输入和 Runtime；Pragmatic Drag and Drop 提供 nested target、preview 和 drop 生命周期；Vue Flow 要求 controlled flow 手动提交变化。
- Core 已有 JSON-only `ConfigFormReactionCondition` 与 effects，可直接复用到事件流程；当前工作台没有稳定的 Flow IR 或执行计划。

## 产品需求

### R1. RuntimeSurface：一套真实渲染入口

- Design Canvas 和 Preview 必须调用同一个 `RuntimeSurface`/renderer，使用同一 Registry、默认 props、responsive layout、slot 解析和字段绑定。
- Design mode 只增加 `data-node-id` 元数据和 editor context：控件事件默认被拦截，网络/计时器/导航等副作用进入安全策略；不得用静态卡片、标题摘要或与 Runtime 无关的占位图替代注册组件。
- 组件注册表增加 `designPolicy` 能力（交互、异步、副作用、是否允许编辑态渲染）；声明不安全的组件必须使用明确的受控 adapter，并在 UI 显示诊断。
- Preview mode 保持真实交互；表单值是 Preview 实例状态，不回写页面结构。

### R2. 候选模型拖拽与嵌套投放

- 采用 candidate model：拖动开始时从 Registry 创建默认节点，或从当前 Model 移动节点生成临时 draft；拖动过程只更新 draft target，不修改持久化 Model 和 history。
- Palette 与 Canvas 均把 candidate model 交给 `RuntimeSurface` 渲染，因此半透明拖拽预览继承真实组件、父级 slot、栅格/Flex 布局、响应式宽度和默认子节点。
- 以实际 Runtime DOM 注册 `DropTargetDescriptor`（node id、slot、可接受类型、边界矩形、兄弟顺序）；由 `DropTargetResolver` 选择最深合法目标并绘制 before/after/inside 投放指示器。
- 拖拽结束时只提交一个 `insert`/`move` Model Operation；取消、越界、非法 slot 或运行时错误都丢弃 candidate，不产生 ghost 节点、selection 或 history。
- 移动节点采用 pointer sensor/低层 drag adapter（优先 Pragmatic Drag and Drop），禁止 SortableJS 直接重排业务 DOM；所有列表和嵌套目标使用 controlled state。
- 支持键盘拖拽等价操作、自动滚屏、触控指针、拖拽距离阈值、sticky nested target 和无障碍 drop announcement。

### R3. 编辑覆盖层与交互质量

- Selection、hover、drop indicator、resize handle、context toolbar 使用独立 overlay layer，通过 Runtime DOM 的 `getBoundingClientRect()` 定位；不改变组件布局、背景或 dark-mode canvas 样式。
- 选择、复制、删除、跨层移动、嵌套、Resize、多选、Undo/Redo 均产生可序列化 Model Operation；拖拽过程中不得让 Canvas/Preview 读到与 candidate 不一致的 Model。
- Canvas 提供 DOM → Model 的稳定索引，节点重渲染、响应式切换和滚动后 overlay 自动重新测量；不依赖 `closest` 猜测父列表或 DOM index。
- 所有注册组件必须通过“设计态 vs 运行态”视觉回归样例；不符合安全策略的组件只能以明确的 adapter 呈现，不允许静默降级。

### R4. 事件流程模型与运行时

- 在 `LowCodePageModel` 增加可选 `flows`；定义版本化、JSON-only `ConfigFormFlow`、节点/边、trigger、errorPolicy 和 concurrency policy。
- 首版节点：`trigger`（`page.mount`、`form.submit`、`field.change`）、`condition`、`reaction`、`action`、`success`、`failure`、`end`；图必须是 DAG，边必须声明 `next`/`true`/`false`/`error` 语义。
- `condition` 复用现有 reaction condition AST，`reaction` 复用现有 effects；`action` 只保存注册表 key、输入 schema 和输出 mapping，禁止函数、源码、任意 URL 脚本和 `eval`。
- 语义核心采用 deterministic Flow Interpreter：core 先把 IR 编译成纯数据 Execution Plan，再由 runtime 负责事件队列、`AbortController`、timeout、错误和并发（默认 latest，可选 queue/ignore）。
- XState v5 降级为可选 actor/invoke adapter，不作为持久化协议或 Source/Config 真源；没有 XState 的 core 测试也必须能验证执行轨迹。
- Flow 运行状态、action 输出和 Preview 表单值属于 transient runtime；只有白名单 reaction/output mapping 可以更新 Preview 状态，不能直接改 Config Model。

### R5. 三种投影、导出与国际化

- Config 只读弹窗从 Model revision 生成稳定 JSON/Tree 和 `defineFields()` + `defineFlow()` TypeScript；不允许从 Source 反解析回 Model。
- Source 只读弹窗生成完全不依赖配置化表单 DSL 的真实 Vue/TypeScript 工程，流程逻辑展开为事件入口、条件、reaction、Abort/timeout、registry action 调用和错误分支，并包含完整 `package.json` 文件树。
- Preview、Config、Source 在生成期间捕获 revision 快照；revision 变化时重算或提示 stale，旧异步任务不得覆盖新结果。
- 流程节点、拖拽诊断、按钮和空状态接入已有 `@moluoxixi/i18n-tool`；本任务不新增翻译服务，不读取用户 API key。

## 验收标准

- [ ] AC1：同一 `RuntimeSurface` 在 Design Canvas、candidate drag preview 和 Preview 中渲染相同注册组件；给定相同 Model + viewport，组件树、slot、props 和布局结果一致，差异仅为 editor overlay/交互拦截。
- [ ] AC2：Palette 物料拖入三层以上嵌套容器时，半透明 candidate 会随最深合法 slot 和 before/after 位置实时移动；drop 后最终渲染与 candidate 完全一致，取消不改变 Model。
- [ ] AC3：任意拖拽过程都不会让 Sortable/DOM 先改业务顺序；Model revision 只在 drop/键盘提交时递增一次，Undo/Redo 可还原整个操作。
- [ ] AC4：选中框、投放线、Resize 和 toolbar 在滚动、响应式切换、dark mode、390px 移动端下可读且不改变 Canvas 内容区背景；所有 overlay 有可访问名称和键盘路径。
- [ ] AC5：Model 层拒绝未知组件/节点、重复 id、非法 slot/边、环、未知 action、非 JSON payload 和不安全 designPolicy；失败不产生半次提交。
- [ ] AC6：`page.mount`、`form.submit`、`field.change` 示例在 deterministic interpreter 中可运行；异步 action 支持 latest/queue/ignore、abort、timeout、failure；新 revision 会取消并隔离旧 run。
- [ ] AC7：reaction 节点与 core reaction evaluator 结果一致，Preview 中可观察 values、props、states、validate 投影；XState adapter 可替换而不改变 Execution Plan。
- [ ] AC8：Config/Source 只读导出来自同一 revision；Config 含 `defineFields`/`defineFlow`，Source 是独立真实工程，均可复制、下载并通过 type-check/build。
- [ ] AC9：完整组件注册表、嵌套拖拽、RuntimeSurface、Flow runtime、导出和 i18n 通过单元、集成、浏览器和视觉回归测试；1440px/900px/390px 与 Light/Dark 无重叠或横向溢出。

## 非目标与明确边界

- 不导入任意 Vue/TypeScript 项目，不允许任意 HTML DOM、自定义源码组件、用户函数或运行时 `eval` 进入 Model。
- 不做 BPMN 审批流、服务端长事务、定时/队列任务、跨页分布式流程、多人协作、权限审批或云端流程执行。
- 不把 Vue Flow JSON、XState machine、DOM index、selection、hover 或 Preview values 作为持久化真源。
- 不重做已完成的翻译服务、Monaco 基础能力和常规导出弹窗；只扩展它们消费新的 Model 投影。

## 待确认决策

- 是否批准这次重构：将 `RuntimeSurface + candidate model + overlay` 作为画布核心，并把事件引擎改成“deterministic Flow Interpreter 为语义核心、XState 仅作可替换 adapter”，首版只交付上述受控节点和拖拽能力？这是生产可控性最高的方案；若坚持直接把 XState 或 Vue Flow 状态当业务模型，三种投影的一致性、版本迁移和可测试性都会变差。
