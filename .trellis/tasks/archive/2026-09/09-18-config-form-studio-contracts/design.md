# ConfigForm Studio 产品与领域合同设计

## 1. 目标与状态表达

本任务只固化产品、领域、依赖、版本和验证合同，不实现 Model、Compiler、Runtime、Studio UI 或 Source 包。

长期文档必须同时表达两类事实：

- **目标合同**：ConfigForm Studio 是本地优先的高保真业务界面 Demo 创作应用；Designer 编辑单个 Surface；Runtime/Headless 继续服务生产代码；Source 单向交付可运行 Demo 源码。
- **当前实现**：仓库仍是 Page-only ProjectDocument、双区 Designer、Workbench 内置 Preview/Source 与动态 Data Source 作者 UI。规划中的 Surface、Prototype Runtime 和独立 Source 包不得写成已经可用。

`PRODUCT.md` 负责目标产品合同，`ROADMAP.md` 负责当前基线、迁移阶段和完成定义；包 README 只陈述该包当前已经实现的 API，并链接目标合同。

## 2. 领域术语与所有权

| 概念 | 合同 | 所有者 |
| --- | --- | --- |
| Material | 可创建节点的组件类型、setter 和语义能力 | Designer adapter Registry |
| SurfaceAsset | 项目内可持久化、引用和编译的 Page/Dialog/Drawer 定义 | Model |
| SurfaceInstance | 某个 SurfaceAsset 在体验会话中的一次独立运行实例 | Prototype Runtime |
| Dataset | 项目级、运行期只读的 JSON 对象数组 | Model / Dataset services |
| Runtime Data Source | HTTP、缓存、取消与宿主数据接入 | Runtime 代码态能力 |
| Prototype Interaction | JSON-safe 状态表达式、值动作与单一主要 UI 动作 | Core/Model 合同，Prototype Runtime 执行 |
| Business Handler | HTTP、鉴权、异步副作用和复杂业务函数 | 导出后的宿主 Vue/TypeScript |

`SurfaceAsset` 不是 Material，`SurfaceInstance` 不是持久化资产，Dataset 也不复用 Runtime Data Source。三组身份必须使用不同类型和引用字段。

## 3. 目标签名

### 3.1 Surface 与实例

```ts
type SurfaceKind = 'page' | 'dialog' | 'drawer'

type ProjectSurface =
  | ProjectPageSurface
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

interface SurfaceInstance {
  instanceId: SurfaceInstanceId
  surfaceId: SurfaceId
  parentInstanceId?: SurfaceInstanceId
  openerNodeId?: NodeId
  parameters: ModelJsonObject
  values: ModelJsonObject
}
```

Page 独有 `route`；Dialog/Drawer 独有判别式 `presentation`，其中显式保存标题、
响应式尺寸/方向、遮罩与 ESC、mask、关闭按钮策略。`homeSurfaceId` 必须指向 Page。
`navigate` 只能指向 Page，`open` 只能指向 Dialog/Drawer。Surface kind 创建后不可
原地转换。Project theme v1、ResponsiveLength、SurfaceNode、Resource transfer 和
Source text/binary 文件的完整 shape 以共享 Studio domain contract 为唯一事实源。

SurfaceGraph 保留 props、form、root/slot placement、field/layout、校验、extensions
与 valueScope，并新增不伪造表单 field 的 element 节点。目标 Reader 严格拒绝旧
`bindings/conditions/reactions/runtime/optionSource`。Surface Foundation 原子升级
Registry snapshot v3 的类型、版本、Reader 校验并迁移现有基础物料条目；v3 以
Material kind、语义 trigger、state projection property allowlist、Dataset/Resource
capability 约束节点上的 `datasetBindings/resourceBindings`，不允许任意 props 隐藏
资产引用。Studio Materials 只扩充物料条目、编辑 UI 和 adapter 映射，不再次升版或
发明第二套能力合同。

`surfaceOrder` 必须非空且至少包含一个 Page；Dataset 集合允许 order/map 同时为空。
两组 order/map 都必须双向一致且 map key 等于实体 ID，Page route 必须以 `/` 开头且
项目内唯一。Dialog/Drawer 在 `mask: false` 时必须同时 `close.mask: false`。

### 3.2 Dataset 视图

```ts
interface DatasetReference<TProjection extends DatasetProjection> {
  datasetId: DatasetId
  projection: TProjection
}

interface DatasetViewQuery {
  filter?: SafeExpression
  sort?: readonly DatasetSortRule[]
  page?: { index: number; size: number }
}

interface DatasetViewResult<T> {
  items: readonly T[]
  total: number
}
```

Dataset 层拥有对象数组校验、字段路径读取、projection、filter、sort 和 pagination 的确定性纯运算。Materials 层只拥有组件渲染、选择状态、视觉与语义激活器。Select/Table/List 不得各自实现查询器。

options projection 的 valuePath 必须逐行解析为唯一 `string | number`；missing、重复、
null、boolean、object 或 array 均以 `dataset_projection_invalid` 阻止 Experience/Source。

### 3.3 Resource 与项目传输

embedded Resource metadata 单独保存稳定 `fileName`、byteLength 与
`sha256:<64 lowercase hex>` contentHash；bytes 由 Repository 按内容版本持有。单
Resource transfer v1 使用 canonical base64，URL 不携带 content。完整项目 JSON 使用
Project transfer v1，包含 ProjectDocument 和每个 embedded Resource 恰好一份 bytes；
URL 为零份。Reader 在一次成功前校验 ID 双射、base64、长度、hash 和预算，metadata
与 bytes 原子导入。

### 3.4 Prototype Interaction

```ts
type PrototypeInteraction =
  | StateProjectionRule
  | ValueChangeRule
  | PrimaryUiActionBinding

type PrimaryUiAction =
  | NavigateAction
  | BackAction
  | OpenSurfaceAction
  | CloseCurrentAction
  | CloseAllAction
```

- `StateProjectionRule` 持续计算 `visible/disabled/readonly/required` 和 Material 白名单展示属性，初始化时执行。
- `ValueChangeRule` 只包含 `set/copy/clear`，在依赖字段发生用户输入或结果事务变化后执行，初始化时不执行。
- 一个语义触发器最多绑定一个 `PrimaryUiAction`。它只能由用户激活触发，不从 DOM 事件名、函数名或动作链推导。
- 表达式使用安全 AST 和白名单纯函数。赋值、任意 JavaScript、HTTP、延时、重试、并行和 Flow 全部禁止。

Safe Expression v1 只读 own property，拒绝 prototype 路径与 JS coercion；missing 只可
由 coalesce 吸收，condition/state 必须为 boolean，比较与算术类型严格且结果有限，
AST 最多 256 节点/32 深度。相同 state target 只能有一条规则并覆盖静态 baseline；
多个 value rule 写同一 target 时给 warning，按 interactions 声明顺序执行并 last write
wins。

生产 Runtime 的 `props.onX` 仍是工程师内存态函数，与 Prototype Interaction 不互转、不序列化、不经 iframe RPC 转发。

### 3.5 Source resolver

规划中的 `@moluoxixi/config-form-source` 拥有分离的 provider-neutral component
resolver 与 async Resource reader 输入类型：

```ts
interface SourceProviderResolver {
  readonly adapter: SourceAdapterIdentity
  resolveComponent(
    request: {
      componentKey: ComponentKey
      contractVersion: string
      contractFingerprint: string
    },
  ): SourceResolutionResult<SourceComponentResolution>
}

interface SourceResourceReader {
  readEmbedded(request: {
    projectId: ProjectId
    resourceId: ResourceId
    contentHash: string
  }): Promise<ContractResult<Uint8Array>>
}

interface GenerateConfigFormSourceInput {
  compilation: ProjectCompilation
  providerResolver: SourceProviderResolver
  resourceReader: SourceResourceReader
}

generateConfigFormSource(
  input: GenerateConfigFormSourceInput,
): Promise<ContractResult<SourceFileSetV1>>
```

`SourceAdapterIdentity` 使用 adapter/adapterVersion/registryFingerprint，全部投影自
`registryLock`；组件 request 同时携带 contractVersion/contractFingerprint。
Studio 只在应用组合根读取 adapter metadata 与 Repository 并注入两个实现。Provider
resolver 同步且只解析组件/import；resource reader 异步返回 exact hashed bytes 副本。
Source 自己校验 length/hash、派生安全路径和 canonical base64；URL 不调用 reader、
不 fetch。`SourceFileSetV1` 明确 entry 与稳定排序的 text/binary files。Source generator
不导入 Designer、Workbench、具体 provider UI、Repository 或 DOM；Viewer 不拥有复制、
下载、ZIP、通知和持久化。

## 4. Prototype Runtime 边界

共享会话能力定型为规划包 `@moluoxixi/config-form-prototype-runtime`，目标路径 `packages/ConfigForm/prototype-runtime`：

- 根入口和 `/session`：无 DOM 的页面历史、overlay instance 栈、参数/结果事务和主要 UI 动作 reducer。
- `/vue` 与 `/vue/style`：Vue Surface host、Dialog/Drawer overlay host、焦点和遮罩集成。
- Studio Experience 与生成项目共同消费这些入口。
- Core、Headless 和生产 Runtime 不依赖该包；该包不拥有 Designer 作者 UI、Source generation 或 HTTP。

合同任务只记录该目标边界，不创建空包、占位导出或 package manifest。Surface foundation 子任务在有真实实现时创建它。

## 5. 依赖方向

```text
Core <- Headless <- Runtime <- UI adapters

Model -> Compiler -> Canonical IR -> Vue Backend -> Runtime
  ^                                      |
  |                                      v
Designer                         Prototype Runtime
  ^                                      ^
  |                                      |
Studio ----------------------------------+
  |
Source generator/viewer
```

- Studio 是 private 应用组合根，可以依赖公开作者、编译、运行和 Source 包。
- Source generator 只依赖稳定 compilation、resolver 类型和纯数据；Viewer 的 Vue/Monaco 依赖必须隔离在 `/viewer`。
- Prototype Runtime 可以消费当前编译/运行合同；生产 Runtime 不反向依赖 Prototype Runtime。
- Designer 不依赖 Studio、Source 或具体 UI runtime adapter。

## 6. 版本表与硬切规则

合同规范固定最终目标身份；各后续子任务按所有权一次性实现，不得在同一 Reader 中双读：

| 合同 | 当前基线 | 目标身份 | 所属子任务 |
| --- | --- | --- | --- |
| ProjectDocument | `5` | `6` | surface-foundation |
| PageGraph / SurfaceGraph | `PageGraph 3` | `SurfaceGraph 1` | surface-foundation |
| Project theme | 不存在 | `1` | surface-foundation（studio-materials 只消费，不扩宽 shape） |
| Registry snapshot | `2` | `3` | surface-foundation（studio-materials 只扩充条目和作者映射） |
| Canonical Project IR | `4` | `5` | surface-foundation |
| Compiler | `5.0.0` | `6.0.0` | surface-foundation |
| IndexedDB manifest/entity codec | `3` | `4` | surface-foundation |
| Page transfer / Surface transfer | `Page 2` | `Surface 1` | surface-foundation |
| Runtime Host protocol | `6` | `7` | surface-foundation |
| Workbench export generator | `4.0.0` | `5.0.0` | surface-foundation（source-package 仅迁移所有权） |
| Project transfer | 不存在 | `1` | surface-foundation（studio-datasets 提供 embedded content） |
| Dataset transfer | 不存在 | `1` | studio-datasets |
| Resource transfer | 不存在 | `1` | studio-datasets |
| Prototype session | 不存在 | `1` | surface-foundation |
| SourceFileSet | 不存在 | `1` | source-package |

目标数值表示最终合同，不授权多个子任务在同一常量上重复升版。首个拥有该 Reader 的实现子任务建立完整目标 shape；后续任务若必须再次改变 shape，需要回到合同审阅，不自行追加版本。

所有 lower、higher、missing、malformed 和 mixed version 均 fail closed。删除 `pagesById/pageOrder`、旧事件域或旧导出入口时不提供迁移器、兼容别名、deprecated wrapper、双模型或联合 peer range。

显式的 raw rows ingestion 不是 Reader 兼容分支：它只接受 JSON 对象数组并创建当前 Dataset v1；Dataset envelope reader 仍要求精确版本，向其传入无版本数组必须失败。

## 7. 诊断合同

规范至少固定下列稳定 code 与必要 context，展示文案可以本地化：

| Code | 必要 context | 结果 |
| --- | --- | --- |
| `unsupported_contract_version` | contract、expected、received | 拒绝读取 |
| `project_structure_invalid` | projectId、path、reason | 拒绝项目保存/导入/编译 |
| `surface_graph_invalid` | surfaceId、path、reason | 拒绝 Surface 保存/导入/编译 |
| `surface_presentation_invalid` | surfaceId、path、reason | 拒绝 Surface 保存/导入/编译 |
| `project_theme_invalid` | projectId、path、reason | 拒绝项目保存/导入/编译 |
| `invalid_surface_reference` | sourceSurfaceId、nodeId、targetSurfaceId | 拒绝保存/编译 |
| `invalid_surface_kind` | surfaceId、expectedKinds、receivedKind | 拒绝动作或 home |
| `surface_in_use` | surfaceId、references | 阻止删除 |
| `surface_parameter_invalid` | targetSurfaceId、parameterName、reason | 会话变更前拒绝动作 |
| `surface_result_invalid` | surfaceId、resultName、reason | 拒绝关闭/结果事务 |
| `dataset_rows_invalid` | datasetId、path、reason | 拒绝原始创建/导入 |
| `dataset_reference_invalid` | datasetId、surfaceId、nodeId、reason | 拒绝保存/编译/删除 |
| `dataset_projection_invalid` | datasetId、nodeId、path、reason | 阻止 Experience 与 Source |
| `resource_reference_invalid` | resourceId、surfaceId、nodeId、reason | 拒绝保存/编译/删除 |
| `resource_content_invalid` | resourceId、path、reason | 拒绝传输/生成 |
| `interaction_expression_invalid` | surfaceId、ruleId、location | 保留草稿、暂停规则并阻止 Experience/Source |
| `interaction_trigger_invalid` | surfaceId、nodeId、trigger | 拒绝绑定 |
| `interaction_target_conflict` | surfaceId、target、ruleIds | 拒绝重复状态目标 |
| `interaction_write_conflict` | surfaceId、targetFieldId、ruleIds | 保持确定顺序并警告作者 |
| `interaction_cycle` | surfaceId、ruleIds、fieldIds | 中止值事务 |
| `prototype_instance_not_found` | instanceId、action | 不改变会话 |
| `prototype_action_invalid` | instanceId、action、reason | 不改变会话 |
| `source_resolution_failed` | adapter、componentKey、reason | 中止生成 |
| `source_resource_read_failed` | projectId、resourceId、contentHash、reason | 中止生成 |

诊断顺序必须确定，不能用异常字符串作为跨包判断条件。

## 8. 文档与规范落点

本任务实施时：

- 重写 `packages/ConfigForm/PRODUCT.md` 与 `ROADMAP.md`。
- 更新仓库根 README、ConfigForm 架构 README、Designer/Workbench README；Headless 和两个 Designer adapter 只修正定位或 Data Source/Dataset 边界。
- 保留 Model/Compiler/Vue backend 当前 Page-only README 的事实表述，等 surface-foundation 原子实现时更新。
- 重写 `.trellis/spec/config-form/frontend/product-boundaries.md`，新增 `studio-domain-contracts.md`，并更新相关 package spec index 与架构/Workbench 质量合同。
- 可为规划中的 Prototype Runtime 和 Source 建立明确标注“目标合同、实现尚不存在”的 spec 路由，但不得创建空产品包。

## 9. 取舍与回滚

- 选择独立 Prototype Runtime，增加一个真实公共包，但消除 Studio Preview 与生成项目两套会话/浮层实现。
- 选择 Dataset 纯查询层，避免 adapter 行为漂移，但 selection 仍留在物料层以免污染数据资产。
- 选择 Source-owned provider resolver 与异步 resource reader input，使 generator 可独立
  使用且不隐式闭包 Repository；代价是 Studio 组合根必须显式适配 provider metadata
  与 storage。
- 本任务只改文档和 spec，可按一个提交整体回滚。后续硬切失败时回滚对应子任务全部提交，不添加临时兼容 Reader。
