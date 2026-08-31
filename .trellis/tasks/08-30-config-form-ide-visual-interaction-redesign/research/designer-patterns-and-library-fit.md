# 成熟设计器模式与库适配调研

## 结论

本轮应借鉴成熟编辑器的交互模式，但不替换现有 Designer/Runtime 核心。当前实现已经具备真实 Runtime、Registry、Config Model、Operation、嵌套 drop、键盘拖拽和几何一致性测试；引入一个完整第三方页面编辑器会重新制造第二份组件模型，并破坏 Vue Runtime 与平台注册物料的边界。

## 候选方案

| 方案 | 当前版本 | 可借鉴点 | 不直接接入原因 |
| --- | --- | --- | --- |
| Craft.js | `@craftjs/core@0.2.12` | 把拖拽、节点状态、用户组件渲染和编辑器 UI 解耦；真实用户组件通过 connector 进入画布；状态可序列化 | React 专用；接入会与现有 Vue Registry、Config Model 和 Operation 重复 |
| GrapesJS | `grapesjs@0.23.6` | Blocks、Layer Manager、Style/Traits、Canvas 分区清晰；辅助管理器不与 Canvas 争夺主模式 | 自带 HTML/CSS Component Model 和 Storage；允许任意 DOM，与“只允许平台注册组件”冲突 |
| dnd-kit | `@dnd-kit/core@6.3.1` | DragOverlay、sensor、键盘和无障碍模式值得参考 | React 专用；现有拖拽控制器已经与 Model target、nested slot、candidate identity 深度整合 |
| Moveable | `moveable@0.53.0` / `vue3-moveable@0.28.0` | resize、group、snap 和 guideline 能力成熟 | 主要面向自由定位/transform；当前页面布局以 grid span 和容器 slot 为语义，直接接入会把语义 Resize 退化为像素变换 |
| Ali LowCode Designer | `@alilc/lowcode-designer@1.3.4` | 物料协议、Schema 驱动 Inspector、Designer shell 与 simulator 分层 | React 生态且拥有完整引擎模型；适合参考边界，不适合嵌入当前 Vue 架构 |
| Vue Flow | `@vue-flow/core@1.48.2`（仓库现有） | 节点/连线、pan/zoom、selection 适合流程图 | 只适用于 Flow workspace；不应拿流程图坐标模型替换页面的 Registry Runtime |

版本和描述通过 2026-08-30 的 npm registry 元数据核对。

## 官方资料

- Craft.js: https://craft.js.org/docs/overview/
- Craft.js nodes: https://craft.js.org/docs/concepts/nodes
- GrapesJS: https://grapesjs.com/docs/
- GrapesJS Blocks: https://grapesjs.com/docs/modules/Blocks
- GrapesJS Traits: https://grapesjs.com/docs/modules/Traits
- dnd-kit DragOverlay: https://docs.dndkit.com/api-documentation/draggable/drag-overlay
- Moveable: https://daybrush.com/moveable/
- Ali LowCode Engine: https://github.com/alibaba/lowcode-engine
- Vue Flow: https://vueflow.dev/

## 可直接采用的产品模式

### 1. Editor connector，而不是第二套组件

Craft.js 的核心启发不是 React API，而是 connector 思路：真实用户组件负责渲染，编辑器只附加选择、拖拽和操作能力。当前项目的 Runtime surface + editor overlay 已经符合这一方向，应继续强化，不应再创建 Designer 专用控件。

### 2. Canvas、Panel Manager、Inspector 分层

GrapesJS 把 Blocks、Layers、Traits 和 Canvas 分成明确管理器。对本项目的对应关系是：

- Components = Registry 物料发现
- Layers = Config Model 结构投影
- Inspector = Registry Schema setter
- Canvas = Runtime + editor overlay
- Pages / Flow / Export = 辅助 workspace

这支持重做 UI 组合，而不要求替换核心状态流。

### 3. DragOverlay 必须来自最终 Runtime 几何

dnd-kit 的 DragOverlay 强调视觉副本与可拖元素生命周期分离。本项目更严格：overlay 的尺寸必须来自画布中真实 candidate 的 bounding box，candidate 与 commit 还必须共享同一 Registry node identity。现有 E2E 已验证这一点，应保留实现，只调整透明度、边框和层级。

### 4. Resize 必须遵循页面布局语义

Moveable 的自由 resize 很成熟，但 ConfigForm 的 resize 代表 grid span，而非元素 `width/height`。本轮只优化 handle、反馈和键盘路径；若未来引入 Moveable，也只能作为 overlay 几何工具，不能让它直接写 DOM transform。

### 5. 辅助工作区保持 modal / overlay

现代设计器通常把代码、页面管理、流程等低频复杂能力放入独立 workspace。当前 Source/Config、Flow、Page Manager 的产品位置合理；本轮统一它们的 shell、文件树、标题栏和响应式即可。

## 本轮依赖决策建议

- 不新增完整页面编辑器依赖。
- 不替换现有 drag controller。
- 保留 Vue Flow 仅服务流程编排。
- 不引入 Moveable，除非实现阶段发现现有 selection/resize overlay 无法满足已确认的验收标准；若发生，应回到设计评审而不是直接添加依赖。

## 本轮事件编排对照与真实链路证据（2026-08-31）

本轮补充了 `component.event` 触发器。实现采用成熟编辑器中“运行时节点事件由编辑器桥接采集，配置面板只选择稳定目标”的边界：

- Craft.js 的 connector 模式启发了 Runtime 事件桥：Preview 只从真实 Vue 节点发出 `nodeId + event`，Design 模式由编辑器桥拦截，不监听 DOM 文本或临时索引。
- GrapesJS 的 Components/Layers/Traits 分层启发了 Flow Inspector：组件事件目标来自当前 PageGraph 与 Registry 的交集，Flow 图只负责节点和连线，不重新解释组件合同。
- Vue Flow 仅承担流程拓扑编辑；触发器的节点/事件选择放在 Inspector，避免把流程图坐标模型和页面组件结构混在一起。
- dnd-kit 的 DragOverlay 与事件目标无直接依赖，本轮没有引入新的拖拽副本或第二套事件状态。

本轮验收证据：FlowWorkspace 在没有目标时禁用 `component.event`；有目标时显示真实字段节点的注册事件，提交的 Model Operation 只包含 `{ kind, nodeId, event }`。Preview Coordinator 与 standalone Source 均按这两个稳定字段精确匹配，未增加 UI 层的临时回调分支。

- RuntimeSurface 挂载真实 Element Plus Vue 节点；组件事件由同一运行时节点带出稳定 `nodeId + event`，不复制控件或维护临时索引。
- Flow Inspector 只选择当前 PageGraph 与 Registry 交集中的事件目标；流程 action 仍通过 Flow Engine 执行，页面模型不保存回调函数。
- Design 模式只由 editor bridge 拦截副作用，Preview 模式保持组件真实交互；两者共享同一 Runtime 编译产物但拥有独立运行状态。

新增 Playwright 回归分别覆盖 Element/Ant binding trigger，以及两套 Provider 的真实 Collapse 非 binding `change` 事件；同一次组件 emit 只执行一次 Flow action。Workbench E2E 现为 `19 passed`，证明 connector 到 Flow action 的浏览器链路，而非只验证字符串或单元 mock。

对照结论：当前实现与成熟项目的共同点是“真实组件 + 编辑器桥接 + 独立辅助工作区”；差异在于我们额外要求 Registry 合同和 PageGraph 身份校验，这是为了避免 GrapesJS 任意 DOM 模型与 ConfigForm 受注册组件约束冲突。本轮无需引入新的页面编辑器依赖。

## Preview 生命周期与事件入口对照（2026-08-31）

本轮反向审计发现两个偏离成熟工具心智模型的实现：同一页面每次 revision 都用 Vue `key` 重建 Preview Runtime，并再次执行 `page.mount`；Registry 已校验的 `component.event` 在 standalone Source 中会主动安装监听，但 Preview Runtime 只监听字段 value binding。这会造成 Preview 状态丢失、mount 副作用重复，以及 Preview/导出行为分叉。

成熟项目对照后的修正原则如下：

- Craft.js / Framer 一类编辑器把文档更新与运行实例生命周期分离。组件树可以按稳定节点身份协调更新，但编辑 revision 不是新页面会话。当前实现因此增加稳定 `runtimeSessionKey`，同一项目页面只更新 Runtime props；只有首次打开、切页或切项目后真实挂载的新实例才执行 `page.mount`。
- Node-RED / n8n 一类事件流程以 trigger 作为入口、action 作为后续节点；画布位置不是运行事件协议。当前实现继续让 Vue Flow 只保存拓扑，同时把 Canonical Flow plan 中实际引用的 `nodeId + event` 编译进 Runtime plan，由真实 Vue 组件监听并上报。
- Runtime 只安装当前页面 Flow 实际使用的注册事件，不对组件做任意事件探测，也不从 DOM 文本和临时索引推断目标。字段 binding 事件与 Flow listener 使用同一 Vue handler key 去重，保证一次 emit 只触发一次 `component.event`。
- `onClick` / `onInput` 等已有组件 listener 转换回 Registry 事件名时统一为 `click` / `input`，避免 Preview 的大小写与 Flow contract 不一致。

本轮验证证据包括：Vue backend 测试证明仅被 Canonical Flow plan 引用的事件进入节点 `flowEvents`；RuntimeSurface 测试在真实组件上同时触发 `click` 与 `update:modelValue`，两者各上报一次且稳定携带 node id；Preview boundary 测试证明 revision 更新只发 `ready`，不重复发 `mounted`；Projection Coordinator 测试证明 revision key 改变时 runtime session key 保持稳定，切页时才变化。

对照结论：流程编排应当服务事件驱动的复杂逻辑，但 `page.mount`、`form.submit`、`field.change` 与注册组件事件都是合法事件入口；简单同步显隐/属性联动仍由 binding/reaction 处理。下一轮仍需优先补 `PageCompilation + CompileCoordinator`，因为成熟编辑器的稳定实例还要求实时路径不做全项目重编。

## PageCompilation 与成熟编辑器增量边界对照（2026-08-31）

本轮修正了“活动页任意修改都会重编整个项目”的偏差。Craft.js、Framer、GrapesJS 和 VS Code 虽然模型不同，但共同点是编辑时只更新当前文档及其受影响派生结果，全工作区构建属于显式 build/export，而不是 pointer 或属性编辑的默认成本。

落地后的边界如下：

- `PageCompilation` 是 Design 与 Preview 的不可拆分实时输入，只携带 snapshot identity、实际使用的 Registry contracts、page key 和 Canonical Page IR；不携带完整 ProjectDocument。
- `CompileCoordinator` 接收 `ProjectChangeSet.pageIds`，未变化页面直接复用原有 page/key 对象；缺失页面归属、乱序 editVersion 或项目切换时保守退化为失效，不以错误缓存换性能。
- committed 与 drag candidate draft 使用独立缓存；stale draft 不能覆盖 committed 页面产物。
- Workbench 对成功的 committed Vue Runtime artifact 进行有界、按页 memoization；只有完全相同的 `PageCompilation.key` 对象才能命中，draft 与失败结果不入缓存，因此编辑其他页面时当前页 semantic compiler 和 Vue backend 都不执行。
- 页面 key 排除 editVersion、其他页面、Flow 编辑器 position 和未使用物料；页面语义、已使用 contract 或 structural environment 改变时 key 必须变化。
- `compileCanonicalProject` 从 Workbench 实时编译函数中移除，只在用户显式打开或刷新 Source/Config Export 时按需组装完整项目。

与成熟项目相比，本轮已达到 page-scoped invalidation 和 stable runtime input，但尚未达到子树级增量：当前页面本身发生语义修改时仍会遍历整页，candidate 创建前的 ProjectDraftSnapshot 也仍经过完整 Model 校验。因此不能把 2000 节点页面级预算描述成 16.7ms pointer 更新。下一步需要 derived parent/dependency index、page-qualified changed entities、subtree hash 和 backend fragment cache；之后再迁移独立 iframe RuntimeHost，顺序与 Framer/Craft 的“稳定文档派生物先行、运行隔离随后”一致。

本轮证据：Compiler 单测覆盖其他页面、Flow position、未使用 Registry component 不改变 page key，页面语义/已使用 contract/environment 改变 key，三页项目只失效目标页，draft 不污染 committed cache，以及不完整 change set 的保守退化；Workbench Runtime artifact cache 测试以 backend 调用次数证明相同 key 只编译一次、draft/失败不入缓存；新增 2000 节点 Canonical page 和 Vue Runtime backend 性能保护网。Workbench 架构测试还明确禁止实时编译函数调用 `compileCanonicalProject`。

## 子树增量与成熟编辑器派生状态对照（2026-08-31）

本轮继续对照 Craft.js/Framer 的稳定节点 identity、GrapesJS 的 normalized Component tree，以及 VS Code 增量语言服务的 changed-document 边界。共同原则不是“缓存整页结果”，而是把作者事实、派生关系和运行片段分开：顺序由父序列表达，节点不复制会随兄弟排序一起变化的 index；完整祖先 path 由遍历派生；一次变更必须携带可定位到页面和关系的 changed entity。

当前实现据此完成以下收敛：

- `ProjectChangeSet` 增加 page-qualified `nodeChanges`，结构操作同时发布节点的 before/after parent+slot，以及受影响容器；Flow component-event 更新精确标记旧/新目标节点。
- Canonical IR v3 删除节点中重复的 sibling index 和 ancestry path，顺序继续由 `rootIds/slots` 唯一表达；节点增加 subtree hash，叶节点变化只替换自身和语义祖先。
- `CompileCoordinator` 对精确 change set 走子树增量，缺失归属仍保守整页失效；committed 与 draft 缓存继续隔离。
- drag candidate 使用已通过 Transaction Engine 校验的 draft snapshot 快路径，不再在 pointer 更新时重新解析完整 ProjectDocument。
- Vue Runtime Backend 按 resolver 与不可变 Canonical node identity 缓存成功 fragment；Runtime 计划更新时，未受影响的真实组件 fragment 保留对象 identity，不引入 Designer 专用控件或第二套页面模型。

与成熟项目的差异仍是有意的：Craft.js/GrapesJS 可以直接拥有编辑器组件模型，本项目必须让 Registry Contract、ProjectDocument 和真实 Vue Runtime 保持单一事实，所以缓存边界位于 Canonical node/Runtime fragment，而不是第三方编辑器 store。验证以硬证据为准：Compiler 测试证明无关节点对象 identity 不变，Vue backend 通过 `resolveBinding` 调用次数证明只处理变化路径，2000 节点的 `transaction -> draft snapshot -> candidate compile` 连续 20 次 p95 低于 16.7ms。下一项生产差距是独立 RuntimeHost/iframe 隔离，而不是继续扩展缓存层。

## 本轮完成后的成熟项目对照（2026-08-31）

| 维度 | 成熟项目模式 | 当前实现 | 结论 |
| --- | --- | --- | --- |
| 页面编辑事实 | Craft.js / GrapesJS 使用稳定节点身份和规范化组件树 | `ProjectDocument -> PageGraph -> PageCompilation`，Flow 不进入 Designer 临时状态 | 方向一致，并额外保持 Registry 白名单与 Vue Runtime 单一事实 |
| 事件流程入口 | Node-RED / n8n 以 trigger 启动有状态流程，节点坐标不属于运行协议 | `page.mount/form.submit/field.change/component.event` 编译为 portable plan；`component.event` 只保存注册的 `nodeId + event` | 符合事件编排定位；简单同步显隐继续由 binding/reaction 处理 |
| 运行实例生命周期 | Framer/Craft 类编辑器不会把每次文档 revision 当成页面重新挂载 | Preview 使用稳定 runtime session；同页 plan 更新不重复触发 `page.mount` | 已消除 revision 与 mount 生命周期耦合 |
| 增量派生 | VS Code 语言服务与成熟编辑器只失效 changed document/entity | page-qualified `nodeChanges`、subtree hash、draft/committed cache 和 Runtime fragment identity 复用 | 已达到页面内子树级增量，不再把 pointer candidate 退化为整项目编译 |
| 真实浏览器证据 | 成熟项目依靠交互与几何回归，而非只做 schema/unit 断言 | 19 条 Playwright 覆盖真实组件、拖拽、Preview、Flow 事件和可访问性 | 本轮链路证据充分 |

该阶段仍存在的生产差距包括 Design/Preview RuntimeHost、ExportSnapshot 完整不可变与 standalone Canonical Source 执行矩阵；后文记录了 RuntimeHost 的后续迁移结果。不能因为 Flow 和增量编译通过就归档任务。

## Registry 事件合同与 Flow 单入口复核（2026-08-31）

本轮继续按成熟项目反查事件能力，而不是把“能触发一次 notify”当成完成：

- Alibaba LowCode Engine 的物料协议把可配置事件作为组件元数据，由事件面板绑定处理逻辑；事件能力不靠运行时扫描 DOM。当前实现据此给 `DesignerMaterialDefinition` 增加显式 `events`，字段 binding trigger 仍从同一 Runtime binding 自动生成并按 Registry 原名去重。
- Node-RED / n8n 的核心边界是 trigger 启动流程，节点坐标只服务编辑；同步数据绑定不应伪装成异步 workflow。当前 `page.mount/form.submit/field.change/component.event` 都是页面事件入口，显隐、disabled、值映射继续由 binding/reaction 负责。
- GrapesJS 的组件事件总线主要服务编辑器模型通知，不能直接当业务流程总线。当前 Preview 只监听 Semantic Compiler 投影到 Canonical node 的 `flowEvents`，不会把任意 `onX` 或 DOM 事件广播给 Flow。

实现复核又发现并修正了两处偏差：RuntimeSurface 曾在 Preview 广播 binding/blur 等全部已管理 listener，即使页面没有对应 Flow；standalone Source 曾给节点安装 Registry 的全部事件。现在 Runtime 与 Source 都只安装“节点显式 action events + Canonical Flow listener set”的并集；Vue backend 也不再遍历 Flow plan 重建 listener，而只消费 Compiler 的 `CanonicalNodeIR.flowEvents`。

证据包括：Runtime 单测证明未订阅事件不广播、`click` 与 binding event 各分发一次；Compiler/Vue backend 测试证明 listener set 只在语义层投影一次；Canonical Source 测试证明引用的 `tab-change` 出现在生成 SFC，而未引用节点的 `change` 不出现；Playwright 分别通过 Element/Ant binding trigger，以及两套 provider 的真实 Collapse 非 binding `change` 事件。

官方参考：

- Alibaba LowCode Engine: https://github.com/alibaba/lowcode-engine
- GrapesJS Components: https://grapesjs.com/docs/modules/Components.html
- Node-RED messages and event flow: https://nodered.org/docs/user-guide/messages
- n8n workflow triggers: https://docs.n8n.io/workflows/components/triggers/

该阶段的对照结论是：Flow 的产品定位已经收敛为“事件处理器的可视化复杂逻辑编排”，不是页面第四种编辑模式，也不替代同步 binding/reaction；当时的下一生产差距是 RuntimeHost realm 隔离，后续迁移结果见下方 Preview 与 Design RuntimeHost 对照。

## Preview RuntimeHost 与成熟 simulator 边界对照（2026-08-31）

本轮按 Framer、Alibaba LowCode simulator 和浏览器编辑器常见的“编辑器宿主与用户运行页分 realm”模式迁移 Preview，而不是在父窗口继续包一层 Vue error boundary：

| 维度 | 成熟项目模式 | 本轮实现 | 证据 |
| --- | --- | --- | --- |
| 运行域 | simulator/preview 拥有独立 document、Vue 实例和组件副作用 | Preview 使用同源 `runtime-host.html` iframe；父窗口不再挂载 Preview RuntimeSurface | 架构测试禁止 PreviewDrawer import RuntimeSurface；Vite 双入口 build 生成独立 runtime-host |
| 输入合同 | 宿主传序列化文档/运行输入，simulator 自己解析组件 | 父窗口传 JSON-safe PageCompilation，iframe 用 adapter resolver 生成 Vue RuntimePlan | 真实 PageCompilation `structuredClone` 契约测试；协议不依赖 renderer 类型 |
| 状态通道 | 文档更新与运行值更新分开，避免输入时重载 simulator | `sync` 只处理结构/adapter/session，`state` 只传 values/reaction projection | 输入、Flow projection 更新不重复 clone PageCompilation，也不触发 Runtime 编译 |
| 生命周期 | 文档 revision 不等于运行页 remount | `runtimeSessionKey` 只随 project/adapter/page 改变；同页 revision 只发 ready，不重复 mounted/page.mount | Element/Ant Preview 与 Flow 浏览器全链通过 |
| CSS/Teleport | 用户页面样式和浮层属于 simulator document | provider CSS 在 iframe 动态加载；Select/Collapse 等 Teleport 留在 iframe，父 document 无对应 option | Playwright 在 FrameLocator 内操作真实 option，并断言父 document option 为 0 |
| 协议防护 | 消息有 session/version/revision，拒绝错源和陈旧结果 | channel/version/session/revision/sequence + source/origin/payload guard | 协议单测覆盖错 origin/source/session、非法 adapter/page/event payload |

本轮还保留了项目特有的严格边界：Runtime component event 跨 realm 时只保留 Flow 所需的注册 `{ nodeId, event }`，不 structured-clone Vue Component、renderer node、args 或函数；这比把整个事件对象广播到父编辑器更容易保证可重放和版本兼容。

该阶段当时尚未完成 Design Canvas RuntimeHost；下一节记录其后续迁移结果。当时 Preview Session/Flow Engine 仍有状态留在巨型 Workbench Controller，后续 PageFlowEngine 拆分见本文末尾；Runtime adapter 目前仍从 Designer Registry 构造 resolver，后续 Registry 内部合同拆分后应由独立 runtime binding resolver 提供。不能因为 RuntimeHost 迁移完成就宣称整个 IDE 架构完成。

## Design RuntimeHost 与成熟画布架构对照（2026-08-31）

本轮把 Design Canvas 从父 document 的 RuntimeSurface 迁入独立 iframe RuntimeHost，并按 Framer、Alibaba LowCode simulator、Craft.js 和 GrapesJS 的共同边界复核，而不是只比较视觉样式：

| 维度 | 成熟项目模式 | 当前实现 | 本轮结论 |
| --- | --- | --- | --- |
| Runtime document / realm | Framer 与 Alibaba simulator 将用户运行树放入独立运行域，编辑器 chrome 不进入业务 DOM | Design 与 Preview 分别拥有独立 iframe、Vue app、组件库 CSS 和 Teleport；IDE Dark 不改 Runtime computed style | 已达到运行域隔离；Design/Preview state 与生命周期不共享 |
| 真实组件与编辑器能力 | Craft.js connector 让用户组件负责渲染，编辑器只连接选择和拖拽能力 | RuntimeHost 渲染 Registry 真组件；selection、drop、resize、actions 全部留在父 document overlay | 方向一致，未引入 Designer 专用控件树 |
| Canvas 管理器边界 | GrapesJS Canvas/Components/Layers/Traits 各自负责运行文档、结构和属性 | iframe 只负责 Runtime；PageGraph/Registry/Inspector/Layer 仍由宿主领域服务负责 | 边界清晰，RuntimeHost 不成为第二份 Config Model |
| Geometry / event bridge | simulator 通过稳定节点身份与坐标桥连接宿主 overlay | bridge 以稳定 `nodeId` 注册，path/slot 是可更新 metadata；geometry、pointer 和 malformed payload 都经过版本化协议校验 | 三级嵌套和跨 slot move 不再产生 stale geometry |
| Pointer lifecycle | 成熟跨 iframe 编辑器必须保持 down/move/up/cancel 和 capture 连续 | Design Host 转发完整 pointer lifecycle；父层 controller 继续拥有拖拽事务和命中决策 | Runtime 不持有 drag model，职责没有倒置 |
| Candidate / drag visual | 成熟编辑器的 overlay 与落地节点来自同一渲染语义 | Canvas candidate 与鼠标虚影使用两个真实 RuntimeHost，接收同一 candidate PageCompilation，并验证相同 nodeId、DOM 签名和几何 | 不再用手写物料或尺寸近似冒充预览 |

本轮浏览器证据覆盖 Element/Ant 全物料、三级嵌套、pointer/keyboard/touch、drag visual、Preview、Flow、Dark/Light、移动端和 axe，共 `19/19`。协议层覆盖 Design sync、geometry、pointer down/move/up/cancel 和非法 payload；Designer、Workbench、Runtime 受影响测试分别为 `152`、`200`、`204` 项。

与成熟项目相比仍有明确差距：Canvas 尚无独立 camera/zoom/fit/pan，窄宿主仍可能压缩 frame 心智模型；selection/drag/resize controller 仍集中在大型 DesignerCanvas，Preview Session、Export Service 与 UI Store 也尚未从 Workbench Controller 完全拆开。Flow 的运行边界已在下一轮迁入 PageFlowEngine。下一步应从这些边界继续，而不是再修改 Runtime DOM 或增加第三套画布模型。

## 页面级 Flow Engine 与成熟工作流运行时对照（2026-08-31）

本轮没有重写 Core Interpreter，也没有让 Vue Flow 组件承担运行逻辑，而是把散落在 Workbench Controller 的 action registry、plans、projection、调度和 stale 防护收敛到独立 `PageFlowEngine`。对照成熟项目后的结果如下：

| 维度 | 成熟项目模式 | 当前实现 | 结论 |
| --- | --- | --- | --- |
| 编辑图与运行时 | Node-RED / n8n 的编辑器维护 workflow graph，运行引擎消费已部署/编译定义 | FlowWorkspace 只提交 Project Transaction；Core 产出 portable plan；PageFlowEngine 只消费 plan | 已分离编辑坐标与运行协议，Vue Flow 不成为第二个执行器 |
| 事件能力来源 | Alibaba LowCode 由物料元数据声明可配置事件，事件面板绑定处理逻辑 | Registry 声明事件，Compiler 投影实际引用的 `nodeId + event`，RuntimeHost 只上报稳定事件 | 比 DOM 扫描更严格，且满足平台注册组件白名单 |
| 运行上下文 | Node-RED/n8n 的执行状态属于一次 workflow/session，不写回流程定义 | Engine 持有 projection、scheduler、trace/error 和 generation；Preview values 通过显式端口读写 | ProjectDocument 保持纯 JSON 作者事实，运行状态不泄漏 |
| 生命周期和迟到结果 | 成熟 workflow runtime 在部署/会话变化时取消或隔离旧 execution | project/page 切换清空 projection 并推进 generation；旧异步结果返回 stale，不能提交 values/projection | 不再依赖巨型 Controller 中的闭包偶然阻止覆盖 |
| 页面作用域 | 通用自动化工具常允许工作流跨系统/资源 | ConfigForm Flow 仍严格属于一个 ProjectPage；跨页逻辑保留给未来 ProjectWorkflow | 有意差异，避免 field/node identity 作用域变模糊 |

验证证据：新增 PageFlowEngine 测试覆盖真实 `component.event` 精确匹配、Workbench action registry、projection merge/prune、跨页 pending run stale 和终态错误去重；架构测试禁止 Controller 直接实例化 Interpreter/Coordinator。Workbench 全量为 `36 files / 200 tests`，build 通过，Playwright `19/19` 继续覆盖 Element/Ant binding trigger 与两套 Provider 的非 binding Collapse 事件各执行一次。

仍未达到成熟产品的部分也保留在清单：Flow 节点配置目前仍以原始 JSON 为主，action registry 只有演示级 `notify`，权限/Schema/凭证/超时策略尚未产品化；Preview values、validation、AbortController 与 Runtime trace 还没有整体迁入独立 Preview Session；standalone Source 仍需证明与 Workbench 使用同版本 portable runtime，而不是长期维护近似解释器。

## Inspector 事件处理器单入口与成熟低代码产品对照（2026-08-31）

本轮继续从产品入口反查架构。此前 Runtime 和 Flow Engine 已经事件驱动，但 Workbench Inspector 仍可能让用户在 `node.events` action 字符串与 Flow 图之间二选一，形成两套相互漂移的事件语义。成熟产品的共同做法是从组件属性面板的事件元数据进入处理逻辑，而不是同时暴露一份自由字符串协议：

| 对照项目 | 成熟产品边界 | 当前实现 | 本轮结论 |
| --- | --- | --- | --- |
| Alibaba LowCode Engine | 物料元数据声明事件，事件面板为所选组件配置处理逻辑 | Inspector 只展示 Registry 注册事件，并携带精确 `nodeId + event` 打开 Flow | 事件能力来源与入口已统一，不扫描 DOM |
| Retool / Appsmith | 组件 Inspector 的 event handler 是动作或 workflow 的主要入口 | 点击事件行后，已有同目标 Flow 直接选中；没有则从该事件源创建 | 用户无需在两个事件编辑器间同步逻辑 |
| Node-RED / n8n | 可执行流程必须从明确 trigger 开始，编辑坐标不属于运行协议 | 新 Flow 必须先选择 lifecycle/form/field/component event source；Inspector 打开的事件是 preferred trigger | Flow 继续是事件处理器，不是页面第四种模式 |

Workbench 因此显式传入 `eventEditor="flow"`；Designer 默认仍保留 `actions`，只服务已发布兼容宿主。架构测试锁定 Workbench 不能重新暴露 inline action editor，FlowWorkspace 测试锁定精确目标的“选中已有/按源创建”，Playwright 在 Element 与 Ant 的真实 Collapse 上证明非 binding 事件各执行一次。

与成熟项目相比仍有明确差距：action catalog 目前只有 `notify`，action 节点配置还是原始 JSON，尚缺基于 Schema 的 setter、权限、凭证、超时策略与 standalone executable parity。本轮没有把这些缺口包装成已完成。

## Readonly Export Snapshot 与成熟开发工具对照（2026-08-31）

本轮优先修复导出数据正确性，而不是继续增加导出按钮。对照成熟工具后，目标不是复刻某个 UI，而是把“文件、版本和构建产物”的身份合同做实：

| 对照项目/模型 | 成熟边界 | 当前实现 | 本轮结论 |
| --- | --- | --- | --- |
| VS Code Explorer | 文件树对应真实文件；二进制不会静默变成空文本 | Source/Config tree 读取 pinned `WorkspaceFile`；单文件 helper 按 text/binary 创建 Blob，binary copy 禁用 | 文件名、MIME 和字节路径已统一，文件树不再只是视觉目录 |
| Retool / Appsmith 的版本化 publish/export | 发布物绑定明确 revision，编辑后旧产物显式过期 | stale identity 比较 semantic key、committed editVersion 或 draft identity、generator version | 不会把“语义碰巧相同”误判为同一作者快照 |
| 可复现构建系统 | toolchain/generator version 属于 artifact identity；一次 build 固定全部输出 | 一个 ExportSnapshot 同时供应 Source、Config、JSON/Tree、单文件和 ZIP | 禁止局部刷新造成跨 revision 混装 |
| immutable snapshot / event-sourced store | 历史产物只能读取，暴露 buffer 不能反向改写历史 | retained `Uint8Array` 不直接暴露；每次读取返回防御性副本 | 外部 mutation 不能改变后续下载或 ZIP |

Config authoring projection 也按同一原则补齐：Project schemaVersion、Registry lock、graph version/props、完整关系 placement、节点 metadata 与 Flow editor position 都保留；Runtime `span` 只是兼容投影。危险对象键由生成端和当前 Model schema 的同一 guard 拒绝，避免 `__proto__` 等对象字面量语义进入产物。

验证不是字符串快照：binary 断言覆盖源 buffer、读取 buffer 和 ZIP 三个观察点；Element/Ant 两套完整导出工程都执行 install、typecheck、build；第 20 条 Playwright 回归验证真实 Monaco/文件树/Source 与 Config 单文件下载反馈且无 console error。该回归还发现 Chromium 会警告同源 iframe 同时声明 `allow-scripts + allow-same-origin`，这套 sandbox 并不形成安全边界；当前 RuntimeHost 只运行平台注册组件，因此移除伪安全属性，保留独立 document、运行实例、CSS/Teleport 和版本化消息协议隔离。standalone Flow runtime 已通过 `latest/queue/ignore`、abort、timeout、error policy、model-order 和 value patch 的可执行矩阵；剩余差距是 Workbench 与导出工程仍需绑定同一版本化 portable runtime 实现身份，而不是长期维护两份等价解释器。ExportSnapshot 的 manifest digest/内容寻址缓存则只在需要分发或缓存产物时再引入。
