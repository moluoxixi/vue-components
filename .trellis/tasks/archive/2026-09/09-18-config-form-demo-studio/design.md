# ConfigForm Demo Studio 技术设计

## 1. 设计目标

本设计将“生产表单 Runtime”和“高保真 Demo 创作”拆成相互协作但依赖方向清晰的两条路径：

```text
生产应用：宿主 Vue/TypeScript -> Runtime / Headless / adapters

Demo 创作：Studio -> Designer -> Model -> Compiler -> Vue backend
                                      -> Prototype Runtime -> Experience
                                      -> Source -> 可运行源码
```

Studio 作者能力只产生 JSON-safe 的 UI、模拟数据和本地交互。函数、HTTP、鉴权、异步副作用和业务状态不进入 ProjectDocument。

## 2. 术语与所有权

| 概念 | 定义 | 所有者 |
| --- | --- | --- |
| Material | 可拖入设计面的组件类型和创建模板 | Designer adapter Registry |
| SurfaceAsset | 项目内可命名、持久化、引用和编译的 Page/Dialog/Drawer | Model |
| SurfaceInstance | 体验会话中某个 SurfaceAsset 的一次运行实例 | Prototype Runtime |
| Dataset | 项目级只读 JSON 对象数组 | Model / Studio |
| Prototype Interaction | 安全表达式、值动作或单一主要 UI 动作 | Core / Model |
| Business Handler | 接口、异步副作用和业务函数 | 导出后的宿主代码 |

Material 不能拥有项目资产身份；SurfaceAsset 不能进入 Registry lock。一个 SurfaceAsset 可以被多处引用并在同一体验栈中产生多个独立实例。

## 3. 领域模型

### 3.1 ProjectDocument

目标形状采用 current-contract-only 硬切：

```ts
interface ProjectDocument {
  version: typeof PROJECT_DOCUMENT_VERSION
  id: string
  name: string
  homeSurfaceId: SurfaceId
  surfaceOrder: SurfaceId[]
  surfacesById: Record<SurfaceId, ProjectSurface>
  datasetOrder: DatasetId[]
  datasetsById: Record<DatasetId, ProjectDataset>
  resources: Record<ResourceId, ProjectResource>
  theme: ProjectThemeV1
  registryLock: RegistryLock
  settings: ModelJsonObject
}
```

`registryLock` 保留 adapter 身份、Registry 版本/指纹和组件锁，是项目内唯一的
adapter 锁定事实源；不再增加平行的 `adapter` 字段。完整 provider metadata 不持久化
进 ProjectDocument，只由 Studio 组合根读取并适配成 Source resolver。

不保留 `pagesById/pageOrder` 双模型。home 必须指向 `kind: 'page'` 的 Surface。

### 3.2 SurfaceAsset

```ts
type ProjectSurface
  = ProjectPageSurface
  | ProjectDialogSurface
  | ProjectDrawerSurface

interface ProjectSurfaceBase {
  id: SurfaceId
  name: string
  graph: SurfaceGraph
  parameters: SurfaceParameterDefinition[]
  outputs: SurfaceOutputDefinition[]
  interactions: PrototypeInteraction[]
}

interface SurfaceGraph {
  version: typeof SURFACE_GRAPH_VERSION
  props: ModelJsonObject
  form: FormSettings
  root: readonly SlotItem[]
  nodesById: Readonly<Record<NodeId, SurfaceNode>>
}

interface ProjectPageSurface extends ProjectSurfaceBase {
  kind: 'page'
  route: string
}

interface ProjectDialogSurface extends ProjectSurfaceBase {
  kind: 'dialog'
  presentation: DialogPresentation
}

interface ProjectDrawerSurface extends ProjectSurfaceBase {
  kind: 'drawer'
  presentation: DrawerPresentation
}
```

Dialog/Drawer 的标题、响应式尺寸、方向、遮罩，以及 ESC、mask、关闭按钮策略属于
判别式 presentation，不藏在任意 `graph.props` 中。响应式长度使用结构化
desktop/tablet/mobile 值与受控单位，不接受任意 CSS 字符串。Surface kind 创建后
不可原地转换；需要变体时复制为新资产。`mask: false` 时 `close.mask` 必须为 false；
ESC、mask、关闭按钮只关闭栈顶实例并将焦点还给 opener。

SurfaceGraph 从 PageGraph 硬切时保留图级 props、表单设置、root slot placement 和
nodesById，不把现有 Grid/Flex placement 简化成 root node ID 列表。节点联合为
field/layout/element，展示与操作物料不得伪造 form field；旧 bindings、conditions、
reactions、page runtime 和 dynamic optionSource 被严格拒绝。Surface Foundation 原子
升级 Registry snapshot v3 的类型、版本、Reader 校验并迁移现有基础物料条目；v3 以
Material kind、语义 trigger、state property allowlist 及命名 Dataset/Resource
capability 约束节点引用。Materials 后续只扩充物料条目、编辑 UI 和 adapter 映射，
不得再次升版或发明第二套能力合同。

surfaceOrder 必须非空且至少包含一个 Page；datasetOrder/datasetsById 允许同时为空。
两组 order/map 都必须双向一致且 map key=id；Page route 以 `/` 开头并在项目内唯一。

### 3.3 Dataset

```ts
interface ProjectDataset {
  id: DatasetId
  name: string
  description?: string
  rows: ModelJsonObject[]
  defaultProjection?: DatasetProjection
}
```

组件持有稳定 `datasetId` 和用途相关 projection。Dataset 与远程 Data Source 是不同合同：Dataset 是设计期静态资产；Data Source 是工程师代码态 Runtime 能力。

Dataset 子任务拥有 JSON 数据校验、字段路径解析、投影以及本地筛选、排序、分页等确定性纯运算；Materials 子任务只拥有 Table/List/Select 等组件如何消费这些结果及其视觉、选择状态与语义激活器。两层不得各自实现一套查询语义。

### 3.4 Resource

```ts
type ProjectResource =
  | {
    id: ResourceId
    name: string
    kind: 'embedded'
    fileName: string
    mediaType: string
    byteLength: number
    contentHash: string
  }
  | {
    id: ResourceId
    name: string
    kind: 'url'
    url: string
    mediaType?: string
    integrity?: string
  }
```

embedded bytes 由 Repository/storage adapter 管理；静态 URL 只是可持久化资源地址，
不引入 HTTP Data Source 的加载、缓存或刷新合同。Surface 节点只持有 resourceId。
embedded metadata 另存稳定 fileName，contentHash 固定为 raw bytes 的 SHA-256。
单 Resource transfer v1 对 embedded 资源携带并校验 canonical base64 bytes，对 URL
资源只携带已校验 URL。Project transfer v1 携带 ProjectDocument 以及每个 embedded
Resource 恰好一份内容，保证完整项目 JSON 无损；SourceFileSet 使用独立 text/binary
判别联合，不把二进制伪装成字符串源码。

### 3.5 Prototype Interaction

交互分为三种互不混用的合同：

1. 状态表达式：持续计算 `visible/disabled/readonly/required` 和 Material 明确允许的展示属性。
2. 值动作：依赖字段变化后执行 `set/copy/clear`，不在初始化时执行。
3. 主要 UI 动作：语义激活器上最多一个 `navigate/back/open/closeCurrent/closeAll`。

表达式只支持现有安全 AST、字段/参数/Dataset item 上下文和白名单纯函数。禁止赋值、网络、任意 JavaScript 和隐式宿主函数。

Safe Expression v1 明确 own-property-only 路径、prototype key 禁止、missing/coalesce、
类型严格深比较与有序比较、boolean condition、短路逻辑、有限数算术、JSON-safe
函数结果以及 32 深度/256 节点上限。相同 state target 只能有一条规则并覆盖静态
baseline；多个 value rule 写同一 target 时警告，按 interactions 声明顺序执行并
last write wins。

Material 只声明类似 `activate`、`rowActivate` 的语义能力，不恢复 DOM 事件表。

## 4. 体验会话

### 4.1 实例模型

```ts
interface SurfaceInstance {
  instanceId: string
  surfaceId: SurfaceId
  parentInstanceId?: string
  openerNodeId?: string
  parameters: ModelJsonObject
  values: ModelJsonObject
}

interface PrototypeSession {
  pageHistory: SurfaceInstance[]
  overlays: SurfaceInstance[]
}
```

每次 `open` 都创建新的 instanceId。相同 surfaceId 可以在栈内重复出现；用户动作可以形成 A -> B -> A。不存在加载时自动 open，因此引用环不会同步递归实例化。运行时不设置产品级深度上限。`instancesById` 只保存仍由页面历史或浮层栈引用的活实例；关闭、返回或导航清除浮层时必须同步删除已关闭实例并释放其表单、校验和焦点状态。

### 4.2 导航与关闭

- `navigate`：切换根 Page，清空当前 overlay 栈并删除这些浮层实例；体验会话保留各 Page 的已访问状态。
- `open`：将 Dialog/Drawer 新实例压栈。
- `closeCurrent`：关闭栈顶实例、从实例表删除它并把焦点返回 opener。
- `closeAll`：清空 overlay 栈并删除其中实例，保留当前 Page。
- `back`：有 overlay 时先关闭并删除栈顶实例；否则回退 Page history，并删除被弹出的 Page 实例。

close 不能按 surfaceId 定位，因为同一资产可以同时存在多个实例。

### 4.3 参数与结果

Surface 显式声明参数和具名输出。调用点以固定 JSON 或安全表达式映射输入；Surface 内只读 `params.*`，不隐式读取 opener 字段。关闭结果一次性映射回调用者并作为单一事务提交，再统一执行联动。

## 5. 编辑体验

Studio 外层资产树按 Pages、Dialogs、Drawers、Datasets、Resources 分组。Designer 只编辑当前 SurfaceGraph，不拥有项目导航。

- Page：在响应式 viewport 中编辑。
- Dialog：在居中真实尺寸壳中编辑。
- Drawer：在贴边真实尺寸壳中编辑。
- 从资产树打开：重置为资产定位面包屑。
- 从交互入口打开：保留调用路径；可将前一 Surface 显示为只读背景。
- Design mode：只编辑当前 Surface，不执行主要 UI 动作。
- Experience mode：真实运行页面历史、浮层栈、校验、表达式和本地数据视图。

Inspector 由 `properties`、`validation`、`interaction` 三个区域组成。页面级 Interaction Overview 用于搜索规则、查看引用和诊断，不提供流程图。

## 6. 包边界

```text
core                     JSON / expression / pure dataset and interaction reducers
  ^
headless                 form values / validation / field state
  ^
runtime                  Vue form and component rendering

model -> compiler -> canonical IR -> vue-backend
  ^                                      |
  |                                      v
designer + adapters             prototype-runtime (planned)
  ^                                      ^
  |                                      |
Studio ----------------------------------+
  |
Source generator/viewer
```

独立的 Prototype Runtime 是目标公共边界，负责页面历史、SurfaceInstance 栈、主要 UI 动作和 overlay host。它由 Studio Experience 与生成项目共享，避免两套体验实现；生产 Runtime、Headless 和 Core 不依赖它。首个合同子任务负责定型包名、纯会话入口与 Vue host 子入口，但不得把该逻辑复制到 Workbench 与生成模板两处，也不得在包存在前把它写成当前 API。

Source 包拆成无 DOM Generator 与异步 Monaco Viewer。Source 拥有同步、只解析组件
import 的 provider-neutral resolver，以及按 projectId/resourceId/contentHash 读取快照
副本的异步 Resource reader 输入合同。Studio 只在应用组合根从 adapter metadata 与
Repository 构造并注入二者；Source 校验 bytes、决定输出路径和 base64，URL 不读取也
不 fetch。Generator 返回 Promise<ContractResult<SourceFileSetV1>>，文件集含 entry 与
稳定排序的 text/binary 文件。Source 不依赖 Designer 或 Workbench。Studio 弹窗拥有
复制、下载、ZIP 和通知等应用命令，Viewer 不拥有这些责任。

## 7. 数据与编译流

```text
ProjectDocument
  -> Model validation/reference index
  -> ProjectCompilation
       surfacesById (each compiled once)
       datasets/resources/theme
       prototype interactions
  -> Vue backend surface artifacts
  -> Prototype Runtime session
  -> Studio Experience / generated project
```

Surface 引用保持 ID，不递归内联目标。这样重复引用和循环打开都不会形成递归编译、递归持久化或递归源码生成。

## 8. 持久化与传输

- Repository 将 Surface、Dataset、Resource 作为独立实体追踪 revision。
- Project manifest 保存顺序、home、registry lock、theme 和 settings。
- IndexedDB 自动保存并显示保存状态；失败不能伪装成功。
- 完整项目、单 Dataset 和静态 Resource 使用各自版本化 envelope；完整项目 envelope
  组合 metadata-only ProjectDocument 与 embedded content，并在导入时原子提交二者。
- 原始对象数组只通过显式 raw rows ingestion 创建当前 Dataset；版本化 envelope reader 不接受缺失版本，二者不是兼容读分支。
- 单 Surface 传输若保留外部引用，必须携带依赖闭包或在导入时显式重绑定，不能制造悬空 ID。
- 跨资产导入先建立项目级 Surface、node、field、Dataset 和 Resource ID 映射，再通过安全 AST 重写结构化引用；无法无损重写的表达式必须 fail closed，禁止字符串替换。

## 9. 版本与兼容

ProjectDocument、SurfaceGraph、Repository entity、transfer、Canonical IR、Compiler、Runtime Host 和 Source generator 在拥有子任务内原子升版。所有 reader 只接受精确当前版本，旧、未来、缺失和混合合同 fail closed。

不提供 pages/surfaces 双读、旧事件兼容、迁移器、deprecated wrapper 或联合 peer range。公开破坏性变化使用 pre-1.0 minor Changeset，并同步消费包。

## 10. 风险控制

| 风险 | 控制 |
| --- | --- |
| Studio 交互重新演变为 Flow | 封闭语义动作、单一主要动作、无原始事件和动作链 |
| Runtime 被 Demo 逻辑污染 | 独立 `@moluoxixi/config-form-prototype-runtime`，保持依赖单向 |
| 循环 Surface 引用导致递归生成 | ID 资产表，每个 Surface 只编译/生成一次 |
| 重复打开资产状态串扰 | instanceId 为运行身份，surfaceId 仅指定义 |
| Dataset 与远程 Data Source 混用 | 独立类型、UI 和运行合同 |
| UI 设计能力退化为自由网页搭建 | 真实 Grid/Flex、受控样式、业务物料范围 |
| Preview 与 Source 漂移 | 共用编译结果和 Prototype Runtime 合同，双端 parity 测试 |
| Dataset 视图逻辑在物料和编辑器重复 | Dataset 层拥有纯查询/投影，Materials 只消费结果 |
| Source 反向依赖 Designer adapter/Repository | provider resolver 与异步 resource reader 由组合根分别注入 |

## 11. 回滚边界

每个子任务独立提交和发布，但 Page-only 到 Surface 合同的单个子任务内部必须原子完成，不能提交可被应用加载的半转换状态。若某阶段失败，回滚该子任务全部提交；不通过临时兼容层维持中间状态。
