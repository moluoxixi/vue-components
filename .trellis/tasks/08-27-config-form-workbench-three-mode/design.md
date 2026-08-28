# Design-first 低代码 IDE 技术设计

## 架构原则

```text
Component Registry
        ↓ validates / describes
Config Model Store <- Model Operations / History
        ├─> Design Canvas + Layers + Inspector
        ├─> Runtime Renderer -> Preview
        ├─> Config JSON / Tree projection
        └─> Source Generator -> readonly Monaco / Export
```

- 只有 Config Model Store 拥有可变页面结构。
- Registry 是 component 能力与 Inspector schema 的唯一描述源。
- Generator 与 Runtime 是纯下游消费者，不允许回写 Model。
- UI selection、hover、panel、viewport、theme 与 Preview form values 属于 transient IDE state。

## Config Model

```ts
interface LowCodePageModel {
  id: string
  name: string
  nodes: LowCodeNode[]
  props: Record<string, unknown>
  version: 1
}

interface LowCodeNode {
  bindings: Record<string, RegisteredBinding>
  children: LowCodeNode[]
  component: string
  events: Record<string, RegisteredEventAction[]>
  id: string
  props: Record<string, unknown>
  slots: Record<string, LowCodeNode[]>
}
```

- `children` 是默认子序列，`slots` 只存具名 slot，避免 default slot 双写。
- `component` 是 Registry key，不持久化 Vue component 实例。
- events/bindings 是版本化白名单 IR，不保存函数。
- 现有 Designer `material` 在 migration 时映射为 `component`；conditions/reactions 映射到首版 registered bindings/events 能力。

## Registry

```ts
interface LowCodeComponentDefinition {
  bindings: BindingSchema[]
  category: string
  component: string
  defaults: LowCodeNodeDefaults
  displayName: string
  events: EventSchema[]
  icon: Component
  kind: 'component' | 'layout'
  props: PropertySchema[]
  runtime: Component
  slots: SlotSchema[]
}
```

- 通过适配器把现有 MaterialDefinition 迁移到该契约，逐步消除 `createNode` 中的隐式默认值。
- `PropertySchema` 复用现有 setter control，并增加 value type、multi-edit、layout/visibility 分组。
- Runtime、Inspector 与 Generator 仅根据 Registry key 查找定义；缺失定义是 hard diagnostic。

## Store 与 Operation

```ts
type ModelOperation
  = InsertNodeOperation
  | MoveNodesOperation
  | UpdateNodeOperation
  | ResizeNodesOperation
  | DuplicateNodesOperation
  | RemoveNodesOperation
  | BatchOperation

interface AppliedOperation {
  inverse: ModelOperation
  operation: ModelOperation
  revision: number
}
```

- reducer 在 clone 上完整校验后一次提交；revision 只在成功 operation 后 `+1`。
- history 保存 applied operation 与 inverse，selection 不进入 history。
- batch 对多选保持 all-or-nothing；节点路径从 id 索引解析，不在 operation 中保存易漂移 DOM path。
- Repository 保存 Model snapshot 与 revision；生成文件只在导出时物化，或作为可丢弃 cache。

## Design 工作区

- `LowCodeIdeShell`：topbar、desktop 三栏、responsive navigation、theme tokens。
- `IdeLeftPanel`：Components / Layers / Pages roving tabs。
- `DesignStage`：真实 Runtime tree + selection/drop/resize overlays。
- `SchemaInspector`：根据 Registry schema 创建 ConfigForm fields，发 update/batch operations。
- 现有 `ConfigFormDesigner` 内部 controller/history 将被拆到 model/store 层；成熟的 drag/drop、drop target、node chrome 逐步复用，不在 App 重新实现。

### 选择与 Resize

- selection state 使用 ordered `selectedIds` + primary id。
- click 单选；Shift 范围/增量选择；Ctrl/Cmd toggle；Layers 与 Canvas 共用同一 selection service。
- Resize handle 根据 Registry layout schema 映射到 `span`、width 或 grid properties；pointer move 仅展示 draft geometry，pointer up 提交一个 resize operation。
- 多选 resize 只在定义支持同一 layout property 时启用，否则 Inspector 显示 mixed/unsupported。

## Runtime 与 Preview

- `LowCodeRuntimeRenderer` 递归读取 Model + Registry，拒绝未注册 component。
- Canvas 渲染 Runtime 后叠加设计 chrome；Preview 复用同一 renderer 且不渲染 chrome。
- Preview coordinator 绑定 model revision，last-valid 只接受当前 pending revision 的 ready；form values 独立于 Model。
- 首版保留双 adapter registry；不再通过 generated source 才能预览。

## Source 与 Config 投影

- `generateConfigJson(model)`：稳定 key ordering、可下载 JSON。
- `generateVueSource(model, registry)`：生成真实 Vue SFC，只引用平台注册的 runtime package/API。
- `generateProject(model, registry)`：生成 App.vue、config module、styles 与 manifest；模板 build 测试消费此输出。
- `ExportMenu` 作为唯一入口，包含“导出源码”和“导出配置”；选择后打开 `ExportPreviewDialog`，不创建 Source/Config 工作区模式。
- `ReadonlySourceViewer` 使用 Monaco `readonly: true`；`ConfigViewer` 提供 JSON / Tree tabs；弹窗操作区统一提供复制、下载，源码视图额外提供项目导出。
- 旧 `parseDesignerConfig`、designer artifact 仅在 `migrateLegacyProject()` 使用，迁移成功后 normal flow 不再解析生成源码。

## UI 与主题

- 用 CSS 语义 token 定义 background/surface/border/text/accent/selection/danger/canvas-grid/shadow。
- Desktop 轨道建议 `240px minmax(480px,1fr) 320px`，各面板只拥有一个滚动容器。
- 中宽把 Components/Layers 与 Inspector 变为互斥非模态 drawers；窄屏使用 workspace tabs。
- Preview 由顶部命令打开右侧分屏，可调整宽度或全屏；它复用 Runtime Renderer，并且不创建第四个常驻工作区轨道。
- Source/Config 仅通过导出菜单打开大尺寸只读弹窗；窄屏时 Preview 与导出弹窗均切换为全屏视图。

## 迁移与回滚

- 先建立 Model/Registry/Operation 纯模块和 migration 测试，再切换 UI。
- 切换后一次性删除 App 的可编辑 Source/Config 更新路径、provider drafts 与双写 watch，禁止长期兼容两套真源。
- `WorkspaceProject` legacy schema 保持可读；保存时升级为 Model-owned schema，导出继续生成真实项目。
- 各阶段以测试与可独立回滚提交隔离：model core、designer interaction、IDE shell、readonly viewers/export。
