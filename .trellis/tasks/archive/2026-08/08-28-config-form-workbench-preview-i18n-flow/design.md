# 生产级 RuntimeSurface 与事件流程技术设计

## 设计原则

1. **一棵真实组件树**：Design Canvas、drag candidate 和 Preview 使用同一个 runtime renderer；编辑器工具栏、选区和投放提示全部在树外。
2. **候选状态优先**：drag 只产生 ephemeral candidate model；drop 才通过 Model Operation 提交，取消不留下任何 DOM 或 history 痕迹。
3. **受控状态**：画布库和拖拽库不能直接写业务数组；所有变化先经过 registry/target/model 校验，再提交 revision。
4. **安全副作用**：设计态和预览态共用渲染代码，但通过 `RenderContext.mode`、registry `designPolicy` 和 runtime action registry 控制事件、网络、计时器与导航。
5. **协议与引擎解耦**：Flow IR 是持久化协议，Execution Plan 是纯语义中间层，XState 只是可替换执行 adapter。

## 总体结构

```text
Component Registry + Flow Action Registry
                    ↓
             Config Model Store
          ↙          ↓           ↘
  RuntimeSurface   Flow Plan      Export Snapshot
 (design/preview)    ↓           (Config / Source)
      ↓       Flow Interpreter
 Editor Overlay      ↓
 (selection/drop)  Preview runtime
```

### 包职责

- `@moluoxixi/config-form-core`：JSON-safe Flow IR、schema、graph analysis、operation validation、semantic hash、reaction reuse、deterministic execution plan 类型。
- `@moluoxixi/config-form` runtime：共享 `RuntimeSurface` 原语和 node metadata hook，负责真实组件递归渲染、响应式布局、字段绑定和 render context。
- `@moluoxixi/config-form-designer`：Model command、drag adapter、DropTargetResolver、EditorOverlay、RuntimeSurface design mode；不再在 `DesignerNodePreview` 中复制 Runtime 渲染逻辑。
- `@config-form/workbench`：三栏 shell、Flow workspace、Flow Action Registry 注入、Preview coordinator、Config/Source 导出和 i18n wiring。

## RuntimeSurface 设计

### 共享渲染入口

抽取 runtime 的递归 `renderNode/renderLayout/createNodeSlots` 为可复用 `RuntimeSurface`（或内部 renderer composable）。它接收：

```ts
interface RuntimeSurfaceProps<TValues> {
  model: LowCodePageModel
  registry: LowCodeComponentRegistry
  values: TValues
  mode: 'design' | 'preview'
  editor?: RuntimeEditorBridge
}
```

`RuntimeSurface` 将每个 Model node 映射到真实 component，并在最外层 node cell 写入 `data-config-node-id`、`data-config-slot`、`data-config-path`。`RuntimeEditorBridge` 只提供 metadata registration、event interception 和 state read，不改变组件 props 语义。

### Design mode 安全策略

- 默认保留真实组件、真实 CSS、默认 props、slot 和 responsive layout；控件事件转为 no-op 或交给 editor selection，避免修改 Preview values。
- 对网络、导航、定时器、随机数、动画等副作用，通过 registry `designPolicy` 注入 deterministic adapter/context；组件若无法安全渲染必须声明原因并显示诊断。
- `pointer-events` 只在 runtime content 层关闭，overlay 负责选择/拖拽；不会给组件增加灰色背景、静态占位或改变 canvas 根背景。
- Preview 使用同一 renderer 但 `mode='preview'`，允许表单交互和 Flow runtime；values 仍然是独立实例状态。

### Overlay

`EditorOverlay` 使用 `ResizeObserver`、scroll/viewport observer 和 `data-config-node-id` 索引定位：

- selection bounds：围绕真实 node cell，支持多选、toolbar、Resize handle；
- drop indicator：before/after/inside 三种几何形态，颜色来自语义 token；
- diagnostic spot：显示组件不安全、slot 不接受、Flow 错误等，不修改 Runtime DOM；
- overlay 更新使用 `requestAnimationFrame` 合并测量，避免拖动时布局抖动。

## Drag Candidate 架构

### 生命周期

```text
pointerDown(source)
  → createDragSession(source, snapshot)
  → pointerMove
      → resolveDeepestDropTarget(pointer, descriptors)
      → buildCandidateModel(snapshot, source, target)
      → RuntimeSurface(candidate, mode=design, opacity=.62)
  → pointerUp
      → validate(candidate)
      → commit one insert/move operation
      → clear session + overlay
```

- Source 可以是 Palette material 或已有 node；candidate 的临时 id 以 session id 命名，不进入持久化模型。
- `DropTargetDescriptor` 由 RuntimeSurface 在真实 DOM 上注册：`nodeId`、`slot`、`accepts`、`rect`、`siblings`、`depth`、`disabledReason`。
- `DropTargetResolver` 从最深层开始 hit-test，按 slot accepts、pointer orientation 和 sibling midpoint 选择唯一 target；无合法目标时显示不可投放状态。
- candidate model 是 `applyModelOperation(snapshot, operation, {draft:true})` 的结果，使用同一 registry defaults 和 parent layout；因此拖动预览与 drop 后渲染天然一致。
- 拖动现有 node 时，candidate 同时移除源位置并插入目标位置，避免画布出现重复节点；跨容器/多级嵌套不依赖 DOM index。

### Drag adapter

优先采用 Pragmatic Drag and Drop element adapter 的低层 lifecycle（`onGenerateDragPreview`、`onDrag`、`onDropTargetChange`、`onDrop`）；Vue 组件只维护 drag session。若依赖体积或 SSR 约束不接受，则实现等价 pointer sensor，但保留相同的 session/target 接口。禁止 SortableJS 自动重排业务 DOM。

## Flow IR 与执行

### IR

```ts
interface ConfigFormFlow {
  version: 1
  id: string
  name: string
  trigger: { kind: 'page.mount' | 'form.submit' | 'field.change'; field?: string }
  concurrency?: 'latest' | 'queue' | 'ignore'
  errorPolicy?: { onError: 'failure' | 'end'; timeoutMs?: number }
  nodes: Array<{
    id: string
    type: 'trigger' | 'condition' | 'reaction' | 'action' | 'success' | 'failure' | 'end'
    ref?: string
    config?: DesignerJsonObject
    position?: { x: number; y: number }
  }>
  edges: Array<{
    id: string
    source: string
    target: string
    condition?: 'next' | 'true' | 'false' | 'error'
  }>
}
```

### Execution Plan 与 Interpreter

- Core 图分析确认唯一 trigger、可达终点、DAG、分支完备性和 action/ref；输出稳定的 `FlowExecutionPlan`（按拓扑序排列，排除 position）。
- Interpreter 使用事件队列和显式 `RunContext` 执行 plan；每个 run 都有 `revision`、`runId`、`AbortSignal`、输入 snapshot 和 output map。
- reaction 节点调用现有 evaluator；condition 节点只接受 reaction condition AST；action 节点从宿主 registry 取得 executor 并验证 schema。
- 同一 flow 默认 `latest`，新触发取消旧 run；`queue` 和 `ignore` 只控制 run 调度，不能绕过字段写入冲突检查。
- XState adapter 可以把一个 run/async action 包装为 actor/invoke，向 Interpreter 报告 done/error/abort；替换 adapter 不改变 IR 和 plan。

## Flow Designer

- 使用 Vue Flow 作为纯画布投影，并设置 controlled mode（不让库自动应用 nodes/edges changes）。
- 节点面板、custom node、Handle 和 edge label 从 Flow Registry 派生；`isValidConnection` 只做即时提示，最终仍由 Model reducer 再校验。
- 节点拖动结束提交 `updateFlowNode(position)`；连线提交 `connectFlow`；删除/复制/批量操作统一走 history。
- Flow workspace 复用现有三栏 shell 和 Export Preview；Flow view 是辅助视图，不改变 Design Canvas 默认入口。

## Config / Source 生成

- Config codec 从同一个 Model snapshot 生成 `defineFields()` + `defineFlow()` 受控 TypeScript、JSON 和 Tree；Flow position 作为可选 presentation 字段输出，但 semantic hash 忽略它。
- Source generator 生成真实 Vue/TypeScript 工程：页面 DOM、字段 state、触发器、条件、reaction、action registry 调用、Abort/timeout/concurrency 和错误分支全部显式呈现，不导入 ConfigForm DSL。
- 导出 snapshot 携带 `modelRevision`、`semanticHash` 和 registry dependency manifest；生成期间 revision 改变则标记 stale 并禁止下载旧结果。

## 测试与可观测性

- Unit：IR schema/graph analysis、candidate insert/move、DropTargetResolver、semantic hash、interpreter event trace、abort/timeout/concurrency、reaction equivalence。
- Component：RuntimeSurface 与 Preview DOM 快照一致；design overlay 不改变 computed layout；每个 material 的 designPolicy 行为可断言。
- Browser：三层嵌套 Palette→slot、同层 before/after、移动端触控、取消/越界、滚动自动跟随、dark mode、键盘拖拽；截图对比真实组件与 candidate。
- Integration：Config/Source export type-check/build，旧页面迁移，XState adapter 可替换，所有内置 registry action 缺失时有诊断。
- Runtime diagnostics 统一包含 `modelRevision`、`runId`、nodeId、actionRef 和可读 i18n key，便于定位 stale/异步问题。

## 迁移与回滚

- 第一阶段保留现有 Designer API，通过 compatibility adapter 将旧 `DesignerDocument` 转换到 RuntimeSurface 所需 Model；不继续维护双向 Source/Config draft。
- 新 RuntimeSurface 可先在 workbench behind feature flag 并行验证，视觉回归通过后替换 `DesignerNodePreview`；旧实现只保留迁移测试，不再增加功能。
- 若拖拽 adapter 或 XState adapter 出现问题，可独立回滚 adapter，不影响 Config Model、RuntimeSurface 和导出协议。
