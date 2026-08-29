# 配置化表单流程运行一致性

## 目标

修复流程在 Workbench Preview 与独立 Source 工程中的调度语义漂移，使每条 Flow 声明的 `latest`、`queue`、`ignore` 真正决定并发行为；页面或 Model revision 切换时，旧异步任务必须及时结束且不能污染新页面。流程编辑仍修改 `LowCodePageModel.flows`，Runtime 状态保持瞬态。

## 已确认事实

- 流程工作区已经是带焦点约束的模态弹窗，不再是主编辑模式（`packages/ConfigForm/workbench/src/App.vue:1440`）。
- Core 已提供 JSON-only Flow IR、DAG 分析、reaction/action 执行和按 Flow ID 的并发调度（`packages/ConfigForm/core/src/flow/interpreter.ts:11`）。
- Workbench Preview 又增加了全局 `previewFlowTriggerRevision`；任意后发事件都会让所有先发事件失效，覆盖每条 Flow 自己的并发策略（`packages/ConfigForm/workbench/src/App.vue:483`）。
- Preview revision 的外部 `AbortSignal` 和 action 子信号在正常完成后没有解除监听；不配合信号且无 timeout 的 action 会阻塞 run 与 queue（`packages/ConfigForm/core/src/flow/interpreter.ts:61`、`packages/ConfigForm/core/src/flow/interpreter.ts:194`）。
- 独立 Source 自带流程运行时，但其页面层同样使用全局 `triggerRevision`，`ignore` 还会用空投影替换之前的有效投影（`packages/ConfigForm/workbench/src/project/export/source.ts:394`、`packages/ConfigForm/workbench/src/project/export/source.ts:528`）。
- 现有测试覆盖 Core 基础路径、FlowWorkspace 受控编辑和导出字符串/构建，但没有执行 Workbench Preview 与生成 Source 的重叠触发行为。

## 需求

### R1. 每条 Flow 的并发策略是唯一调度语义

- Preview 不得再用全局“最后一次触发”覆盖 Flow 的 `concurrency`。
- `latest` 只取消同一 Flow 的旧 run；`queue` 按触发顺序依次执行并提交；`ignore` 保留正在执行的 run，并且被忽略的触发不得清空值或投影。
- 同一次 trigger 匹配多条 Flow 时继续按 Model 顺序传递本次结果；重叠 trigger 只提交实际执行成功的值差量和投影，不能用旧输入快照覆盖无关的新值。

### R2. revision、取消和资源生命周期

- Application、Page、Model revision 或组件生命周期变化必须取消旧 run，旧结果不得更新 Preview、消息或投影。
- 即使 action 忽略传入的 `AbortSignal`，解释器也必须让被取消的 run 及时结算为 `aborted`，不得永久占用 active/queue。
- 外部 signal、action signal、timeout 和队列监听必须在成功、失败、取消后清理；队列中的已取消任务不能等待无关 active run 后才释放调用方。

### R3. Preview 与独立 Source 行为一致

- 独立 Source 不导入任何 ConfigForm 包，但其调度、状态结果和投影保留规则必须与 Core/Preview 的公开语义一致。
- `latest`、`queue`、`ignore`、abort、timeout、普通失败和 `onError` 均需要可执行的契约测试，不能只断言生成文本包含某个关键字。
- Source 文件树、Monaco、单文件下载和 ZIP 仍消费同一个不可变 ExportSnapshot。

### R4. 保持既有产品与架构边界

- `LowCodePageModel` 仍是唯一持久化真源；run、queue、trace、values、outputs 和 projection 都是 Preview/导出工程的瞬态状态。
- FlowWorkspace 继续通过模态弹窗打开，Source/Config 继续只读查看与导出。
- 不把 Source、Config 或流程运行结果反向解析/写入 Config Model。

## 验收标准

- [x] AC1：同一 Flow 的两个重叠 `latest` 触发只提交后一个结果；前一个 action 即使不监听 signal，也会及时得到 `aborted`，active 状态不残留。
- [x] AC2：同一 Flow 的三个 `queue` 触发按顺序执行并各自提交；第二次触发不会让第一次结果因全局 revision 失效。
- [x] AC3：`ignore` 场景保留 active run 的最终值和投影，被忽略的触发不发布输入快照、空投影或错误消息。
- [x] AC4：切换页面、更新 Model revision 或卸载 Workbench 后，active 与 queued run 均结算且不能更新新 Preview；相关 abort listener 会解除。
- [x] AC5：同一 trigger 匹配多条 Flow 时按 Model 顺序传值；重叠 trigger 只合并 Flow 实际修改的字段，不覆盖用户或其他 Flow 后续更新的无关字段。
- [x] AC6：生成 Source 的可执行测试覆盖 AC1-AC5 对应语义，并继续通过独立 Vue 工程 type-check/build；工程不包含 ConfigForm 依赖。
- [x] AC7：Flow Core、Runtime、Designer、Workbench 的相关单测、类型检查、Lint 和生产构建通过；浏览器中 Preview 可观察 page.mount、form.submit、field.change 的真实更新且控制台无错误。
- [x] AC8：流程仍从工具栏弹窗打开，Config Model revision 只在编辑流程时变化，运行流程不会产生 Model Operation 或 history 项。

## 非目标

- 不新增 BPMN、审批、服务端任务、定时任务、跨页面分布式流程或任意源码执行。
- 不新增 Flow 节点类型、Action 产品能力或重做 Vue Flow 编辑器 UI。
- 不修改 Component Registry、拖拽画布、多页面持久化和导出文件树的既有协议。

## 风险与约束

- 不能通过再次增加全局序号来隐藏竞态；并发归属必须留在 Flow ID 边界。
- 生成 Source 不能直接复用 Core 运行时代码，因此需要以同一行为矩阵约束其自包含实现。
- 值提交采用本次 run 相对输入的差量；投影按 Flow ID 保存最后一次成功结果，`ignored`、`aborted`、`failure` 不覆盖旧成功投影。
