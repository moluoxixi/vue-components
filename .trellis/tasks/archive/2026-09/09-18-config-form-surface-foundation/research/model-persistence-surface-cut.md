# Research: ConfigForm Model 与持久化的 Surface 硬切

- Query: 调研 ConfigForm Model 与持久化如何从 Page-only 原子硬切到 Surface，覆盖 R1-R4、R7、R10、R11，并给出影响文件、依赖顺序、风险和验证矩阵。
- Scope: internal
- Date: 2026-09-18

## Findings

### 结论

这不是 Page 字段改名，而是公共 wire contract、事务身份、实体修订、持久化编码和导入边界的一次同步断代。实现必须把下列版本在同一任务内硬切，不保留双读、迁移 Reader 或旧字段兼容：

| 合同 | 当前 | 目标 | 证据 |
| --- | --- | --- | --- |
| ProjectDocument | `5` | `6` | 当前常量见 `packages/ConfigForm/model/src/constants/versions.ts:1`；目标矩阵见 `packages/ConfigForm/ROADMAP.md:100` |
| PageGraph / SurfaceGraph | `PageGraph 3` | `SurfaceGraph 1` | 当前常量见 `packages/ConfigForm/model/src/constants/versions.ts:2`；目标结构见 `.trellis/spec/config-form/frontend/studio-domain-contracts.md:119` |
| Registry snapshot | `2` | `3` | 当前常量见 `packages/ConfigForm/model/src/constants/versions.ts:3`；目标矩阵见 `packages/ConfigForm/ROADMAP.md:103` |
| IndexedDB manifest/entity codec | `3` | `4` | 当前 codec 常量见 `packages/ConfigForm/workbench/src/project/persistence/adapters/indexed-db-project-codec.ts:25`；目标矩阵见 `packages/ConfigForm/ROADMAP.md:106` |
| Page / Surface transfer | `Page 2` | `Surface 1` | 当前常量见 `packages/ConfigForm/workbench/src/project/import/constants/version.ts:1`；目标矩阵见 `packages/ConfigForm/ROADMAP.md:107` |
| Project transfer | 不存在 | `1` | 最终 envelope 见 `.trellis/spec/config-form/frontend/studio-domain-contracts.md:294`；版本归属见 `packages/ConfigForm/ROADMAP.md:110` |

ProjectDocument v6 的完整基础形状已经定型：`homeSurfaceId`、`surfaceOrder/surfacesById`、`datasetOrder/datasetsById`、Resource map、Theme v1、Registry lock 与 settings，见 `.trellis/spec/config-form/frontend/studio-domain-contracts.md:104`。当前 v5 仍以 `homePageId/pageOrder/pagesById` 为主，并只有通用 `resources`，见 `packages/ConfigForm/model/src/types/contracts.ts:198`。因此不能在 v5 上逐字段兼容演进。

### R1 / R2 / R7 / R10：公共合同与 Reader

1. 将 `PageId`、`ProjectPage`、`PageGraph`、`PageNode` 的持久化主语整体替换为 `SurfaceId`、`ProjectSurface`、`SurfaceGraphV1`、`SurfaceNode`。Page 只是 `ProjectSurface` 的一个判别分支，Dialog/Drawer 拥有各自的 `presentation`；目标判别联合见 `.trellis/spec/config-form/frontend/studio-domain-contracts.md:185` 和 `.trellis/spec/config-form/frontend/studio-domain-contracts.md:230`。
2. `SurfaceGraphV1` 必须无损保留 props、form、root/slot placement、field/layout、validation、extensions、valueScope，并新增真正的 `element` 节点，见 `.trellis/spec/config-form/frontend/studio-domain-contracts.md:119`、`.trellis/spec/config-form/frontend/studio-domain-contracts.md:176` 和 `.trellis/spec/config-form/frontend/studio-domain-contracts.md:337`。
3. 必须彻底删除持久化的 `bindings`、`conditions`、`reactions`、page `runtime` 与动态 `optionSource`。当前这些字段仍位于 `packages/ConfigForm/model/src/types/contracts.ts:135`、`:137`、`:138`、`:163`、`:187`，并进入 operation/patch union（`:293`、`:297`、`:302`、`:310`）。目标明确要求 Reader 拒绝这些字段而非翻译，见 `.trellis/spec/config-form/frontend/studio-domain-contracts.md:343` 和 `:360`。
4. ProjectDocument v6 Reader 应继续采用当前 strict Zod + fail-closed 风格。现有 schema 广泛使用 `.strict()`（例如 `packages/ConfigForm/model/src/schemas/project.ts:247`、`:269`、`:318`），`parseProjectDocument` 在 `:373` 统一输出诊断。硬切后应拆出 Surface graph、presentation、theme、dataset、resource、interaction/reference 校验器，并将诊断稳定到 spec 中的领域码，而不是继续把绝大多数失败压成 `PROJECT_DOCUMENT_INVALID/INVARIANT`（当前映射见 `packages/ConfigForm/model/src/schemas/project.ts:386`）。
5. v6 结构校验至少包含：Surface order/map 双射且非空、至少一个 Page、home 指向 Page、Page route 全局唯一；Dataset order/map 可同时为空但必须双射；Surface/Dataset/Resource map key 必须等于实体 id。合同见 `.trellis/spec/config-form/frontend/studio-domain-contracts.md:323` 和 `:329`。当前校验只覆盖 page order、home、route、resource key 等旧结构，入口见 `packages/ConfigForm/model/src/schemas/project.ts:1185`。
6. Theme v1 与 ResponsiveLength 是 Foundation-owned 最终 wire shape，不应只留下宽松 JSON。完整结构见 `.trellis/spec/config-form/frontend/studio-domain-contracts.md:49` 和 `:73`；数值、颜色、unknown key 约束见 `:365` 和 `:376`。应提供独立 Reader/诊断并由 ProjectDocument/Surface presentation 复用。
7. Registry snapshot 必须与 SurfaceGraph 同批升到 v3。当前 `ComponentContract.kind` 只有 `field | layout`，且只有 props/bindings/slots/parents/defaults，见 `packages/ConfigForm/model/src/types/contracts.ts:80`。v3 必须一次加入 `field | layout | element`、semantic triggers、state projection paths、Dataset binding capability、Resource binding capability，目标见 `.trellis/spec/config-form/frontend/studio-domain-contracts.md:127` 和 `:144`。
8. Registry v3 Reader 仍应保留现有确定性语义：组件排序、key/version identity、单组件 fingerprint 和聚合 fingerprint 都要验证。当前实现分别见 `packages/ConfigForm/model/src/services/registry.ts:160`、`:204`、`:212`、`:219`、`:228`。不要只提升版本常量而漏掉 fingerprint 输入 shape。
9. 现有基础物料必须迁移到 v3 capability shape。集中投影所有者是 `packages/ConfigForm/designer/src/registry/services/modules.ts:49`；当前它从 material 生成 contract，并只为 field 构造 value binding（`:55`）。Designer domain 当前也只允许 field/layout，见 `packages/ConfigForm/designer/src/registry/types/domain.ts:183` 和 `:208`。优先在 material 定义声明真实 capability，再由集中投影生成；只有确实无能力的物料才使用显式空数组，避免每个 provider 复制默认逻辑。

### R3：Dataset、Resource 与引用完整性

Foundation 必须现在落下 `ProjectDataset`、`ProjectResource`、node Dataset/Resource bindings 以及 Prototype Interaction 的最终持久化合同，即使 Dataset query、Dataset transfer 和编辑 UI 属于后续 Studio Datasets。`ProjectDataset` 的目标入口见 `.trellis/spec/config-form/frontend/studio-domain-contracts.md:463`，node binding 位置见 `:152`。

Resource 应使用 `embedded | url` 判别联合，而不是当前 `{ kind, uri, integrity?, metadata? }` 的开放结构（当前见 `packages/ConfigForm/model/src/types/contracts.ts:190`；目标见 `.trellis/spec/config-form/frontend/studio-domain-contracts.md:245` 和 `:255`）。特别注意：

- ProjectDocument 永远只存 metadata；embedded bytes 由 Repository/storage adapter 持有，见 `.trellis/spec/config-form/frontend/studio-domain-contracts.md:384`。
- `fileName`、`byteLength`、`contentHash` 必须按最终规则校验，hash 是原始 bytes 的 `sha256:<64 lowercase hex>`，见同文件 `:384`-`:394`。
- graph 只存 `resourceId`，不允许把 object URL、文件路径或 provider import string 藏进 props。
- 删除 Surface/Dataset/Resource 前必须走完整引用扫描；来源诊断需保留 `sourceSurfaceId`、`nodeId`、interaction/rule 位置，满足 PRD AC3，而不是只返回“被引用”。
- 引用扫描至少覆盖 graph `datasetBindings/resourceBindings`、Surface interactions 的 open/navigate 目标、参数/结果表达式中的 field/Dataset/Resource/Surface 标识，以及 home Surface。

建议把引用完整性实现维持在 Model 的纯函数层，扩展 `packages/ConfigForm/model/src/services/reference-integrity.ts`，由 Reader、事务最终校验、import/remap 和 compiler 共同调用；不要让 Workbench 持有第二套 walker。

### R4：事务、history 与 change set

当前 operation union 从 `packages/ConfigForm/model/src/types/contracts.ts:283` 起完全是 page/node 语义，node operation 全部携带 `pageId`。`ProjectChangeSet` 也只有 `{ project, pageIds, nodeIds, nodeChanges }`，见同文件 `:421`，其中 node change 在 `:434` 仍由 `pageId` 限定。

目标 transaction surface 应至少覆盖：

- Project：home Surface、settings、Theme。
- Surface：add/remove/move/copy、rename；Page route；Dialog/Drawer presentation；parameters、outputs、interactions；graph props/form。
- Node：add/remove/move/copy/patch，定位字段改为 `surfaceId`，并支持 element 及 Dataset/Resource binding 修改。
- Dataset：add/remove/move/copy/rename/rows/default projection 或等价的受控替换操作。
- Resource：add/remove/rename/metadata replace；embedded bytes 不可伪装成普通 JSON operation，应随 repository commit/import 原子提交。

建议的新 change set 最少包含 `project`、`surfaceIds`、`datasetIds`、`resourceIds`、surface-qualified `nodeChanges`；删除不具备唯一上下文的全局 `nodeIds`，或明确只把它作为派生便利字段。Theme/settings/order/home 改动归入 `project`，Surface 内 interactions/presentation/graph 改动归入对应 `surfaceIds`。

应复用当前事务内核，而非重写：一次 Immer draft 应用全部 operations（`packages/ConfigForm/model/src/services/transactions/services/apply.ts:103`），逐项前置 inverse（`:106`），聚合 changed identities（`:108`），最终统一验证并在失败时返回原 document（`:117`、`:154`）。validation plan 当前按 page/node 增量规划（`packages/ConfigForm/model/src/services/transactions/validation/plan.ts:20`、`:44`、`:54`），需要改为 Surface/Dataset/Resource 维度并在跨资产引用改变时升级为 project reference-integrity 验证。

History 的 EMPTY_CHANGE_SET 和 undo/redo 映射仍硬编码 page 字段，见 `packages/ConfigForm/model/src/services/history.ts:14`、`:80`、`:115`、`:159`，必须与 transaction result 同批替换。Recovery draft 也自行解析旧 change set，见 `packages/ConfigForm/workbench/src/project/persistence/adapters/recovery-draft-store.ts:102`，不能遗漏。

### R4：Repository 与 IndexedDB codec v4

当前 Model repository 将 document 拆为 manifest + pages + resource metadata，见 `packages/ConfigForm/model/src/services/repository.ts:121`；实体修订只有 `manifest/pages/resources`，见 `packages/ConfigForm/model/src/types/repository.ts:24`。目标应改为至少：

```ts
interface ProjectEntityRevisions {
  manifest: number
  surfaces: Record<SurfaceId, number>
  datasets: Record<DatasetId, number>
  resources: Record<ResourceId, number>
}
```

Theme/settings/order/home/registry lock 属于 manifest；Surface、Dataset、Resource metadata 各自独立 revision。这样并发冲突、缓存失效和 entity reuse 才符合“一等实体”要求。

Workbench 当前 codec v3 的 snapshot 只有 `pages`、`resources` 和 project metadata，见 `packages/ConfigForm/workbench/src/project/persistence/types/repository.ts:28`；stored entity union 只有 `ProjectPage | ProjectResourceReference`，见同文件 `:53`。key 仍为 `page:<id>:<revision>` / `resource:<id>:<revision>`，见 `packages/ConfigForm/workbench/src/project/persistence/adapters/indexed-db-project-keys.ts:15` 和 `:19`。codec v4 必须：

- manifest 使用 `surfaces`、`datasets`、`resources` 引用表，并存 v6 manifest metadata；
- entity union 改为 `ProjectSurface | ProjectDataset | ProjectResource`；
- key 前缀改为 `surface:`、`dataset:`、`resource:`；旧 key 不读、不迁移；
- checksum payload、parse guards、snapshot builder/loader、entity revisions、list summary 全部同步；
- current snapshot、commit receipts、version snapshots、recovery drafts 全部继续参与可达性计算；
- recovery codec/version 应随 wire shape 断代，不能让旧 draft 被 v4 Reader 接受。

现有原子写基础可复用：repository create/commit 将 manifest 与 entity keys 一次交给 `updateItems`，见 `packages/ConfigForm/workbench/src/project/persistence/adapters/indexed-db-repository.ts:127` 和 `:175`；IndexedDB primitive 使用单个 `readwrite` transaction，见 `packages/indexed-db/src/IndexedDBManager.ts:166` 和 `:183`。现有 prune 已从 current/receipts/versions/recovery drafts 汇总 reachable keys，见 `packages/ConfigForm/workbench/src/project/persistence/adapters/indexed-db-repository.ts:321`-`:332`，应扩展而不是另建清理器。

### Repository bytes 未闭合合同（实施前置）

目标 spec 定义了 bytes 地址 `{ projectId, resourceId, contentHash }`，并要求 Project import 将 document 与全部 bytes 原子提交，但当前 `ProjectRepository` 只有 document CRUD/version API（入口见 `packages/ConfigForm/model/src/types/repository.ts:95`），没有 repository-facing bytes read/write/delete/list 合同。`SourceResourceReader.readEmbedded` 是消费侧合同，不足以承担持久化写入。

在实现 codec v4 前必须明确一个 Repository-owned 原子边界。建议：

1. `create` 和 `commit` 接受经过 Model 校验的 staged embedded byte writes；Project import v1 将 Reader 返回的完整 bytes snapshot 一次传入。
2. Repository 暴露精确版本读取 `readEmbedded({ projectId, resourceId, contentHash })`，输入输出都复制 `Uint8Array`，禁止调用方通过共享 buffer 修改仓储状态。
3. document metadata、entity records 与新增 byte records 必须在同一个 IndexedDB `updateItems` transaction 中成功或失败；内存仓储保持相同语义。
4. byte key 必须同时包含 projectId/resourceId/contentHash，不能只按 resourceId 覆盖旧内容，否则历史版本和 recovery draft 会读取错误 bytes。
5. 不在普通 commit 时立即删除旧 hash。orphan cleanup 必须把 current snapshot、保留版本、receipts 和 recovery drafts 对应的 embedded metadata 都算作 reachable；Project 删除才删除该 project 的全部 byte keys。
6. create/commit 必须拒绝：metadata 缺 bytes、额外 bytes、hash/length 不匹配、URL Resource 携带 bytes；不要把修复责任留给 Source。

`IndexedDBManager.updateItems` 已允许对声明 keys 做单事务更新（`packages/indexed-db/src/IndexedDBManager.ts:166`-`:217`），技术上可以把 manifest/entities/bytes 原子写入；但目前没有找到 `Uint8Array` 往返和 copy isolation 的专项测试，必须补。

### R11：Project / Surface transfer 与 identity remap

当前 import 接受裸 ProjectDocument v5，并另有 Page transfer v2：常量在 `packages/ConfigForm/workbench/src/project/import/constants/version.ts:1`，schema 按 bare document version 分流见 `packages/ConfigForm/workbench/src/project/import/schemas/current.ts:60`，Page envelope shape 在 `packages/ConfigForm/workbench/src/project/import/types/import.ts:82`。这与目标不兼容。

Foundation 应建立两个精确 Reader：

- Surface transfer v1，彻底替换 Page transfer v2；包含一个 Surface 和所需 Registry lock/identity 信息，拒绝旧 kind/version。
- Project transfer v1，唯一完整项目导入入口为 `{ kind: 'config-form-project', version: 1, document, embeddedContents }`，见 `.trellis/spec/config-form/frontend/studio-domain-contracts.md:294`。即使首期合法 fixture 的 resources 为空，也必须要求 `embeddedContents: []` 且走完整 envelope Reader，不能继续接受裸 v6 document。

Project transfer Reader 是 async，因为需要 base64 decode、byte length 与 SHA-256 校验；结果应返回 metadata-only document 与新建 byte arrays，目标签名见 `.trellis/spec/config-form/frontend/studio-domain-contracts.md:304` 和 `:313`。Reader 必须在落库前验证 embedded 一一对应、URL 零内容、duplicate/missing/extra、10 MiB 单资源、256 项/50 MiB 总量等规则，见同文件 `:396`-`:411`。

现有 identity remap 只构造/重映射 project/page/node（例如 `packages/ConfigForm/workbench/src/project/services/identity-remap.ts:150`）。目标 remap 必须在一次计划中覆盖 Project、Surface、node/field、Dataset、Resource、interaction rule 及 expression AST 中的所有引用；先分配完整 old->new map，再重写，最后通过 v6 Reader/reference-integrity 校验，禁止字符串搜索替换。

### 实施依赖顺序

1. **Model constants / IDs / types**：一次定义 v6、SurfaceGraph v1、Registry v3、Theme v1、Dataset/Resource/interaction、transfer v1 的最终公共 shape；删除旧导出。
2. **Model schemas / readers / diagnostics**：先让严格 Reader 成为唯一真相，包括 theme/length、Registry capability、Surface/Dataset/Resource 和引用诊断。
3. **Designer Registry projection**：扩展 material kind/capabilities，迁移现有基础物料，使 v3 snapshot 能被真实 registry 产生并通过 fingerprint Reader。
4. **Model transactions / reference integrity / history**：操作 union、inverse、change set、validation plan、undo/redo 全部切到新身份。
5. **Model memory repository**：entity revisions 与 split/merge 改为 Surface/Dataset/Resource，同时拍板并实现 bytes 原子 API。
6. **Workbench IndexedDB codec v4**：keys、manifest/entities、byte records、recovery、retention、orphan GC 同批落地。
7. **Transfer / import / remap**：Project v1 + Surface v1 精确 Reader，atomic import，完整 identity remap；删除 bare document 和 Page v2 路径。
8. **Fixtures / tests / barrels / docs**：所有旧 v5/PageGraph/page transfer fixture 直接替换；不得留下兼容 fixture 或 deprecated export。
9. **下游消费者**：Compiler/Runtime/Workbench UI 必须在公共切口完成后统一消费新 API；不能为降低编译错误而在 Model 暂留 Page alias。

### 实现文件矩阵

| 需求 | 主要文件/目录 | 预期改动 |
| --- | --- | --- |
| R1/R2/R7/R10 类型与版本 | `packages/ConfigForm/model/src/constants/versions.ts`; `model/src/types/contracts.ts`; `model/src/types/{schemas,transactions,history,engine}.ts` | 最终 v6/Surface/Theme/Registry v3 shape；删除 Page-only 与禁用字段 |
| R1/R2/R10 Reader | `model/src/schemas/project.ts`; `model/src/schemas/registry.ts`; `model/src/schemas/index.ts` | strict schema、稳定诊断、theme/length/presentation/capability 校验 |
| R2 Registry 服务 | `model/src/services/registry.ts`; `designer/src/registry/types/domain.ts`; `designer/src/registry/services/modules.ts`; provider material definitions | v3 fingerprint/read/write 与基础物料 capability 投影 |
| R3 引用 | `model/src/services/reference-integrity.ts`; transaction validation files | 全资产引用 walker、删除保护、稳定来源诊断 |
| R4 事务/history | `model/src/services/transactions/**`; `model/src/services/{commands,history,engine}.ts` | Surface/Dataset/Resource operations、inverse、change set、增量验证 |
| R4 Repository | `model/src/types/repository.ts`; `model/src/services/repository.ts` | entity revisions、split/merge、bytes 原子 API 与 isolation |
| R4 codec v4 | `workbench/src/project/persistence/types/{repository,recovery}.ts`; `persistence/adapters/{indexed-db-project-codec,indexed-db-project-keys,indexed-db-repository,indexed-db-project-retention,recovery-draft-store}.ts` | v4 manifest/entity/bytes、recovery、可达性与 GC |
| R11 transfer/import | `workbench/src/project/import/**`; `workbench/src/project/services/identity-remap.ts` | Project v1、Surface v1、async bytes 校验、全身份 remap；删除 Page v2/bare import |
| Public exports | Model/Designer/Workbench 各层 `index.ts` / package exports | 只导出新合同，不保留旧 alias |

### 测试与验证

应优先改写/扩展：

- `packages/ConfigForm/model/__tests__/model.test.ts`：v6/SurfaceGraph/Theme/Registry v3 正反 Reader、旧字段和旧版本严格拒绝、transaction inverse/change set、引用诊断。
- `packages/ConfigForm/model/__tests__/repository-store.test.ts`：Surface/Dataset/Resource 独立 revisions、CAS、receipt/version、bytes copy isolation 和原子失败回滚。
- `packages/ConfigForm/model/__tests__/data-runtime.test.ts`：当前测试 page runtime/dynamic data source，应删除或替换为“旧字段被拒绝”和 Dataset/interaction 合同测试。
- `packages/ConfigForm/workbench/src/project/__tests__/project-document-repository.test.ts`：codec v4、entity reuse、bytes round-trip、missing/corrupt bytes、历史/recovery reachability、orphan cleanup。
- `packages/ConfigForm/workbench/src/project/__tests__/project-recovery-draft-store.test.ts`：新 change set、Surface/Dataset entities、bytes reachability。
- `packages/ConfigForm/workbench/src/project/__tests__/json-import.test.ts`：只接受 Project v1/Surface v1，拒绝 bare document、Page v2、旧版本、额外/缺失/重复/损坏 embedded content。
- `packages/ConfigForm/workbench/src/project/__tests__/fixtures.ts` 及 template/editor/persistence session tests：统一替换为 v6 fixtures，不保留旧格式 helper。
- `packages/indexed-db` tests：补 `Uint8Array` structured-clone 往返、写入后输入 mutation、读取后输出 mutation、manifest/entity/bytes 同事务 rollback。

建议验证命令：

```powershell
pnpm --filter @moluoxixi/config-form-model test
pnpm --filter @moluoxixi/config-form-model typecheck
pnpm --filter @moluoxixi/config-form-model build
pnpm --filter @moluoxixi/config-form-designer test
pnpm --filter @moluoxixi/config-form-designer typecheck
pnpm --filter @moluoxixi/config-form-designer-element-plus test
pnpm --filter @moluoxixi/config-form-designer-antd-vue test
pnpm --filter @config-form/workbench test --maxWorkers=2
pnpm --filter @config-form/workbench typecheck
pnpm --filter @config-form/workbench build
pnpm test:config-form-packages
pnpm test:package-architecture
pnpm test:performance
```

## Files Found

- `packages/ConfigForm/model/src/constants/versions.ts` - 当前 Project/PageGraph/Registry 三个公共版本常量。
- `packages/ConfigForm/model/src/types/contracts.ts` - v5 Project、PageGraph、Registry、operation、change set 的集中合同。
- `packages/ConfigForm/model/src/schemas/project.ts` - 当前 strict Project/Page graph Reader 与旧结构不变量。
- `packages/ConfigForm/model/src/schemas/registry.ts` - Registry snapshot schema。
- `packages/ConfigForm/model/src/services/registry.ts` - Registry snapshot 生成、排序、identity 和 fingerprint 验证。
- `packages/ConfigForm/model/src/services/reference-integrity.ts` - 应扩展为全资产引用验证的现有所有者。
- `packages/ConfigForm/model/src/services/transactions/` - operation apply、inverse、change aggregation 与 validation plan。
- `packages/ConfigForm/model/src/services/history.ts` - undo/redo 与 change set 映射。
- `packages/ConfigForm/model/src/types/repository.ts` - Repository、entity revisions、commit 输入边界。
- `packages/ConfigForm/model/src/services/repository.ts` - 内存 Repository、实体拆分、CAS、receipt/version retention。
- `packages/ConfigForm/designer/src/registry/types/domain.ts` - Designer material 目前只有 field/layout 的类型边界。
- `packages/ConfigForm/designer/src/registry/services/modules.ts` - material -> Registry contract 的集中投影点。
- `packages/ConfigForm/workbench/src/project/persistence/types/repository.ts` - IndexedDB v3 manifest/entity 类型。
- `packages/ConfigForm/workbench/src/project/persistence/adapters/indexed-db-project-codec.ts` - v3 encode/decode/checksum/entity reuse。
- `packages/ConfigForm/workbench/src/project/persistence/adapters/indexed-db-project-keys.ts` - page/resource versioned key 格式。
- `packages/ConfigForm/workbench/src/project/persistence/adapters/indexed-db-repository.ts` - 原子 commit、version、retention 和可达性清理。
- `packages/ConfigForm/workbench/src/project/persistence/adapters/recovery-draft-store.ts` - recovery snapshot 与旧 change set Reader。
- `packages/ConfigForm/workbench/src/project/import/` - 当前 bare Project v5 与 Page transfer v2 Reader/import。
- `packages/ConfigForm/workbench/src/project/services/identity-remap.ts` - 当前仅 project/page/node 的 identity remap。
- `packages/indexed-db/src/IndexedDBManager.ts` - 可承载 manifest/entity/bytes 单事务写的底层 primitive。

## Code Patterns

- Reader 采用 strict Zod、返回结构化 diagnostic、成功后 clone/freeze；新合同应沿用，不应增加容错迁移分支。
- Registry snapshot fingerprint 覆盖完整 component contract；capability shape 改变自然改变 fingerprint，应保留这一性质。
- Transaction 采用单 Immer draft + inverse operations + 最终 validation，适合扩展到 Surface/Dataset/Resource。
- Repository 对输入输出使用 `structuredClone`（例如 `packages/ConfigForm/model/src/services/repository.ts:182`、`:189`），byte API 也必须保持相同 isolation。
- IndexedDB snapshot 复用未变实体并以版本化 key 保留历史；Surface/Dataset/Resource 和 bytes 应进入相同 reachability 模型。

## External References

- 无。此次结论完全来自仓库内 PRD、规范、Roadmap、源码和测试；未依赖外部文档或网络版本信息。

## Related Specs

- `.trellis/tasks/09-18-config-form-surface-foundation/prd.md` - 当前任务 R1-R11 与 AC。
- `.trellis/spec/config-form/frontend/studio-domain-contracts.md` - Surface、Dataset、Resource、Theme、Registry v3、transfer、诊断最终合同。
- `.trellis/spec/config-form/frontend/product-boundaries.md` - Studio/Runtime/Source 产品边界。
- `.trellis/spec/config-form/frontend/index.md` - ConfigForm 前端规范索引。
- `.trellis/spec/config-form-model/frontend/index.md` - Model 包边界与质量要求。
- `.trellis/spec/config-form-workbench/frontend/index.md` - Workbench 所有权与持久化边界。
- `.trellis/spec/config-form-workbench/frontend/quality-guidelines.md` - Workbench 测试与质量门槛。
- `.trellis/spec/config-form-core/frontend/architecture-documentation.md` - Core/Runtime 依赖方向。
- `packages/ConfigForm/PRODUCT.md` 与 `packages/ConfigForm/ROADMAP.md` - 产品定位和断代矩阵。

## Caveats / Not Found

1. **关键未定项：Repository bytes API 缺失。** Spec 只定义地址和消费侧 `SourceResourceReader`，没有确定 create/commit/read/delete 的 repository-facing 形状。必须在 codec v4 开工前定型，否则 Workbench 会先发明临时 API，后续 Source/Datasets 再破坏一次。
2. **Dataset 任务边界容易误读。** Foundation 必须落地 `ProjectDataset`、引用、顺序/map、entity revision、事务与持久化；Dataset transfer、raw rows ingestion、query service 和 UI 仍属于后续 Studio Datasets。不能因此把 Foundation 的 v6 Dataset shape 留空或宽松化。
3. **Project transfer v1 必须现在完整验证 bytes。** 即使首批测试 resources 为空，Reader 仍需最终 envelope、限制、base64/hash/length/一一对应规则；后续任务只负责填充功能/UI，不应再改 v1 shape。
4. **未找到 IndexedDB `Uint8Array` 专项测试。** 浏览器 structured clone 能力不能替代仓储 isolation/rollback 测试，尤其要证明读写两侧 mutation 不泄漏。
5. **Registry v3 不能只靠空默认值过关。** 基础物料的 semantic trigger、state projection、Dataset/Resource capability 必须由真实定义投影；只有确无能力时才显式为空。
6. **硬切会让所有旧 fixture 同时失效，这是预期行为。** 不应增加 Page alias、v5 migration 或 removed-field stripping 来降低短期编译错误。
