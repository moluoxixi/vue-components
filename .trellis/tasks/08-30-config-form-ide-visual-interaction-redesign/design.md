# ConfigForm IDE 架构重构设计

## 1. 设计结论

当前产品数据流是正确的，但“页面模型由 Designer 持有”的实现仍是过渡架构。长期生产版本采用项目级逻辑聚合合同：

```text
ProjectRepository (Manifest / Pages / Resources)
        -> immutable PersistedProjectEnvelope
             { document, repositoryRevision, entityRevisions, timestamps }
        -> ProjectEditorSession
        -> immutable ProjectSnapshot
             { document, editVersion, contentHash }
        -> Domain Command Engine
        -> Project Transaction Engine
        -> CompileCoordinator
             -> Canonical Page Program -> Vue Runtime Backend -> RuntimePlan -> Design / Preview
             -> Canonical Project Program -> Source Backend -> standalone Vue project

ProjectDocument -> Config Projection -> defineFields / JSON / Tree
```

以下实现边界需要重建：

- `ProjectDocument` 是唯一业务数据模型；它不保存 Repository revision、实体 revision、创建/更新时间或生成文件。`ProjectSnapshot` 只包裹 document、编辑版本和内容哈希；`PersistedProjectEnvelope` 只包裹 document 与持久化元数据，二者都不得形成第二套结构表示。`LowCodePageModel` 与 `DesignerDocument` 都只是历史输入或旧 API 投影。
- 领域合同位于不依赖 Vue、Designer、Workbench 或 UI library 的 Core/Model 层。
- `PageGraph v2` 使用 `root: SlotItem[] + nodesById + slots: Record<SlotName, SlotItem[]>` 的规范化结构，默认子节点统一进入 `slots.default`。`SlotItem` 同时拥有 node id 与父子关系上的 placement；Grid span、Flex basis/order、Tab item metadata 等不得继续污染通用节点字段。
- Designer 只拥有选择、拖拽候选、overlay 和面板等瞬态 UI 状态，不拥有页面结构历史。
- UI 与插件提交 `ProjectCommand` 表达用户意图；Domain Command Engine 基于当前快照解析为规范 `ProjectOperation[]`，Transaction Engine 原子提交后产生 `AppliedProjectTransaction`、semantic inverse 和 changed entity set。
- CompileCoordinator 以页面/子树为实时编译单位；Design 和 Preview 从同一版本化 `CanonicalPageProgram` 生成不可变 `RuntimePlan`。Source Export 固定同一 ProjectSnapshot 后按需组装 `CanonicalProjectProgram`。两类 Program 使用相同节点与 Flow 编译规则，但不要求编辑一次就重编整个项目。
- Design 和 Preview 通过独立 RuntimeHost 创建运行实例，禁止共享 values、validation、Flow queue、副作用生命周期、DOM 或 Teleport 容器。
- Workbench 不再由单个 Controller 编排所有领域；Vue Provider 只是依赖注入方式，真正边界是 Project Store、Design Session、Preview Session、Flow Engine、Export Service 和 UI Store。

## 2. 目标架构

```text
 ProjectRepository               RegistryContractSnapshot
 manifest/pages/resources        + runtime/source/design resolvers
          |                                    |
          v                                    |
 PersistedProjectEnvelope                      |
 { document, repositoryRevision, timestamps }  |
          |                                    |
          v                                    |
 ProjectEditorSession                          |
          |                                    |
          v                                    |
 ProjectSnapshot                               |
 { document, editVersion, contentHash }        |
          |                                    |
          +------------+-----------------------+
                       v
               CompileCoordinator
                 /             \
                v               v
      Canonical Page Program  Canonical Project Program
                |               |
      Vue Runtime Backend    Source Backend
                |               |
           RuntimePlan      WorkspaceFile graph
            /      \               |
    Design Host  Preview Host   Source/ZIP

 ProjectDocument -> Config Projection -> defineFields / JSON / Tree
```

## 3. 领域服务与会话边界

### 3.1 Project Domain Engine、Editor Session 与 Transaction Engine

持有项目级唯一业务事实，并为跨页面、路由和页面内部节点操作提供同一原子事务边界。唯一事实是逻辑合同，不等于把所有页面和资源永久序列化成一个大对象。

```ts
interface ProjectDomainEngine {
  snapshot: Readonly<ProjectDomainSnapshot>
  execute(command: ProjectCommand): DispatchResult
  undo(): DispatchResult
  redo(): DispatchResult
  subscribe(listener: (snapshot: ProjectSnapshot) => void): () => void
}

interface ProjectEditorSession {
  snapshot: Readonly<ProjectEditorSessionSnapshot>
  execute(command: ProjectCommand): DispatchResult
  undo(): DispatchResult
  redo(): DispatchResult
  save(): Promise<SaveResult>
}
```

- `ProjectDocument` 包含页面顺序、页面路由、首页、项目设置、共享资源/流程和 Registry lock；不包含生成源码文件、Repository revision 或持久化时间戳。`ProjectSnapshot` envelope 只增加 `editVersion` 与 `contentHash`，不得复制或重新投影 document。
- `ProjectDomainEngine` 只拥有 Command、Transaction、History、semantic inverse、`editVersion` 和 change set，不依赖 Repository、Vue、当前页、selection 或保存状态。
- `ProjectEditorSession` 是 Workbench application facade，组合 Domain Engine 与 `ProjectSaveCoordinator`；其公开状态使用 `{ project, history, persistence }` 组合而不是继承 `ProjectSnapshot`。后者独立拥有 `repositoryRevision`、saved cursor、CAS、commit receipt id、saving 和 persistence diagnostics。`editVersion`、`repositoryRevision`、`contentHash`、Registry fingerprint 与 compiler version 是不同维度，禁止复用一个 `revision` 字段表达。
- 当前页属于 Design/Workbench navigation session。切换页面不调用 Domain Engine，不进入 ProjectSnapshot，也不产生 revision/history。
- Repository 允许把 `ProjectManifest`、`PageDocument` 和 `ResourceDocument` 分实体保存；页面 Flow 由 `ProjectPage.flows` 持有，与视觉 `PageGraph` 同级并随 Page 实体保存。Manifest 在一个 `repositoryRevision` 下引用带 checksum 的不可变实体版本，未变化实体可以复用较早的 entity revision。一次 load 必须组装并校验完整 `PersistedProjectEnvelope`，一次跨实体 commit 必须保持原子性。Domain Engine 不读取 entity revision 或持久化时间戳。
- Repository commit 使用 CAS；存储 envelope 必须包含 schema version、project revision、实体 revision/checksum 和迁移状态。进程崩溃、配额失败或部分写入时不得暴露混合 revision。
- Command 必须携带稳定 id。Command resolver 可在未发布的草稿上展开多个语义 action，但只允许完整 OperationBatch 通过最终 Graph/Registry/Flow 校验；不得因中间暂态非法而拒绝最终合法的原子命令。
- Command 必须 JSON-safe。`node.patch` 使用显式 `set/unset`，禁止用 `undefined` 表达删除；同一 key 不得同时 set/unset。
- Transaction 是已解析的规范 OperationBatch，不再承担 UI 意图解释。Repository commit 使用独立稳定 commit id 提供幂等保护；多标签页冲突返回结构化 revision diagnostic，不静默覆盖。
- 每个 `PageGraph` 包含 `root: SlotItem[]` 与 `nodesById`；节点只通过 `slots: Record<SlotName, SlotItem[]>` 表达父子关系。
- 节点使用 field/layout 判别联合，类型和运行时 Schema 同时禁止 field 节点持有 slots、layout 节点持有 field-only 数据。
- history 保存 `AppliedProjectTransaction`、semantic inverse、editVersion 和 transaction metadata，不保存 repositoryRevision、未解析 Command 或完整 ProjectDocument 深拷贝。
- 页面管理与页面内部编辑可处于同一个事务中；正常路径禁止 `update-page-model` 这类整页替换操作。
- 失败操作不改变 model、history 或 revision；批量操作全量原子回滚。
- 旧 `WorkspaceApplication`/`LowCodePageModel` 只在 repository ingress 做确定性迁移，迁移完成后不进入业务层。

### 3.2 Component Registry

对外保留一个 Registry facade，内部拆为四类能力，避免 Material 定义成为跨层 God Object：

```ts
interface ComponentContract {
  key: string
  version: string
  kind: 'field' | 'layout'
  props: PropertySchema[]
  events: EventSchema[]
  bindings: BindingSchema[]
  slots: SlotSchema[]
  defaults: NodeDefaults
}

interface RuntimeBinding {
  component: Component | string
  valueProp?: string
  trigger?: string
  readonlyRender?: ReadonlyRender
}

interface DesignMetadata {
  displayName: string
  category: string
  icon?: Component
  inspector: InspectorSchema
  policy: DesignPolicy
}

interface SourceBinding {
  tag: string
  library?: SourceLibrary
  options?: SourceOptions
}
```

可序列化 `ComponentContract` 属于 Core/Model 层并组成 `RegistryContractSnapshot`；`RuntimeBinding` 属于 Runtime adapter；`DesignMetadata` 属于 Designer adapter；`SourceBinding` 属于 Generator adapter。运行时 facade 可以组合查询这些 resolver，但不得把 Vue Component、图标或函数写入可序列化快照或其 fingerprint。Model 只保存稳定 component key，Transaction Engine 只依赖 `RegistryContractSnapshot`。

内容指纹只用于检测差异，不承担迁移。每个组件合同还必须声明 `contractVersion`，Registry 提供从旧版本到当前版本的确定性 migration chain；缺失组件或不可迁移合同进入可恢复诊断态，不能直接丢弃节点。项目锁定实际使用组件的 `{ key, contractVersion, fingerprint }`，新增或修改未使用物料不得使项目失配；全 Registry fingerprint 只用于缓存/诊断，不作为项目兼容性的唯一判据。

Registry facade 负责按 component key 关联 Contract、Runtime、Design 和 Source resolver，并统一执行 placement、props、events、bindings、source capability 校验。Palette、Inspector、Runtime、Preview 和 Generator 必须锁定同一 Contract Snapshot；历史项目使用 `registryLock` 检测不兼容物料升级，RuntimeHost 在自己的隔离 realm 内按 adapter/version 解析真实 Vue 组件。

### 3.3 Design Session

Design Session 是 ProjectEditorSession/ProjectDomainEngine 的命令客户端，不是另一个 model store。

- 读取 `ProjectSnapshot` 的当前 PageGraph 并提供树形投影、选中节点和 Inspector 读模型。
- 拖拽期间创建临时 candidate transaction，应用到基线 snapshot 的 copy-on-write 草稿，形成带 `base editVersion/contentHash + draftHash` 的 `ProjectDraftSnapshot`，再编译 candidate RenderPlan。DraftSnapshot 不得进入 history、Repository 或正式 Project Store 发布流。
- candidate 与 committed snapshot 都通过同一个 Runtime Compiler；overlay 只负责选中框、drop indicator、resize handle 和 node actions。
- pointer/keyboard drop 最终只提交一次 Project Command，并只产生一个 AppliedProjectTransaction。
- 不维护 `DesignerHistory`；Undo/Redo 直接调用 ProjectEditorSession。
- 旧 `DesignerCommand` 仅在 compatibility adapter 中转换为 `ProjectCommandAction`，不拥有 history，也不能把旧模型写回 Repository。

### 3.4 Semantic Compiler、Runtime Backend、RuntimeHost 与运行实例

纯 Semantic Compiler 把规范 `ProjectCompilationSnapshot`（正式 `ProjectSnapshot` 或瞬态 `ProjectDraftSnapshot`）与 Registry Contract 编译为不可变、框架无关、版本化的 Program。实时路径返回不可拆分的 `PageCompilation { snapshotIdentity, registryUsage, key, page }`；全局导出路径才组装 `ProjectCompilation { snapshot, registry, key, project }`。Vue Runtime Backend 从 PageCompilation 降级为 `RuntimePlan`，Source Backend 从 ProjectCompilation 降级为 standalone Vue AST/file graph；禁止调用方自行拼装 snapshot/registry/Program，禁止两个 backend 回头解释 ProjectDocument。有状态 CompileCoordinator 负责 dependency graph、subtree cache、invalidations 和 Program assembly，纯函数本身不得偷偷持有缓存。Canvas 和 Preview 复用同一 PageCompilation 生成的 plan 语义，但分别交给独立 RuntimeHost。

```ts
interface SemanticCompiler {
  compilePage(
    project: ProjectCompilationSnapshot,
    registry: RegistryContractSnapshot,
    pageId: PageId,
    structuralEnvironment: RuntimeStructuralEnvironment,
  ): PageCompilation

  compileProject(
    project: ProjectSnapshot,
    registry: RegistryContractSnapshot,
    structuralEnvironment: RuntimeStructuralEnvironment,
  ): ProjectCompilation
}

interface RuntimeHostOptions {
  mode: 'design' | 'preview'
  presentation: RuntimePresentationSnapshot
  editor?: RuntimeEditorBridge
  lifecycle?: AbortSignal
}
```

- `RuntimeStructuralEnvironment` 只允许真正改变节点结构或组件能力选择的版本化 feature flags。viewport、locale、字体、runtime theme/tokens 和初始值策略属于 `RuntimePresentationSnapshot` 或 Runtime instance，不进入结构 plan key。
- `CanonicalPageProgram` 保留 page identity、component key/version、resolved props、events、bindings、conditions、validation、portable Flow execution plan、slot 顺序、placement、node id/path 和布局语义，不持有 Vue Component、DOM、生成源码文本、表单 values、viewport、editVersion 或 AbortController。`CanonicalProjectProgram` 组合固定快照的页面 Program 与项目路由/资源语义。
- 编译身份分为四类：`editVersion` 只表示本地操作时序；`contentHash/pageContentHash` 表示作者内容；`compileKey` 只由语义内容、实际使用的 Registry contracts、compiler version 和 structural environment 组成；`runtimeInstanceId` 只标识一次运行实例。`editVersion` 不得进入 IR hash 或缓存键。
- `RenderPlan` 只是 Vue Runtime Backend 的输出；它不得被 Source Backend 反向解析，也不得承担源码 imports、AST 或文件布局职责。
- CompileCoordinator 使用 ProjectSnapshot 的结构共享、derived parent/dependency index、subtree hash 和 changed entity set 做增量编译。拖拽 pointer move 只能重算受影响页面/子树并在 animation frame 内发布，不得解析、克隆、编译或挂载整个项目。
- `mode` 只影响运行实例的事件拦截、生命周期和 editor metadata，不能改变 RenderPlan 或默认替换组件。
- 组件必须在 Registry 中注册，任意 HTML DOM 不属于 model 合同。
- `RuntimeHost` 是可替换隔离合同。iframe、ShadowRoot 与严格 scoped host 是按组件库能力选择的实现，不在领域架构中写死优先级；同一 adapter 的物料 specimen、candidate、Design 与 Preview 必须使用同一个 bootstrap。Host 必须隔离 IDE CSS、第三方组件库全局样式、Teleport、字体加载和副作用。
- `RuntimeSurface` 在 RuntimeHost 内负责真实 Vue 节点、递归 slot、ARIA、Grid/Flex 和 readonly 渲染。Editor overlay 位于宿主编辑器层，只通过 node id/path 驱动的 geometry/event bridge 获取矩形和命中信息；不得包裹或克隆业务节点。
- 对确实不能在设计态挂载的异步/副作用组件，Registry 必须声明受控 adapter 和 `visualEquivalence` 合同；没有该合同则阻止进入 Canvas，而不是静默渲染另一种控件。
- `visualEquivalence` 只是能力声明，必须由 bounding-box、computed-style 和截图契约测试证明。
- RenderPlan 必须保留 stable node id/path/slot metadata，供 RuntimeHost bridge、overlay、Layers、Preview parity test 使用。同一 presentation 下要求 geometry parity；不同 viewport 下只比较节点语义并允许真实响应式差异。

### 3.5 Preview Session

Preview Session 只保存预览实例状态：表单 values、touched/validation、flow projections、AbortController 和运行 trace。它不写入 ProjectDocument。

- Preview 从同一个 Project revision、Registry Contract fingerprint 和 compiler version 的 RenderPlan 创建独立 RuntimeHost；它可以使用与 Canvas 不同的 Runtime Presentation/viewport。
- Design 提交后由 Project Store 发布 changed entity set；Preview 原子切换 RenderPlan，并按稳定 node id、字段名和字段合同协调可兼容 values/touched 状态。被删除或合同变化的节点清理状态，而不是每次 revision 都无条件重置整份表单。
- 旧异步预览在 revision/application/page 变化时取消；过期结果不得覆盖新实例。
- Preview 的默认值、reaction、Flow projection 只能影响运行实例，不得改变结构 model。

### 3.6 Flow Engine

`ConfigFormFlow` 只属于一个 `ProjectPage`，作为视觉 `PageGraph` 的同级数据存在。其 `page.mount/form.submit/field.change` trigger、字段引用、校验、排序和 Flow ID 唯一性都以该页面为边界，并与 PageGraph 一起随 Page 实体持久化。Flow Engine 提供校验、编译与运行能力。页面内纯同步显隐/属性联动使用 binding/reaction；分支、异步、接口调用和副作用使用 Flow，禁止两套机制表达同一逻辑。未来跨页面/项目自动化必须使用独立 `ProjectWorkflow` 合同，不得把页面 Flow 复制到 ProjectDocument root。

- Flow 编辑只提交 `addFlow`、`updateFlowGraph`、`updateFlowSettings` 等 Project Transaction operation。
- Core 负责解析和生成确定性、自包含、与 editVersion 无关的 portable execution plan；计划完整包含 trigger、concurrency、error policy、节点和已解析边，不包含画布 position 或运行 revision。Workbench 注入带 Schema、权限和超时策略的 action registry。
- Preview 和导出 Source 只消费同一 execution plan；原始 FlowGraph 仅用于编辑和 Config Projection，不进入 Runtime 或 Source Backend。
- portable flow runtime 是框架无关、可版本固定的同一实现：Workbench 直接调用，导出工程内嵌该版本的源码。导出工程不能依赖 ConfigForm runtime，也不能维护第二套近似解释器。
- Flow 是辅助工作区/弹窗，不成为第四种页面编辑模式。

### 3.7 Readonly Export Service

Source、Config、Tree 和 ZIP 都读取一次性不可变 `ExportSnapshot`。纯生成与 UI 生命周期分开：

```ts
buildExportSnapshot(input: {
  compilation: ProjectCompilation
  generatorVersion: string
}): ExportSnapshot

interface ExportSession {
  readonly snapshot: ExportSnapshot
  readonly stale: boolean
  refresh(): Promise<ExportSessionResult>
}
```

- `buildExportSnapshot` 是无内部状态的确定性纯构建器；`ExportSession` 只负责固定当前快照、stale、刷新失败和焦点/UI 生命周期。
- `ExportSnapshot` 固定 compilation key 和 generator version；任何输出失败都保留上一份完整快照。Builder 不接受分离的 ProjectSnapshot、Registry 与 IR，避免混用不同 revision。
- Config 源码使用公开 `defineFields<T>()` / `defineField({...})` 生成器；JSON/Tree 是 ProjectDocument 的无损只读投影，不经过 Runtime IR 默认值合并。
- Source Backend 只消费 CanonicalProjectIR 和 Source resolver，生成完整 standalone Vue 工程、真实文件树与 `package.json`；不允许重新解释 ProjectDocument，也不反向解析 Source/Config。
- 生成器输出统一的 `Record<ProjectPath, WorkspaceFile>`，单文件查看、复制、下载和 ZIP 下载全部读取同一快照。
- 生成文件不写回 ProjectDocument；未来用户资产单独存入 `resources/assets`，不能与派生源码混用。
- Generator 使用结构化 AST/安全序列化 helper 处理代码和 HTML 敏感字符；Babel parser 只用于 legacy import/migration，不作为规范 Config Model。

### 3.8 Workbench UI State

只管理面板、对话框、主题、语言、移动端导航、提示消息和焦点恢复，不持有页面结构、Runtime values 或导出文件。

`WorkbenchShell` 只组合各 Service/Session 的 Vue context 和 UI，不执行 Transaction、Flow 调度或生成 Source。

## 4. 规范模型与兼容迁移

### 4.1 正常编辑模型

新增版本化 `ProjectDocument` 作为领域内容的标准 wire format。Repository 通过 `PersistedProjectEnvelope` 附加持久化元数据并可按实体存储，但不得形成另一套业务模型。页面使用规范化 `PageGraph v2`，root、default slot 与 named slot 都保存 `SlotItem`，节点实体只出现一次。`LowCodePageModel v1` 不再作为正常编辑模型，只作为迁移输入。

`LowCodePageModel` / `DesignerDocument` 的用途收敛为：

1. 历史 artifact 的一次性读取与迁移；
2. 已发布旧公共 API 的 compatibility adapter；
3. 不参与 Workbench 正常编辑、Runtime 编译、Preview、Config 导出和 Source 导出。

### 4.2 数据迁移

- 打开旧项目时在 repository boundary 完成一次确定性迁移：递归树转 `nodesById`，`children` 转 `slots.default`，生成文件从持久模型剥离。
- 开发期 `ProjectDocument v3` 在 repository boundary 确定性迁移为 v4：`graph.flows` 移到同一 Page entity 的 `ProjectPage.flows`；两处同时存在时拒绝迁移，禁止猜测覆盖顺序。
- 迁移失败保留原始记录，不写入部分新格式状态。
- 新旧 API 可在一个发布周期内并行，但 compatibility 包只能依赖新领域层，领域层禁止反向依赖 compatibility。
- 清理旧适配层前必须通过 legacy fixture、导出工程和包边界 smoke test。

## 5. 依赖方向

```text
core model / schema / flow plan
        -> domain command + project transaction engine
        -> semantic compiler + Canonical Project IR
             -> Vue runtime backend + runtime host + binding adapters
             -> Source backend + source adapters
             -> Config projection
        -> designer session + design adapters
        -> workbench services / UI
        -> compatibility migration (ingress only)
```

- Core/Model 不依赖 Vue、Renderer、Designer、Workbench 或 UI library。
- Runtime Compiler 不依赖 Designer 或 Workbench UI；Runtime binding adapter 才允许依赖 Vue。
- Design Session 依赖 Project Store、Registry 和 Runtime Compiler，不反向依赖 Export 或 Flow UI。
- Source Export 只读取 CanonicalProjectIR、Registry source binding 和 Flow plan；Config Projection 只读取 ProjectDocument。两者都不读取 Designer DOM 或运行实例。
- Monaco、Vue Flow 等成熟库只承担代码编辑和流程图交互，不引入第二套页面模型。

## 6. 关键不变量

1. 任意项目或页面结构只能通过 `ProjectCommand -> OperationBatch -> Project Transaction Engine` 改变；compatibility adapter 只能产生 Command Action，不能直接维护状态。
2. PageGraph 中每个 node id 只对应一个实体；父子关系只存在于一个 slot 序列中。
3. 任意可见 Design/Preview 节点都来自同一 `ProjectCompilation` 的 content hash、Registry component locks、compiler version 和 CanonicalProjectIR node id/path/slot/placement。
4. 同一 revision 的 Canvas 与 Preview 的 Runtime component、props、layout 语义和 slot 顺序相同；相同 presentation 下可见几何一致，不同 viewport 下只允许真实响应式差异；values、validation、Flow queue、DOM、Teleport 和副作用生命周期隔离。
5. Undo/Redo 只应用 semantic operation/inverse，不恢复隐式 DOM、运行实例或整份旧 Project 快照。
6. Source、Config、Tree、单文件下载和 ZIP 在同一个 ExportSnapshot 中只读取一个 `ProjectCompilation`；Source 只由其中的 CanonicalProjectIR 生成，Config/Tree 只由其中绑定快照的 ProjectDocument 投影。
7. Flow 执行的 transient values、outputs、trace、queue 和 abort signal 不进入 ProjectDocument。
8. 生成源码文件不进入 ProjectDocument；可持久化用户资产必须有独立 resource contract。
9. Runtime theme 与 IDE chrome theme 隔离，Canvas sheet 和 Preview 组件样式不被 IDE dark token 改写。
10. Repository load/commit 只能发布一个完整 manifest revision 的 `PersistedProjectEnvelope`；Page/Resource 实体可以复用较早 entity revision，但 checksum、reference revision 或任一实体失败都不得形成可见状态。
11. viewport/locale/font/runtime theme 属于 Runtime Presentation；几何 parity 测试必须显式固定相同 Presentation。Design mode 只能在 RuntimeHost 外层叠加 overlay 或通过 bridge 拦截事件，不能偷偷改 props、组件或布局。
12. Export Builder 无会话状态；所有 stale/refresh 行为只存在于 ExportSession。

## 7. 风险与回滚

### 风险

- 统一 ProjectDocument/PageGraph 会触及 Core、Designer、Runtime、Workbench、Adapter 和 Export 多个包。
- 设计 adapter 的视觉等价性无法仅靠类型保证，需要 DOM geometry 和 screenshot/integration 验证。
- Flow plan 与 standalone Source runtime 的等价性需要执行矩阵，而不是字符串断言。
- Project transaction history 替代快照 history 后，需要覆盖跨页面操作和 revision conflict 的边界。

### 回滚策略

- repository 在写入新格式前保留原始旧记录，迁移失败时可重新读取旧记录；正常业务层不保留双写或双模型开关。
- Project Store、Runtime Compiler、Export Service 各自完成契约测试后切换调用方，每次切换保持仓库可构建。
- 任何阶段发现 Canvas/Preview parity、导出工程或迁移回归，回滚该次代码提交；不通过在运行时长期维护第二套架构规避问题。
- 删除正常路径中的旧 `DesignerDocument` / `LowCodePageModel` 依赖必须独立验证，并在包边界 smoke test 通过后进行。
