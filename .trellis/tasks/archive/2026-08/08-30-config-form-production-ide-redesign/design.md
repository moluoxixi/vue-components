# ConfigForm 生产级 Low-Code IDE 技术设计

## 1. 设计原则

1. Config Model 是唯一业务真源，所有界面都是它的投影。
2. 真实组件树负责视觉，editor overlay 负责编辑反馈，两者不混排。
3. Workbench 负责产品工作流；Designer 负责页面编辑；Runtime/Headless 保持纯净，不接收 Pages、Export、Flow UI 或 IDE theme 状态。
4. Registry 是组件能力的唯一声明，不能在 Canvas、Inspector 和 Generator 各写一套 switch。
5. UI state 与 runtime state 可以独立存在，但不得伪装成 Config Model。
6. 每个异步投影绑定 revision，迟到结果不能写回新状态。

## 2. 总体架构

```text
┌──────────────────────────── Workbench Host ────────────────────────────┐
│                                                                       │
│  WorkspaceRepository ──> WorkspaceSession ──> Application/Model       │
│                               │                    │                  │
│                               │ apply(Operation)   │ snapshot(rev)    │
│                               ▼                    ▼                  │
│                         Operation History    ProjectionCoordinator     │
│                               │             /       |       \         │
│                               ▼            /        |        \        │
│                        Design Surface  Preview   Config     Source      │
│                                            │        │          │       │
│                                            │        │    SourceProject │
│                                            │        │      Generator   │
└────────────────────────────────────────────│────────│──────────│───────┘
                                             └────────┴──────────┘
                                                      │
                                               Component Registry
                                                      │
                                      ┌───────────────┼───────────────┐
                                      ▼               ▼               ▼
                                   Runtime         Inspector        Source
                                   binding          schema          adapter
```

依赖方向保持单向：

```text
ConfigForm core/headless
       ↑
ConfigForm runtime
       ↑
ConfigForm designer + adapter registries
       ↑
private workbench product + generator
```

Workbench 不得向 Runtime 注入 IDE 组件；Runtime 只公开可选的 design metadata/editor bridge。

## 3. 模块边界

### 3.1 保持纯净的公共包

| 模块 | 继续负责 | 禁止负责 |
| --- | --- | --- |
| `core` | reaction、Flow IR/analyze/interpreter、JSON-safe contracts | Vue Flow、弹窗、IDE 状态 |
| `headless` | `defineFields`、field/form runtime | Designer selection、drag、Export |
| `runtime` | ConfigFormRenderer、RuntimeSurface、组件运行时与 responsive | Pages、Inspector、History、IDE theme |
| `designer` | LowCode model/operation、Registry、受控 Design Surface、overlay/drag | Application repository、独立站点 topbar、Source/Config/Flow dialog |
| adapter designer packages | 统一 registration、setter、runtime/source adapter | Workbench 状态 |

现有 `ConfigFormDesigner` 作为兼容 facade 保留，但只组合新受控 surface 与可选 standalone history。Workbench 不再使用 facade 的 Preview、Import/Export 或内部响应式产品布局。

### 3.2 Workbench 内部模块

```text
src/
  app/
    WorkbenchApp.vue
    WorkbenchShell.vue
    WorkbenchTopbar.vue
  session/
    workspace-session.ts
    workspace-history.ts
    projection-coordinator.ts
  studio/
    DesignWorkspace.vue
    StudioLeftPanel.vue
    ComponentsPanel.vue
    LayersPanel.vue
    PagesPanel.vue
    InspectorPanel.vue
    PreviewDrawer.vue
  features/
    pages/PageManagerDialog.vue
    flow/FlowDialog.vue
    export/ExportDialog.vue
  export/
    config/
    source/
  project/
    application*.ts
    repository*.ts
  locale/
  styles/
```

`App.vue` 只负责装配 host services，不再包含 feature 模板或业务算法。样式按 shell/studio/dialog/runtime-boundary 拆分，禁止恢复单个千行全局文件。

## 4. 数据模型与 Session

### 4.1 持久化模型

继续使用现有：

```ts
interface WorkspaceApplication {
  id: string
  name: string
  homePageId: string
  pages: WorkspacePage[]
  manifest: WorkspaceProjectManifest
  revision: number
  // existing metadata
}

interface WorkspacePage {
  id: string
  name: string
  route: string
  model: LowCodePageModel
}
```

UI 重构不升级 Application schema。新的 source metadata 属于代码 Registry，不写入用户 Model。

### 4.2 WorkspaceSession

```ts
interface WorkspaceSnapshot {
  application: Readonly<WorkspaceApplication>
  applicationRevision: number
  modelRevision: number
  currentPageId: string
}

interface WorkspaceSession {
  snapshot: ComputedRef<WorkspaceSnapshot>
  selection: ShallowRef<StudioSelection>
  dirty: ComputedRef<boolean>
  dispatch(transaction: WorkspaceTransaction): OperationResult
  undo(): OperationResult
  redo(): OperationResult
  save(): Promise<CommitResult>
}
```

WorkspaceSession 是 Workbench 唯一写入口。Design、Inspector、Layers、Pages 和 Flow 只 dispatch transaction，不直接替换 application/model ref。

### 4.3 Operation 与 History

在现有 Model Operation 上增加应用级 envelope：

```ts
type WorkspaceOperation =
  | { type: 'page.model'; pageId: string; operation: ModelOperation }
  | { type: 'page.add' | 'page.remove' | 'page.move' | 'page.rename' | 'page.route' | 'page.home'; ... }

interface WorkspaceTransaction {
  id: string
  label: string
  operations: WorkspaceOperation[]
  mergeKey?: string
}
```

- 单次拖放、批量删除、多选 Resize 和 Inspector 连续输入都生成 transaction。
- Inspector typing 按 `mergeKey` 在短窗口内合并，blur/Enter 后封口。
- Flow node drag 只在 drag stop 产生 position operation。
- History entry 保存 operation + inverse operation；不长期保存每个完整 application clone。
- selection、hover、panel、pointer、zoom 不进入 history。
- 每个成功 transaction 递增 `modelRevision`；Save 成功更新 repository `applicationRevision`。

迁移期可以使用现有 snapshot history 作为内部实现，但新 public contract 与测试必须以 transaction 行为为准；替换为 inverse history 后 UI 无感。

## 5. Registry 设计

### 5.1 Registration

```ts
interface LowCodeComponentRegistration {
  component: string
  displayName: LocaleToken
  category: LocaleToken
  icon: Component
  kind: 'component' | 'layout'
  props: readonly PropSchema[]
  events: readonly EventSchema[]
  bindings: readonly BindingSchema[]
  slots: readonly SlotSchema[]
  defaults: NodeDefaults
  layout: LayoutCapability
  designPolicy: DesignPolicy
  runtime: RuntimeBinding
  source: SourceComponentAdapter
}
```

`sourceComponent: string` 被完整 `SourceComponentAdapter` 替代：

```ts
interface SourceComponentAdapter {
  dependencies: Record<string, string>
  imports: readonly SourceImport[]
  emit(node: LowCodeNode, context: SourceEmitContext): SourceTemplateNode
  emitRuntimeHelpers?: (context: SourceEmitContext) => SourceFile[]
}
```

Source adapter 是受信任的仓库代码，不进入 Model。它负责目标组件 tag、v-model contract、props/events、slots、layout wrapper 和必要 helper；Generator 负责 import 去重、文件组织和打印。

### 5.2 Bootstrap validation

Registry 创建时验证：

- component id 唯一；
- defaults 能通过 props/schema；
- layout 的 slots/children rules 可满足 default node；
- runtime binding 和 source adapter 均存在；
- source dependency 版本合法且不能是 `workspace:` / `catalog:`；
- event/binding 引用的 prop/trigger 存在；
- locale token 在 en/zh catalog 都有 fallback。

任何失败都阻止对应 adapter 进入编辑器，并显示集中诊断；禁止拖入后才发现不能导出。

## 6. Design Surface

### 6.1 受控输入输出

```ts
interface DesignSurfaceProps {
  model: LowCodePageModel
  registry: LowCodeComponentRegistry
  selection: StudioSelection
  viewport: RuntimeViewport
  readonly?: boolean
}

interface DesignSurfaceEmits {
  operation: [WorkspaceTransaction]
  selectionChange: [StudioSelection]
  diagnostics: [DesignerDiagnostic[]]
}
```

Workbench 直接把 Config Model 传给 Design Surface。`ConfigModel -> DesignerDocument` 不再处于 live edit 主路径；旧 facade 和 Config codec 可继续使用转换器。

### 6.2 Runtime 与 editor layer

DOM 分层：

```text
DesignViewport (runtime theme, stable background)
  RuntimeSurface(mode=design, projectedModel)
  EditorOverlay(pointer-events controlled)
    selection bounds
    node toolbar / drag handle
    resize handles
    drop line / empty-slot outline
  DragOverlay(position=fixed, outside scroll container)
```

- RuntimeSurface 注册每个真实节点 DOM 的 id/path/slot/kind/rect。
- Overlay 用 DOM registration + ResizeObserver 定位，不改变 Runtime DOM layout。
- Design mode 截断组件业务 click/navigation/submit；选择和拖动由 overlay handle 完成。
- 若组件包含 Teleport、全局副作用或必需 Provider，registration 的 `designPolicy` 明确声明 safe/guarded/sandbox，不能静默替换成假节点。

### 6.3 Candidate 与 Drag Overlay

```text
pointer/keyboard session
  -> resolve deepest legal target
  -> create candidate operation
  -> apply to projected model (not history)
  -> RuntimeSurface renders actual candidate
  -> measure candidate DOM
  -> clone sanitized visual into fixed DragOverlay
drop
  -> dispatch the same candidate operation once
cancel
  -> discard projected model + overlay
```

- Canvas candidate 是真实运行时组件，仅加 `opacity`/editor marker。
- 鼠标虚影是候选真实 DOM clone，使用实测宽高；clone 去除 id/name/tabindex/value side effects、表单提交、媒体播放和 pointer events。
- DragOverlay 持续挂载，只替换内容；cancel/drop/unmount/page switch/readonly 进入同一 cleanup。
- 目标 indicator 使用 overlay line/outline；最后位置由容器 rect + last child rect 计算，无持久 blank cell。
- 自动滚动只改变 scroll container；每帧最多一次 geometry read 和一次 overlay write，避免 layout thrashing。

### 6.4 Components specimen

Components panel 为每个物料创建单节点 ephemeral model，并用 RuntimeSurface 的 `specimen` policy 渲染真实组件。specimen：

- 使用 Registry defaults 与必要 Provider；
- 禁止 focus、input、network、timer 和 navigation；
- 由 item overlay 捕获 click/drag；
- 通过 IntersectionObserver 只挂载可见分组；
- 不参与应用 Preview state，也不生成 history。

## 7. IDE 布局与交互

### 7.1 宽屏 `>=1280px`

```text
┌──────────────────────────── Topbar 44px ──────────────────────────────┐
├──────── 272px ────────┬──────── Design min 640px ───────┬── 320px ──┤
│ Components/Layers/    │ Canvas toolbar + Runtime Viewport│ Inspector │
│ Pages                 │                                   │           │
└───────────────────────┴───────────────────────────────────┴───────────┘
                                              ┌────────────────────────┐
                                              │ Preview Drawer 480px   │ overlay
                                              └────────────────────────┘
```

- 左/右 panel 可折叠为 40px icon rail，手工状态不会因 Preview 自动变化。
- Preview drawer 默认 480px、可 resize，最大 70vw；expanded 覆盖 topbar 以下工作区。
- Preview 使用 overlay + backdrop/edge shadow，不重算三栏 grid。
- Canvas toolbar 使用图标按钮、tooltip 和稳定尺寸；Undo/Redo、Copy/Delete、viewport/zoom 不因禁用状态改变布局。

### 7.2 紧凑桌面 `768-1279px`

- Canvas 保持全宽中心。
- 左/右 panel 由 toolbar icon 打开 overlay drawer，一次最多一个；不是 Palette/Canvas/Properties 三个互斥页面。
- Preview 是独立右侧 drawer；打开时自动关闭 panel drawer，但不改变 Canvas breakpoint。
- Page Manager、Flow、Export 为接近全屏的 dialog workspace。

### 7.3 移动端 `<768px`

- 顶栏保留 page context 与 overflow menu。
- 底部导航提供 Components、Layers、Canvas、Inspector、Pages；Canvas 是默认项。
- panel 作为全屏 sheet，返回后保持 selection 和 scroll。
- Preview、Flow、Page Manager、Export 使用全屏 view；Source file tree/code 使用二段式 tabs。
- 触摸 drag 使用 Pointer Events + long-press activation；同时保留“点击物料添加到当前选择/根节点”的确定性路径。

### 7.4 Inspector 排版

普通 property row：

```css
grid-template-columns: minmax(0, 1fr);
```

- label 占第一行，单行截断并提供 title/tooltip 与完整可访问名称。
- control 占下一行并使用 `min-width:0; width:100%`；不得在 304px 右栏压缩成残缺控件。
- complex setter 延续同一全宽纵向布局，内部数组/对象编辑器自行管理其子行。
- section 是无装饰分组，不嵌套 card；折叠只改变 UI state。

## 8. Preview 投影

`ProjectionCoordinator` 监听 WorkspaceSession revision：

```text
snapshot(revision)
  -> validate Registry + Model
  -> compile Runtime document
  -> publish PreviewProjection(revision)
  -> PreviewRuntime owns values/flow runs for revision
```

- 同 revision 的 Preview/Config/Source 使用 immutable snapshot。
- 新 revision 先 abort 旧 Preview flow，再发布新 projection。
- Preview runtime values 与 Design defaults 分离；Model 变化时按 stable field key 保留兼容值，删除不存在字段并初始化新增字段。
- compile failure 保留 `lastValid`，但 UI 显示 `Stale at rN / current rM` 和诊断，不显示 Live。
- Preview drawer mount 后才加载运行态；关闭后释放 flow runs 和 observer。

## 9. Flow 设计

保留：

```text
ConfigFormFlow JSON IR
  -> analyze/compile (Core)
  -> deterministic interpreter (Core)
  -> ActionRegistry / Preview coordinator
```

FlowDialog 使用 lazy-loaded controlled Vue Flow：

- Vue Flow state 只保存临时 selection/viewport/drag position；
- nodes/edges 始终从 page model flows 计算；
- connect/delete/configure 先 validate，再 dispatch flow operation；
- node move 只在 `onNodeDragStop` 提交；
- inspector 使用 schema setter，不要求用户直接编辑 JSON；高级只读 JSON 用于诊断；
- 保存前做 reachable node、branch、action ref、field ref 和 cycle validation。

不引入 XState。若未来需要长生命周期 actor，只允许作为 interpreter 内部 adapter，不能成为持久化真源。

## 10. Config 与 Source 导出

### 10.1 Snapshot service

```ts
interface ProjectionSnapshot<T> {
  applicationId: string
  pageId: string
  revisionKey: string
  modelRevision: number
  value: Readonly<T>
}
```

打开弹窗时捕获 snapshot。用户继续编辑后，弹窗显示 stale banner；Refresh 显式生成新 snapshot。Copy/Download 永远来自当前弹窗 snapshot。

### 10.2 Config

- 默认 `form.config.ts`，由现有 formatter 加固生成 `defineFields/defineField/defineFlow`。
- JSON/Tree 从同一 snapshot 计算。
- Tree View 使用可复用 ARIA tree，而不是 App 内手写扁平数组。
- Config formatter 可使用 Babel AST 打印 TypeScript，但 Babel AST 只是输出实现，不是 Config Model。

### 10.3 Source

生成过程：

```text
Application snapshot + Registry
  -> SourceProject IR (files/imports/template AST/dependencies)
  -> adapter source emitters
  -> deterministic printers
  -> validate paths/dependencies/no ConfigForm imports
  -> immutable ExportSnapshot
```

- Script/TypeScript 部分使用结构化 AST/printer，避免手工拼接标识符和字符串。
- Vue template 使用受控 `SourceTemplateNode` printer，只允许 element/component/slot/directive/text/interpolation 节点，统一 escape。
- 每个 adapter registration 输出真实组件 tag 与 import，例如 Element Plus/Ant Design Vue，而不是通用 native input。
- Layout registration 输出与 Runtime 相同的 grid/flex/slot 语义。
- 纯 flow helper 由 validated execution plan 生成，不导入 ConfigForm。
- Source Project 不生成 `page.model.json`、`form.config.ts` 或 Designer artifact。
- Integration test 把生成文件写入临时目录，执行 install-free typecheck/build（使用 workspace fixture dependency resolution）并挂载关键页面比较 DOM contract。

### 10.4 Source 文件树

继续使用现有 `ProjectFileTree` 思路并抽成通用 Tree model：

- directory/file 节点分层；
- roving tabindex；
- focus 与 selected file 分离；
- ArrowRight/Left/Up/Down、Home/End、Enter、type-ahead；
- snapshot 更新时保留仍存在的 path，否则回退 entry/首个 text file；
- 目录节点不打开 Monaco model。

## 11. 主题与国际化边界

### 11.1 Theme scopes

```text
.workbench[data-ide-theme]  -> chrome tokens
.runtime-viewport           -> runtime tokens, unchanged by IDE theme
.editor-overlay             -> editor overlay tokens
.preview-runtime            -> runtime theme selected by page/preview
```

- IDE dark 不修改 `.runtime-viewport` 的 background/color/component library vars。
- Workbench 不给 `html/body` 添加会被 UI adapter 全局继承的 dark class。
- Inspector 的 Element/Ant setters 只在 `.inspector-scope` 注入 dark tokens。
- Overlay 在 light runtime 上仍使用足够对比度的 selection/drop colors。

### 11.2 Locale

- 单一 `WorkbenchLocale` 组合 Workbench catalog、adapter material catalog 和 caller override。
- `en-US` 与 `zh-CN` key parity 由类型测试保证。
- locale 同时提供给 Designer、Inspector、Pages、Flow、Preview、Export、Monaco wrapper。
- 语言偏好使用 namespaced storage，失败不阻断应用；同步 `document.documentElement.lang`。
- 翻译 API key 不进入仓库、localStorage、bundle 或网络日志。

## 12. Loading 与性能

按需边界：

- active adapter：根据 application manifest 动态 import；非当前 Element/Ant adapter 不加载；
- `FlowDialog` + Vue Flow：打开 Flow 时加载；
- `ExportDialog` + Monaco：打开 Export 时加载；
- Source Generator/printers/zip：选择 Source 或下载时加载；
- Components specimen：按可见分组 lazy mount。

拖拽热路径：

- pointermove 合并到一个 `requestAnimationFrame`；
- geometry 读和 overlay 写分批；
- Registry/model computed 使用稳定 identity；
- Preview projection 不在 pointermove 期间执行，只有 candidate RuntimeSurface 更新；
- 性能 fixture 记录 Model op、frame 与 Preview publish 指标。

## 13. 可访问性

- Components item 是 button/drag source，Space 开始键盘 drag，方向键切 target，Space drop，Escape cancel；Enter 执行确定性 add。
- Canvas node selection、toolbar、resize 都可聚焦；多选支持 Shift/Ctrl/Meta。
- Layers、Pages、Source 使用 APG tree/listbox/table 的正确键盘模型。
- Menu/Dialog/Tab 不手写散落 focus logic；统一使用 repository 已验证的 focus utilities，补齐 nested dialog 测试。
- DragOverlay `aria-hidden`；状态变化通过单一 polite live region announcement。
- 触摸 target 至少 44px；桌面 icon button 固定 28-32px 并有 tooltip。

## 14. 兼容、迁移与回滚

### 14.1 兼容

- Application v2 与 LowCodePageModel 数据不变，旧项目无需迁移。
- 旧 Project->Application migration 和 repository key 保持。
- `ConfigFormDesigner` facade 保留旧 props/emits；Workbench 切到新受控 surface。
- Config formatter 保留现有 defineField 语法。

### 14.2 切换策略

- 新 Workbench shell 在独立入口组件中完成，旧 `App.vue` 只作为装配 facade，避免同时维护两套根状态。
- 每个内部切片先建立 contract test，再替换调用方；不能用长期 feature flag 保留两套 source of truth。
- 最终切换前，旧 UI 不再新增功能。

### 14.3 回滚点

- Session/operation：可回退到现有 snapshot history，不改持久化数据。
- UI shell：新 shell 失败时可恢复旧 host，repository/model 不变。
- Source generator：保留旧 generator 仅用于回归对照，不作为 UI fallback；新 generator 未通过全部 adapter build 时不得发布。
- Registry source adapter：纯代码 metadata，可单独回滚，不写入项目。

## 15. 主要风险与控制

| 风险 | 控制 |
| --- | --- |
| 真实 Components specimen 带来副作用/性能 | designPolicy、事件拦截、可见项 lazy mount、全物料副作用测试 |
| Design 与 Runtime props 再次漂移 | 单一 registration + 同 renderer + exhaustive registry contract |
| Source adapter 复杂度膨胀 | typed Source IR、adapter-specific emitter、独立 build fixture，不在 core 写组件 switch |
| Operation history 迁移影响 Undo | facade contract、transaction/inverse property tests、旧 snapshot history 临时兼容 |
| Preview async 写回旧状态 | revision key + AbortController + coordinator tests |
| 暗色污染 UI library | theme scope computed-style browser tests，不修改 html dark class |
| 一次重构面太大 | 同一任务内可回滚切片，跨切片 contract gate；全部 AC 完成才交付 |
