# Surface Foundation 技术设计

## 1. 目标与约束

本任务把当前 Page-only 工程一次性切换到已审阅的 Surface 领域合同，并建立后续
Studio Assets、Datasets、Materials、Interactions 与 Source 共同依赖的稳定基础。

必须同时满足以下不变量：

- 只接受 ProjectDocument v6、SurfaceGraph v1、Registry snapshot v3、Canonical IR
  v5、Compiler 6.0.0、IndexedDB codec v4、Surface transfer v1、Runtime Host v7、
  Workbench generator 5.0.0、Project transfer v1 和 Prototype session v1。
- 不保留 Page/Surface 双读、旧字段 alias、迁移器、deprecated wrapper 或联合版本。
- SurfaceAsset 是持久化和编译身份；SurfaceInstance 是会话运行身份，两者不得共用
  缓存或状态 key。
- Core、Headless 和生产 Runtime 不依赖 Workbench、Designer、Prototype Runtime 或
  Source；Prototype Runtime 的根入口与 `/session` 不触碰 DOM。
- 本任务只建立领域、持久化、编译、公共会话和必要的现有 Workbench 适配，不实现
  Studio 资产管理 UI、Dataset 编辑器、扩展物料、Interaction Inspector 或 Source 包
  物理抽离。

## 2. 版本与原子切换面

| 合同 | 当前 | 目标 | Owner |
| --- | --- | --- | --- |
| ProjectDocument | 5 | 6 | Model |
| PageGraph / SurfaceGraph | PageGraph 3 | SurfaceGraph 1 | Model |
| Registry snapshot | 2 | 3 | Model / Designer projection |
| Canonical Project IR | 4 | 5 | Compiler |
| Compiler | 5.0.0 | 6.0.0 | Compiler |
| IndexedDB manifest/entity codec | 3 | 4 | Workbench persistence |
| Recovery Draft | 1 | 2 | Workbench persistence |
| Page / Surface transfer | Page 2 | Surface 1 | Workbench import |
| Project transfer | absent | 1 | Model / Workbench import |
| Runtime Host | 6 | 7 | Workbench runtime host |
| Workbench generator | 4.0.0 | 5.0.0 | Workbench export |
| Prototype session | absent | 1 | Prototype Runtime |

Reader 和 writer 必须在同一任务中切到目标版本。测试夹具直接重写为当前合同；旧版本
只作为 rejection fixture 存在。

## 3. 包边界与依赖方向

```text
core
  ^
headless <- runtime

model -> compiler -> vue-backend
  ^          ^            ^
  |          |            |
designer     +----- prototype-runtime/session
                          |
                          +-- prototype-runtime/vue -> runtime + vue-backend

workbench composition root -> model/compiler/vue-backend/prototype-runtime
```

- Model 拥有持久化类型、Reader、引用索引、事务、history 与 Repository port。
- Compiler 拥有 Surface 级 Canonical IR、ProjectCompilation 与增量缓存。
- Vue backend 只把 `SurfaceCompilation` 编译成无实例状态的 renderer artifact。
- Prototype Runtime `/session` 拥有纯会话 reducer；`/vue` 拥有实例挂载、overlay 和
  focus effect 执行。
- Workbench 只在组合根连接 Repository、Compiler、Host 和临时 generator。
- 生产 Runtime 保留表单状态、校验、Data Source 和直接 `props.onX` listener；不接收
  页面历史或 overlay 栈。

## 4. Model 公共合同

### 4.1 Project、Surface 与节点

公共类型严格采用 `studio-domain-contracts.md` 的最终形状：

- `ProjectDocumentV6` 使用 `homeSurfaceId/surfaceOrder/surfacesById`，并包含空集合也
  必须显式存在的 `datasetOrder/datasetsById/resources/theme`。
- `ProjectSurface` 是 Page/Dialog/Drawer 判别联合；kind 创建后不可原地修改。
- `SurfaceGraphV1` 保留 props、form、root/slot placement、validation、extensions 和
  valueScope，节点为 field/layout/element。
- 删除持久化 `bindings/conditions/reactions/runtime/optionSource`，strict Reader 对这些
  key fail closed。
- `ProjectThemeV1` 与 `ResponsiveLength` 在本任务完整实现，Materials 只能消费和投影。

所有 ID 类型保持语义区分，即使底层仍为 string，也不得用一个通用 AssetId 替代
SurfaceId、DatasetId、ResourceId、NodeId 和 SurfaceInstanceId。

### 4.2 Registry snapshot v3

`ComponentContract.kind` 扩展为 `field | layout | element`，并加入：

```ts
interface MaterialCapabilitiesV3 {
  kind: MaterialNodeKind
  semanticTriggers: readonly MaterialSemanticTrigger[]
  stateProjectionProperties: readonly (readonly string[])[]
  datasetBindings: readonly MaterialDatasetBindingCapability[]
  resourceBindings: readonly MaterialResourceBindingCapability[]
}
```

现有基础物料通过 Designer 的集中 Registry projection 生成 v3 contract。Fingerprint
必须覆盖全部 capability 字段并保持稳定排序；不能仅提升版本常量或由两个 adapter
各自补默认值。Surface Reader 使用 v3 capability 校验 node kind、trigger 与命名绑定。

### 4.3 引用索引与诊断

Model 提供单一纯引用 walker，覆盖：

- home Surface；
- graph Dataset/Resource bindings；
- Prototype Interaction 的 Surface、node、field、Dataset 与 result mapping 引用；
- parameters、outputs 和安全表达式 AST 中的结构化引用。

Reader、删除命令、import remap 和 Compiler 共用该 walker。诊断使用长期规范中的稳定
code/context，并按 surface order、graph order、interaction order 确定性排序。

### 4.4 事务、history 与 change set

旧 `page.*` operation 全部替换为 Surface 语义，node operation 使用 `surfaceId`。
Dataset 与 Resource metadata 也是一等事务对象。目标 change set 为：

```ts
interface ProjectChangeSet {
  project: boolean
  surfaceIds: readonly SurfaceId[]
  datasetIds: readonly DatasetId[]
  resourceIds: readonly ResourceId[]
  nodeChanges: readonly ProjectNodeChange[]
}

interface ProjectNodeChange {
  surfaceId: SurfaceId
  nodeId: NodeId
  kind: 'content' | 'insert' | 'move' | 'remove'
  before?: ProjectNodeRelation
  after?: ProjectNodeRelation
}
```

继续复用现有“一次 Immer draft 应用全部 operation -> 统一验证 -> 失败返回原文档”的
事务内核。inverse、merge、undo/redo、recovery summary 和 compiler invalidation 同步消费
新 change set，不保留全局 `nodeIds` 作为第二事实源。

Foundation 为 Dataset 提供资产 add/remove/move/copy/rename，以及
`replaceRows/setDefaultProjection` 等通用 Model operation、inverse/history、change set 和
Repository primitive，借此满足项目文档事务完整性。JSON 文件 ingestion、Dataset transfer、
导入冲突策略、query/projection service、Options “保存为数据集”编排和作者 UI 仍由
studio-datasets 子任务拥有；Foundation 不实现这些产品流程。

## 5. Repository 与 embedded bytes

### 5.1 公共 port

ProjectDocument 只保存 Resource metadata。Repository 增加以下最终能力：

```ts
interface ProjectEmbeddedResourceWrite {
  resourceId: ResourceId
  contentHash: string
  bytes: Uint8Array
}

interface ProjectEmbeddedResourceRead {
  projectId: ProjectId
  resourceId: ResourceId
  contentHash: string
}

interface ProjectRepositoryCreateInput {
  document: ProjectDocumentV6
  embeddedContents: readonly ProjectEmbeddedResourceWrite[]
  seed?: ProjectRepositorySeed
}

interface ProjectRepositoryCommitInput {
  commandId: string
  document: ProjectDocumentV6
  embeddedWrites?: readonly ProjectEmbeddedResourceWrite[]
  expectedRepositoryRevision: number
  id: ProjectId
  metadata: ProjectCommitMetadata
}

interface ProjectRepository {
  // existing project/version methods use the v6 types
  readEmbedded(input: ProjectEmbeddedResourceRead): Promise<Uint8Array | undefined>
}
```

`create.embeddedContents` 必须与 document 中全部 embedded Resource 精确双射。
`commit.embeddedWrites` 只携带新增或替换的 hash；提交前，Repository 必须证明新文档的
每个 embedded Resource 都能由 staged write 或现有精确 hash record 满足。重复、额外、
URL bytes、length/hash 不符或缺失全部拒绝。

所有输入 bytes 在进入 Repository 时复制，`readEmbedded` 每次返回新副本。metadata、
entity 与 staged bytes 在同一 Memory transaction / IndexedDB `updateItems` transaction 中
原子提交。byte key 固定包含 `projectId + resourceId + contentHash`。

Repository bytes 的失败码固定如下：staged write 重复、额外、指向 URL Resource、与
metadata 的 hash/length 不符，或新 document 的 embedded Resource 没有 staged/existing
精确 hash 可满足时，抛出 `PROJECT_REPOSITORY_INVALID_COMMIT`；已发布 snapshot 声明必须
存在的 byte record 缺失或损坏时，抛出 `PROJECT_REPOSITORY_CORRUPT`。`readEmbedded` 只有在
精确三元组不存在且没有已发布 snapshot 声明它必须存在时才返回 `undefined`，record 存在
但 identity、length 或 hash 损坏必须抛错。CAS conflict、receipt replay 失败或 storage
异常都不得留下 staged bytes。

旧 hash 不在普通 commit 后立即删除。正式 Repository prune 根据 current snapshot、保留
versions 和 commit receipts 计算 metadata 与 byte reachability；Recovery Draft 使用下述
独立 byte namespace，不作为正式 record 的 root。删除项目时删除该项目全部正式 byte
records。

### 5.2 Entity revisions

```ts
interface ProjectEntityRevisions {
  manifest: number
  surfaces: Record<SurfaceId, number>
  datasets: Record<DatasetId, number>
  resources: Record<ResourceId, number>
}
```

Theme、settings、orders、home 和 Registry lock 属于 manifest。Surface、Dataset、Resource
metadata 独立推进 revision；bytes hash 不建立第二套可见 revision。

## 6. IndexedDB codec v4 与 Recovery Draft v2

Codec v4 使用 `surface:`、`dataset:`、`resource:` 与 `resource-bytes:` key，manifest
引用三类 entity map。v3 manifest/entity/key 一律拒绝，不迁移。

Recovery Draft 外层版本升为 2，公共输入/输出和存储 wire 固定为：

```ts
interface ProjectRecoveryDraftCaptureV2 {
  version: 2
  baseRepositoryRevision: number
  changeSet: ProjectChangeSet
  contentHash: string
  document: Readonly<ProjectDocumentV6>
  draftId: string
  editVersion: number
  embeddedContents: readonly ProjectEmbeddedResourceWrite[]
  projectId: ProjectId
  registryLock: RegistryLock
  sessionId: string
}

interface ProjectRecoveryDraftV2
  extends Omit<ProjectRecoveryDraftCaptureV2, 'document' | 'embeddedContents'> {
  checksum: string
  createdAt: string
  document: ProjectDocumentV6
  embeddedContents: readonly ProjectEmbeddedResourceWrite[]
  updatedAt: string
}

interface ProjectRecoveryDraftStoreV2 {
  put(input: ProjectRecoveryDraftCaptureV2): Promise<ProjectRecoveryDraftSummary>
  get(draftId: string): Promise<ProjectRecoveryDraftV2 | undefined>
  list(projectId?: ProjectId): Promise<readonly ProjectRecoveryDraftSummary[]>
  delete(draftId: string): Promise<void>
  close(): void
}

interface StoredRecoveryDraftByteReferenceV2 {
  resourceId: ResourceId
  contentHash: string
  byteLength: number
  key: string
}

interface StoredRecoveryDraftManifestV2 {
  version: 2
  baseRepositoryRevision: number
  changeSet: ProjectChangeSet
  checksum: string
  contentHash: string
  createdAt: string
  draftId: string
  editVersion: number
  embeddedResources: readonly StoredRecoveryDraftByteReferenceV2[]
  projectId: ProjectId
  registryLock: RegistryLock
  sessionId: string
  snapshot: StoredProjectSnapshotManifestV4
  updatedAt: string
}

interface StoredRecoveryDraftBytesV2 {
  kind: 'resource-bytes'
  version: 2
  projectId: ProjectId
  draftId: string
  resourceId: ResourceId
  contentHash: string
  byteLength: number
  bytes: Uint8Array
}
```

draft byte key 固定为
`project-recovery-draft:<projectId>:<draftId>:resource-bytes:<resourceId>:<contentHash>`；
manifest 中的 `embeddedResources` 按 `resourceId` 排序并精确引用这些 key，manifest checksum
覆盖 snapshot 与完整 byte references，raw bytes 由 metadata `contentHash` 校验。

`put` 在任何写入前验证 document/identity/Registry/change set，并要求
`embeddedContents` 与 draft document 的全部 embedded Resource 精确双射；重复、额外、
缺失、URL bytes 或 hash/length 不符全部拒绝。transfer 的导入导出预算不限制内部 recovery
snapshot；manifest、entities、byte records 与旧 draft 不再可达的 records 在同一次
`updateItems` transaction 中原子替换。`get` 严格解析 v2、重新校验双射/hash/length 并为
每条 bytes 返回全新副本；精确 draft 不存在返回 `undefined`，存在但损坏抛
`PROJECT_REPOSITORY_CORRUPT`。restore 把 document 与 returned bytes 一次交给 Repository，
失败不发布任何 metadata/bytes。

Recovery Draft 持有独立于 Repository 正式 byte namespace 的完整副本，因此正式
repository prune 不把 draft 当作正式 byte record 的 reachability root。draft delete 删除
其 manifest/entities/bytes；project delete 编排同时删除该项目的正式 Repository namespace
和全部 draft namespace。draft v1、缺失/未来/混合版本全部 fail closed。

## 7. Transfer 与 import

### 7.1 Project transfer v1

唯一完整项目导入格式是长期合同已定义的：

```ts
interface ProjectTransferEnvelopeV1 {
  kind: 'config-form-project'
  version: 1
  document: ProjectDocumentV6
  embeddedContents: readonly {
    resourceId: ResourceId
    content: { encoding: 'base64', data: string }
  }[]
}

interface ProjectTransferReadResultV1 {
  document: ProjectDocumentV6
  embeddedBytesByResourceId: Readonly<Record<ResourceId, Uint8Array>>
}

interface ProjectTransferWriteInputV1 {
  document: Readonly<ProjectDocumentV6>
  readEmbedded(input: ProjectEmbeddedResourceRead): Promise<Uint8Array | undefined>
}

function readProjectTransfer(
  input: unknown,
): Promise<ContractResult<ProjectTransferReadResultV1>>

function writeProjectTransfer(
  input: ProjectTransferWriteInputV1,
): Promise<ContractResult<ProjectTransferEnvelopeV1>>
```

即使没有 Resource，也必须提供 `embeddedContents: []`。Reader 在任何持久化前完成
canonical base64、length/hash、单资源与总预算、ID 双射和 document 引用校验。
Writer 先 strict-validate document，再按 `resourceId` 升序读取 embedded bytes；URL Resource
不得调用 reader。每次读取都使用 document 的精确 project/resource/hash identity，并先复制、
校验 length/hash 与 10 MiB/256 项/50 MiB 预算，再写 canonical padded base64。无 embedded
Resource 时调用零次 reader 并确定性写出空数组。missing、reject、throw、stale 或损坏 bytes
统一返回 `resource_content_invalid` 且不产生部分 envelope；Reader 成功结果中的 bytes 均为
新副本。Model 拥有唯一 Reader/writer，Workbench 只编排文件与 Repository 原子导入。

### 7.2 Surface transfer v1

Surface transfer 选择“扁平依赖闭包”，不引入首版 rebind 分支：

```ts
interface SurfaceTransferEnvelopeV1 {
  kind: 'config-form-surface'
  version: 1
  rootSurfaceId: SurfaceId
  surfaceOrder: readonly SurfaceId[]
  surfacesById: Readonly<Record<SurfaceId, ProjectSurface>>
  datasetOrder: readonly DatasetId[]
  datasetsById: Readonly<Record<DatasetId, ProjectDataset>>
  resources: Readonly<Record<ResourceId, ProjectResource>>
  embeddedContents: readonly {
    resourceId: ResourceId
    content: { encoding: 'base64', data: string }
  }[]
  registryLock: RegistryLock
}

interface SurfaceTransferReadResultV1 {
  rootSurfaceId: SurfaceId
  surfaceOrder: readonly SurfaceId[]
  surfacesById: Readonly<Record<SurfaceId, ProjectSurface>>
  datasetOrder: readonly DatasetId[]
  datasetsById: Readonly<Record<DatasetId, ProjectDataset>>
  resources: Readonly<Record<ResourceId, ProjectResource>>
  registryLock: RegistryLock
  embeddedBytesByResourceId: Readonly<Record<ResourceId, Uint8Array>>
}

interface SurfaceTransferWriteInputV1 {
  document: Readonly<ProjectDocumentV6>
  rootSurfaceId: SurfaceId
  readEmbedded(input: ProjectEmbeddedResourceRead): Promise<Uint8Array | undefined>
}

function readSurfaceTransfer(
  input: unknown,
): Promise<ContractResult<SurfaceTransferReadResultV1>>

function writeSurfaceTransfer(
  input: SurfaceTransferWriteInputV1,
): Promise<ContractResult<SurfaceTransferEnvelopeV1>>
```

闭包包含 root 通过 interactions、Dataset/Resource bindings 递归可达的全部依赖，并以
flat map 表达循环 Surface 引用。`surfaceOrder` 是源项目顺序在闭包上的稳定子序列，必须
非空、包含 root 且与 `surfacesById` 精确双射；`datasetOrder` 同样是源顺序的稳定子序列
并与 map 双射；所有 map key 必须等于 entity id。Resource key 按 ID 升序写出，
`embeddedContents` 按 `resourceId` 升序写出。

Reader 拒绝缺失依赖、悬空引用、不可达的额外资产、非 canonical base64，以及重复、额外
或缺失 bytes；并复用 Project transfer 的 10 MiB 单资源、256 embedded Resource 和
50 MiB decoded aggregate 上限。成功结果中的每个 `Uint8Array` 都是全新副本。

Registry lock 只包含闭包节点实际使用的 component locks；其 fingerprint 按
adapter/version/排序后的 subset components 重新计算。导入要求目标 Registry 的
adapter/version 相同，且每个 subset component 的 contractVersion/fingerprint 精确匹配，
不要求目标完整 Registry fingerprint 等于 subset fingerprint。

Workbench 只负责文件选择、目标项目检查、ID 分配和 Repository 编排；公共 envelope、
Reader、writer 与闭包验证归 Model。导入先为 Surface、node、field、Dataset、Resource 和
rule 建立完整 ID map，再结构化重写引用并重新验证。目标项目采用自己的 theme/settings；
Page route 与目标项目冲突、adapter/component 不兼容或任一步失败时整次导入失败，不做
自动改 route、一键转换或部分写入。

## 8. Compiler、Canonical IR 与 Vue backend

Compiler 硬切为 Surface 身份：

- `CanonicalSurfaceIR`、`SurfaceCompilation`、`CanonicalSurfaceIdentity`；
- Project IR 使用 `homeSurfaceId/surfaceOrder/surfacesById`，并携带 Dataset、Resource、
  Theme 和 Prototype Interaction 的只读投影；
- coordinator 以 `surfaceId` 和对应 entity revision/semantic hash 缓存；Dataset/Resource
  change set 只失效引用它们的 Surface；
- 每个 Surface 编译一次，open/navigate 只保留 ID，不递归编译依赖；
- draft compilation 不污染 committed cache。

Vue backend 暴露 `compileCanonicalSurfaceRuntime`，输入为 `SurfaceCompilation` 或
`ProjectCompilation + surfaceId`，artifact 只携带 `surfaceId`、kind、presentation、
compilation key 和 renderer。它支持 element node，但不持有 instance/session 状态。

生产 Runtime 只把公共 plan 中残留的 Page 命名切为 Surface 命名；表单值、meta、校验、
生产 Data Source 和 direct listener 行为保持不变。

## 9. Prototype Runtime v1

### 9.1 入口

- package root：框架无关公共类型、版本和 diagnostics。
- `/session`：Reader、初始化、纯 reducer、commands、effects。
- `/vue`：Surface/overlay host。
- `/vue/style`：host 样式。

### 9.2 纯 reducer

Reducer 不访问随机数、时钟、DOM 或 Vue。签名定型为：

```ts
interface PrototypeNodeAddressV1 {
  nodeId: NodeId
  scope: ConfigFormScopePath
}

interface PrototypeSurfaceTopologyV1 {
  nodeOrder: readonly NodeId[]
  ownerScopeIdByNodeId: Readonly<Record<NodeId, NodeId | null>>
  valueScopes: readonly ConfigFormValueScopeDefinition[]
  scopedFields: readonly ConfigFormScopedFieldDefinition[]
}

interface PrototypeFieldInstanceAddressV1 {
  address: PrototypeNodeAddressV1
  valuePath: readonly (string | number)[]
}

interface PrototypeInstanceRuntimeSnapshotV1 {
  nodeAddresses: readonly PrototypeNodeAddressV1[]
  fieldInstances: readonly PrototypeFieldInstanceAddressV1[]
}

interface PrototypeSurfaceContractBaseV1 {
  id: SurfaceId
  initialValues: Readonly<ModelJsonObject>
  parameters: readonly SurfaceParameterDefinition[]
  outputs: readonly SurfaceOutputDefinition[]
  interactions: readonly PrototypeInteraction[]
  topology: PrototypeSurfaceTopologyV1
}

type PrototypeSurfaceContractV1 =
  | (PrototypeSurfaceContractBaseV1 & {
      kind: 'page'
      route: string
    })
  | (PrototypeSurfaceContractBaseV1 & {
      kind: 'dialog'
      presentation: ProjectDialogSurface['presentation']
    })
  | (PrototypeSurfaceContractBaseV1 & {
      kind: 'drawer'
      presentation: ProjectDrawerSurface['presentation']
    })

interface PrototypeProjectContextV1 {
  version: 1
  projectId: ProjectId
  homeSurfaceId: SurfaceId
  surfacesById: Readonly<Record<SurfaceId, PrototypeSurfaceContractV1>>
}

interface PrototypeNodeProjectionV1 {
  address: PrototypeNodeAddressV1
  states: Readonly<Partial<Record<
    'visible' | 'disabled' | 'readonly' | 'required',
    boolean
  >>>
  properties: readonly {
    path: readonly string[]
    value: ModelJsonValue
  }[]
}

type PrototypeInstanceProjectionV1 = readonly PrototypeNodeProjectionV1[]

interface SurfaceInstanceV1 {
  instanceId: SurfaceInstanceId
  surfaceId: SurfaceId
  parentInstanceId?: SurfaceInstanceId
  openerAddress?: PrototypeNodeAddressV1
  openerInteractionId?: InteractionRuleId
  parameters: Readonly<ModelJsonObject>
  values: ModelJsonObject
  runtime: PrototypeInstanceRuntimeSnapshotV1
  projection: PrototypeInstanceProjectionV1
}

interface PrototypeSessionV1 {
  version: 1
  projectId: ProjectId
  pageHistory: readonly SurfaceInstanceId[]
  overlayStack: readonly SurfaceInstanceId[]
  instancesById: Readonly<Record<SurfaceInstanceId, SurfaceInstanceV1>>
}

type PrototypeSessionCommand =
  | {
      type: 'instance.valuesChanged'
      instanceId: SurfaceInstanceId
      values: ModelJsonObject
      runtime: PrototypeInstanceRuntimeSnapshotV1
      originScope: ConfigFormScopePath
      changedAddresses: readonly PrototypeNodeAddressV1[]
    }
  | {
      type: 'interaction.activate'
      sourceInstanceId: SurfaceInstanceId
      sourceAddress: PrototypeNodeAddressV1
      interactionId: InteractionRuleId
      nextInstance?: {
        instanceId: SurfaceInstanceId
        runtime: PrototypeInstanceRuntimeSnapshotV1
      }
      item?: Readonly<ModelJsonObject>
    }
  | { type: 'history.back' }
  | {
      type: 'overlay.dismiss'
      instanceId: SurfaceInstanceId
      reason: 'escape' | 'mask' | 'button'
    }
  | { type: 'overlay.closeAll' }

type PrototypeSessionEffect =
  | {
      type: 'instance.mount'
      instanceId: SurfaceInstanceId
      surfaceId: SurfaceId
    }
  | {
      type: 'instance.dispose'
      instanceId: SurfaceInstanceId
    }
  | {
      type: 'instance.values.replace'
      instanceId: SurfaceInstanceId
      values: ModelJsonObject
      changedAddresses: readonly PrototypeNodeAddressV1[]
    }
  | {
      type: 'instance.projection.replace'
      instanceId: SurfaceInstanceId
      projection: PrototypeInstanceProjectionV1
    }
  | {
      type: 'focus.restore'
      instanceId: SurfaceInstanceId
      address: PrototypeNodeAddressV1
    }

interface PrototypeTransition {
  session: PrototypeSessionV1
  diagnostics: readonly PrototypeDiagnostic[]
  effects: readonly PrototypeSessionEffect[]
}

function initializePrototypeSession(
  input: {
    projectId: ProjectId
    homeInstance: {
      instanceId: SurfaceInstanceId
      runtime: PrototypeInstanceRuntimeSnapshotV1
    }
  },
  context: PrototypeProjectContextV1,
): PrototypeTransition

function reducePrototypeSession(
  session: PrototypeSessionV1,
  command: PrototypeSessionCommand,
  context: PrototypeProjectContextV1,
): PrototypeTransition
```

Context 是从 ProjectCompilation 投影并经 strict Reader 验证的只读 Surface kind、初始值、
parameters、outputs、presentation、interaction 与编译后 value-scope topology，不让 session
包依赖 Workbench。topology 包含每个 node 的 owner scope、scoped fields、value scopes 和
稳定 node order；map key 必须等于 Surface id，home 必须是 Page，interaction id 在单
Surface 内唯一。

`ConfigFormScopePath` 使用 Core 的 `{scopeId,rowId}` 稳定数组行身份。host 通过 DOM-free
value-scope store 和注入 ID factory，为初始化与每个新实例先构造
`PrototypeInstanceRuntimeSnapshotV1`；snapshot 必须与当前 values/topology 精确一致，包含
所有活 node address、field address 与自然 `valuePath`，地址不得重复。初始化的实例 ID 与
`interaction.activate.nextInstance.instanceId` 都由 host 提供；reducer 只校验非空、唯一、
拓扑和引用，不内部调用 `randomUUID()`。当目标 action 不是 navigate/open 时
`nextInstance` 必须缺失；是 navigate/open 时必须存在且 runtime 必须匹配目标初始 values。

`interaction.activate` 的 `interactionId` 必须属于 live source instance 对应 Surface 的
`PrimaryUiActionBinding`，binding node 必须等于 `sourceAddress.nodeId`，且 address 必须存在于
该实例 runtime snapshot。如果 binding 声明 validation gate，`/vue` host 必须先调用该实例
controller 在 source scope 下的 validation port，只有成功才可 dispatch；失败不产生
command、session 变化或 effect。Reducer 随后从 context 与 source scope 下的 instance
values 解析参数/action，不接受 command 携带任意 target、参数或 result mapping。

`rowActivate/itemActivate` command 必须携带 host 从当前只读 Dataset view 取得并 fresh-clone
的 JSON-safe `item`；`activate/submit` 必须省略它。该 item 只参与本次 activation 的参数与
action expression 求值，不进入 session、SurfaceInstance 或 effect。Project Reader 必须拒绝
在 `onResults`/晚到结果映射中引用 `item`；命名结果只能读取 caller values/parameters 和
本次 `result`，因此不需要也不允许长期捕获 Dataset row。

Safe Expression 的 `values` reference 可选 `selector: 'current' | 'parent' | 'root'`，省略时
等同 `current`；`parent` 从 evaluator 当前 scoped address 去掉最后一级 value scope，root 上的
`parent` 仍解析为 root，`root` 始终使用空 scope。`parameters/result/item` reference 不允许
携带 selector，Project Reader 必须 fail closed。activation/parameter/action 以 source scope、
StateProjectionRule 以各 target address scope、ValueChangeRule 以唯一 origin scope、
ResultAssignment 以 opener scope 作为 evaluator current scope。Reader、纯 reducer 与生成项目
复用同一 evaluator，禁止 Preview、Experience 和 Source 各自解释作用域。

State projection 只由 reducer 计算。`projection` 保存每个实例相对 Material 静态 baseline
的 address-scoped 动态 override；state 值必须是 boolean，property path/value 必须已通过 Registry v3
allowlist 与 JSON-safe 校验。初始化/open/navigate 先建立 values/parameters，再计算
projection，且不执行 value/UI action；`instance.valuesChanged` 和命名结果事务先完成全部
value-rule settle，再对最终 values 重算 projection。任一表达式失败会回滚整个 transition。
每条 StateProjectionRule 对 runtime snapshot 中每个活 target address 分别执行，`values`
读取该 address scope 的局部 view；`item` 与 `result` 均不得出现在 StateProjectionRule 中。

Open 创建 overlay 时把 `parentInstanceId`、`openerAddress` 和
`openerInteractionId` 作为不可分割的三元组保存；Page instance 三项必须全部缺失。
`openerInteractionId` 必须指向 live parent Surface 上 address/trigger/target 均匹配的 open
binding。关闭返回命名结果时按该 interaction id 唯一取得 `onResults`，并以
`openerAddress.scope` 解析 caller target；同一 node 的不同 row/trigger 因而拥有独立结果与
焦点身份。

Reducer 实现 initialize、navigate、back、open、closeCurrent、closeAll、dismiss、参数校验、
命名结果映射、value-change settle 和 caller values 原子提交。`instance.valuesChanged` 携带
host 已验证为 JSON-safe 的完整值、最新 runtime snapshot 与实际 changed addresses；reducer
要求所有 changed address 都是 live field address，并可从唯一 `originScope` 解析；互不相关
的多行变化必须由 host 按发生顺序拆成多个 command。Value rule 以该 origin scope 读取
`values`，按 interaction 声明顺序 settle，并在同一 scope 继续传播内部 writes。
ValueAction/ResultAssignment 的 NodeId 按触发或
opener scope 通过 topology 解析到唯一 field address/valuePath：root target 使用空 scope，
祖先 target 使用匹配前缀，当前/子 scope 缺失或歧义则整次失败。所有失败返回对象同一性
不变的原 session、稳定 diagnostics 和空 effects。成功 transition 中 effects 按数组顺序且
只执行一次；关闭在同一次 transition 中从
history/stack 与 `instancesById` 删除实例。值事务的 effect 顺序固定为 values replace、
projection replace，再执行 dispose/focus；mount effect 读取 session 中已完成的 projection。

Project Reader 要求 ValueChangeRule dependency、copy source、action target 与
ResultAssignment target 都引用 `SurfaceFieldNode`；value-scope owner layout 和 element 不得被
当成隐式可写字段。

### 9.3 Vue host

Vue host 为每个 `instanceId` 创建独立 Renderer/controller state。不可变 Surface artifact
可以按 `surfaceId` 共享；values、validation、focus、parameters 和 result ownership 必须按
`instanceId` 隔离。Dialog/Drawer 支持任意有限嵌套，dismiss policy 只作用于栈顶；effect
执行后恢复仍存活的 opener 焦点。host 是 effect 的唯一执行者；Workbench parent 和 Runtime
Host transport 只接收去除 effects 的会话快照，不得重复执行 mount/dispose/value/focus。

## 10. Runtime Host v7

Host v7 取消所有消息共享 `pageId` 的模型，Design 与 Experience 使用不同 variant；base
固定为：

```ts
interface RuntimeHostMessageBaseV7 {
  channel: typeof RUNTIME_HOST_CHANNEL
  version: 7
  hostId: string
  projectId: ProjectId
  revision: string
  sequence: number
}
```

共享 JSON-safe 表单状态快照和 Experience 出站快照固定为：

```ts
interface RuntimeHostFieldInstanceV7 {
  address: PrototypeNodeAddressV1
  instanceKey: string
  valuePath: readonly (string | number)[]
}

interface RuntimeHostFormStateSnapshotV7 {
  fields: readonly RuntimeHostFieldInstanceV7[]
  touched: readonly string[]
  validation: Readonly<Record<string, readonly string[]>>
  values: ModelJsonObject
}

interface RuntimeHostDesignSyncPayloadV7 {
  adapter: WorkbenchAdapterId
  breakpoint: 'desktop' | 'tablet' | 'mobile'
  candidateId?: string
  candidateUsesFallback?: boolean
  canvasWidth?: number
  compilation: SurfaceCompilation
  locale: string
  namespace?: string
  runtimeSessionKey: string
  runtimeState: RuntimeHostFormStateSnapshotV7
  variant: 'canvas' | 'drag-visual'
}

interface RuntimeHostExperienceSyncPayloadV7 {
  adapter: WorkbenchAdapterId
  compilation: ProjectCompilation
  locale: string
  namespace?: string
  session: PrototypeSessionV1
}

interface PrototypeTransitionSnapshotV1 {
  session: PrototypeSessionV1
  diagnostics: readonly PrototypeDiagnostic[]
}

interface RuntimeHostInstanceStatePayloadV7
  extends RuntimeHostFormStateSnapshotV7 {
  surfaceId: SurfaceId
  stateRevision: number
  focusedAddress?: PrototypeNodeAddressV1
  projection: PrototypeInstanceProjectionV1
}

type ParentToRuntimeHostMessageV7 = RuntimeHostMessageBaseV7 & (
  | {
      type: 'design.sync'
      surfaceId: SurfaceId
      payload: RuntimeHostDesignSyncPayloadV7
    }
  | {
      type: 'design.state'
      surfaceId: SurfaceId
      payload: RuntimeHostFormStateSnapshotV7
    }
  | {
      type: 'experience.sync'
      sessionId: string
      payload: RuntimeHostExperienceSyncPayloadV7
    }
  | {
      type: 'experience.command'
      sessionId: string
      command: PrototypeSessionCommand
    }
)

type RuntimeHostToParentMessageV7 = RuntimeHostMessageBaseV7 & (
  | { type: 'ready' | 'mounted', mode: 'design' | 'experience' }
  | {
      type: 'design.geometry'
      surfaceId: SurfaceId
      payload: RuntimeHostGeometryPayload
    }
  | {
      type:
        | 'design.pointerDown'
        | 'design.pointerMove'
        | 'design.pointerUp'
        | 'design.pointerCancel'
        | 'design.contextMenu'
      surfaceId: SurfaceId
      payload: RuntimeHostDesignPointerPayload
    }
  | {
      type: 'design.runtimeState'
      surfaceId: SurfaceId
      payload: RuntimeHostFormStateSnapshotV7
    }
  | {
      type: 'experience.session'
      sessionId: string
      transition: PrototypeTransitionSnapshotV1
    }
  | {
      type: 'experience.instanceState'
      sessionId: string
      instanceId: SurfaceInstanceId
      payload: RuntimeHostInstanceStatePayloadV7
    }
  | { type: 'error', code: string, message: string }
)
```

`RuntimeHostGeometryPayload` 与 `RuntimeHostDesignPointerPayload` 复用当前严格 JSON-safe
shape，其 Reader 与其他 v7 payload 一样拒绝 unknown/missing/`undefined`/非有限数字和危险
object key。Design 只局部渲染一个 Surface；设计态不执行 semantic interaction。
Experience child 是唯一 session reducer/effect owner，parent 只发送初始 snapshot 或外部
command，并接收不含 effects 的 session snapshot。每条 instance state 必须同时验证
`sessionId`、live `instanceId`、instance 对应 `surfaceId` 和单实例递增 `stateRevision`；已关闭
实例的 late message 被拒绝。

两个方向都对当前 `hostId/projectId/revision` 维护独立的严格递增 sequence；身份不匹配、
stale revision、重复或倒退 sequence 在触发任何状态/副作用前拒绝。只有 `design.sync` 或
`experience.sync` 可建立新 revision，且 sync 自身也必须通过 host/project 与 sequence 检查。
所有 union 分支都必须通过与 `RuntimeHostMessageBaseV7` 的交叉类型携带 base，guard 对每个
variant 做精确 key/payload 校验。

v7 删除 Workbench Prototype Preview 的 Data Source request/cancel/result RPC，以及旧的跨帧
submit/submitResult/fieldChange 通道；submit 是 Experience child 内部的 semantic trigger，
validation 成功后直接 dispatch Prototype command，不转发通用表单事件。生产 Runtime 的
code-authored Data Source 和 direct listeners 不变。writer、reader、parent frame、iframe
child 和测试同批切换，v6 一律拒绝。

## 11. Workbench 临时 generator 边界

Workbench generator 升到 5.0.0，只做当前仓库可构建所需的 Surface/IR 硬切：

- 遍历 Surface 表而非 Page 表；
- Page 生成 route，Dialog/Drawer 生成 flat asset definitions，不递归内联；
- 生成项目依赖共享 Prototype Runtime，不复制 reducer；
- 删除生成模型中的旧 bindings/conditions/reactions/runtime/optionSource。

本任务不创建 Source 包、不实现最终 SourceFileSet v1/Viewer/Monaco、不迁移复制下载 UI，
也不建立 Workbench re-export。Source 子任务再完成 generator 所有权迁移和异步 Resource
reader 接入。

## 12. 发布、回滚与失败语义

- 为所有受影响的公开 ConfigForm 包和新 Prototype Runtime 增加 breaking minor Changeset，
  同步 peer range、lockfile、root test filter、consumer smoke 和声明文件收尾列表。
- 任一 Reader、持久化、Compiler、Host 或 generator 仍接受旧合同即视为任务失败。
- 任一跨资产引用、bytes 校验或 result transaction 失败都不得发布部分 document、bytes、
  session 或 Source file set。
- 回滚单位是本任务完整变更；不得通过临时 compatibility layer 保留半切状态。

## 13. 主要风险

| 风险 | 控制 |
| --- | --- |
| 大范围重命名遗漏 reader/writer | 版本 rejection matrix + 定向旧术语搜索 + architecture test |
| 同 Surface 多实例共享状态 | compilation cache 与 instance state 分离，按 instanceId 测试 |
| bytes 与 metadata 非原子 | Repository staged write + IndexedDB 单 transaction |
| 历史版本读取到新 hash | byte key 含 contentHash，prune 使用完整 reachability |
| 循环 Surface 引用递归编译 | flat maps + 每 Surface 编译一次 + ID reference |
| Host parent/child 漂移 | v7 discriminated union + 手写 guard parity tests |
| Foundation 侵占后续 UI | 文件矩阵和阶段审查，不实现资产树、编辑器或 Source Viewer |
