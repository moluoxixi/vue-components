# Research: Workbench 协议与 Surface 原子硬切

- Query: 调研 Workbench 当前 Page-only 项目 import/export、IndexedDB/storage、workspace/session/runtime-host/Preview transport、undo/cache 及内置 Source 读取路径，列出 Surface Foundation 原子硬切必须修改的精确文件、版本、测试、风险和后续任务边界。
- Scope: internal
- Date: 2026-09-18

## Findings

### 1. 结论摘要

1. 这不是把 `Page` 类型机械改名为 `Surface`。Workbench 目前至少有五套独立的 Page 身份：导入传输、IndexedDB 实体、编辑/撤销 change set、编译缓存、iframe Runtime Host 身份。只切其中一套会产生可被类型断言掩盖的混合合同。
2. 本任务必须一次切到以下身份：ProjectDocument `6`、SurfaceGraph `1`、Registry snapshot `3`、Canonical Project IR `5`、Compiler `6.0.0`、IndexedDB manifest/entity codec `4`、Surface transfer `1`、Runtime Host `7`、Workbench generator `5.0.0`、Project transfer `1`、Prototype session `1`。旧 reader、字段别名和双读路径均不能保留（`.trellis/spec/config-form/frontend/studio-domain-contracts.md:949`）。
3. 当前 Preview session 是“单 Page 表单镜像”，不是目标 Prototype session。Foundation 应让 `@moluoxixi/config-form-prototype-runtime` 成为页面历史、overlay stack、`SurfaceInstance` 状态和 UI action reducer 的唯一拥有者；Workbench 只能组合它，不能把 `preview.ts` 扩写成第二个 reducer。
4. 当前 Runtime Host v6 用 `pageId` 作为所有消息身份，并传 `PageCompilation`。v7 至少必须区分 `surfaceId`（资产/编译身份）与 `instanceId`（运行状态身份）；重复打开同一 Dialog/Drawer 时，任何按 `surfaceId` 保存 values/validation/focus 的实现都会串状态。
5. 当前 IndexedDB v3 只拆分 `page | resource` JSON 实体，没有 Dataset 实体，也没有 embedded bytes。v4 必须同时引入 Surface/Dataset 独立 revision、Resource metadata 与按 `projectId/resourceId/contentHash` 寻址的 bytes，并把 create/import/commit/delete/prune/recovery 的原子性与可达性一起改完。
6. 当前“项目 JSON”直接读写裸 `ProjectDocument`，不是真正的 Project transfer。Foundation 必须先落 Project transfer v1 的精确 reader/writer，并至少证明无 Resource 项目的 `{ document, embeddedContents: [] }` 往返；后续 Dataset/Resource 任务再填充资源 UI 和内容消费。
7. 当前 Workbench generator 4.0.0 与 Compiler 的 `getConfigFormRuntimeSources()` 是内置 Source 路径。Foundation 要使临时 Workbench generator 5.0.0 不再理解 Page-only IR；但 Source 包迁移、Viewer/Monaco 所有权和最终 `SourceFileSetV1` 均留给 `config-form-source-package`，本任务不得提前创建 Source 包或保留未来 wrapper。

### 2. 当前导入、导出与身份重映射

#### 当前行为

- `PAGE_TRANSFER_VERSION = 2`，单页 envelope 为 `kind: 'config-form-page'`（`packages/ConfigForm/workbench/src/project/import/constants/version.ts:1`；`packages/ConfigForm/workbench/src/project/import/types/import.ts:81`）。
- Project import 直接把未知 JSON 交给 `parseProjectDocument`，没有 `kind/version/document/embeddedContents` 的 Project transfer 外层（`packages/ConfigForm/workbench/src/project/import/schemas/current.ts:55`）。
- 单页 import reader 精确接受 Page transfer v2，但目标要求删除它而非兼容（`packages/ConfigForm/workbench/src/project/import/schemas/current.ts:76`）。
- 完整项目身份重映射先遍历 `pageOrder`，逐 Page 创建 ID；它不知道 Surface、Dataset、Resource 和交互 AST 的跨资产引用（`packages/ConfigForm/workbench/src/project/import/services/identity.ts:14`）。
- import 预算、编译预检、诊断路径和预览均遍历 `pagesById/pageOrder`，只编译 Page（`packages/ConfigForm/workbench/src/project/import/services/import.ts:39`、`:72`、`:200`）。
- 项目落库仅调用 `repository.create({ document })`；prepared import 不携带 bytes，因此当前流程不可能保证 metadata/bytes 原子提交（`packages/ConfigForm/workbench/src/app/services/controller-creation.ts:48`）。
- 导出弹窗的 JSON 分支直接输出 `ProjectDocument` 或 Page transfer，且 UI scope 仍为 `project | page`（`packages/ConfigForm/workbench/src/features/export/index.vue:78`、`:94`）。

#### Foundation 必须硬切

- 删除 `PAGE_TRANSFER_VERSION`、`PageTransferDocument`、`config-form-page` reader/writer；以唯一 Surface transfer v1 取代。禁止保留 Page v2 re-export。
- Project JSON reader 必须只接受 Project transfer v1；裸 ProjectDocument v6 也应因缺少 transfer identity 被拒绝。无 Resource 项目仍要求 `embeddedContents: []`，不能省略。
- 项目级 identity remap 必须先建立 Project/Surface/node/field/Dataset/Resource ID 映射，再结构化重写 Surface references、Dataset/Resource bindings、Safe Expression AST references 和交互 targets。不能逐 Surface 独立 remap，也不能字符串替换表达式。
- prepared project import 的结果必须携带验证后的 `embeddedBytesByResourceId`，最终 repository create 必须在一个存储事务内写 document entities、bytes 和 manifest；失败不得留下项目或孤儿 bytes。
- Surface import 的依赖语义必须显式：若只传单 Surface，所有外部 Surface/Dataset/Resource 引用必须随依赖闭包传入，或在提交前明确重绑定/拒绝；当前合同没有定义这一点，见“合同缺口”。
- Workbench 现有导出 UI只需机械消费新 helper 以避免继续产生旧 JSON；项目管理中的完整导入/导出工作流、冲突 UX 和资产树属于后续 Studio Assets。

#### 精确文件

- `packages/ConfigForm/workbench/src/project/import/constants/version.ts`
- `packages/ConfigForm/workbench/src/project/import/constants/index.ts`
- `packages/ConfigForm/workbench/src/project/import/types/import.ts`
- `packages/ConfigForm/workbench/src/project/import/schemas/current.ts`
- `packages/ConfigForm/workbench/src/project/import/schemas/guard.ts`
- `packages/ConfigForm/workbench/src/project/import/services/transfer.ts`
- `packages/ConfigForm/workbench/src/project/import/services/identity.ts`
- `packages/ConfigForm/workbench/src/project/import/services/import.ts`
- `packages/ConfigForm/workbench/src/project/services/identity-remap.ts`
- `packages/ConfigForm/workbench/src/project/services/isolated-preview.ts`
- `packages/ConfigForm/workbench/src/app/services/controller-creation.ts`
- `packages/ConfigForm/workbench/src/features/export/index.vue`

### 3. IndexedDB、Repository 与 recovery

#### 当前行为

- manifest 与 entity codec 都是 v3（`packages/ConfigForm/workbench/src/project/persistence/adapters/indexed-db-project-codec.ts:24`）。
- manifest metadata 固化 `homePageId/pageOrder`，snapshot maps 为 `pages/resources`（`packages/ConfigForm/workbench/src/project/persistence/types/repository.ts:14`）。
- entity discriminant 只有 `page | resource`，key 分别是 `page:<id>:<revision>` 与 `resource:<id>:<revision>`（`packages/ConfigForm/workbench/src/project/persistence/adapters/indexed-db-project-codec.ts:214`；`packages/ConfigForm/workbench/src/project/persistence/adapters/indexed-db-project-keys.ts:15`）。
- `createSnapshotManifest` 只遍历 `document.pagesById` 和 `document.resources`，没有 Dataset entity、resource bytes 或 content-addressed byte key（`packages/ConfigForm/workbench/src/project/persistence/adapters/indexed-db-project-codec.ts:212`）。
- restore、version retention 和 receipt 都通过 snapshot reference keys 保活 JSON entity；bytes 不在可达图中（`packages/ConfigForm/workbench/src/project/persistence/adapters/indexed-db-repository.ts:306`）。
- recovery draft 自身版本仍是 `1`，复用正式 snapshot codec，但其 change set reader硬编码 `pageIds`，draft entity 仍是 `page | resource`（`packages/ConfigForm/workbench/src/project/persistence/adapters/recovery-draft-store.ts:30`、`:45`、`:102`）。

#### Foundation 必须硬切

- codec 只接受 manifest/entity `4`；v3 不迁移、不重写、不修复。
- metadata 改为 `homeSurfaceId/surfaceOrder/datasetOrder/theme/registryLock/settings`；snapshot reference maps 至少为 `surfaces/datasets/resources`，各实体 revision 独立。
- JSON entity key 改成明确的 `surface`、`dataset`、`resource` 命名；不能继续把 Dialog/Drawer 塞进 `page:` key。
- embedded bytes 使用独立 content-addressed key，身份必须包含 `projectId/resourceId/contentHash`，不能使用 author-renamable `name`、repository revision 或 object URL。
- `create`、项目 transfer import、resource content replacement 与 delete 必须在一个 IndexedDB transaction 中处理 metadata/bytes；writer 只有在 bytes length/hash 已验证后才能发布 manifest。
- `pruneVersions` 和 project delete 必须把 current snapshot、retained versions、receipts、recovery drafts 中的 Resource metadata 推导为 byte reachability roots；否则会提前删除旧版本仍引用的 bytes，或永久泄漏 orphan bytes。
- recovery draft 必须使用新 `ProjectChangeSet` 和 v4 snapshot codec。若 draft 可以引用尚未进入正式版本的新 embedded Resource，draft capture 也必须保证相应 bytes 可达；不能只保存 metadata。
- Memory repository 和 IndexedDB repository 必须实现同一 Resource byte 语义，Source/Studio 只能从 repository port 读取 fresh byte copy，不能深导入 IndexedDB adapter。

#### 精确文件

- `packages/ConfigForm/workbench/src/project/persistence/types/repository.ts`
- `packages/ConfigForm/workbench/src/project/persistence/types/recovery.ts`
- `packages/ConfigForm/workbench/src/project/persistence/adapters/indexed-db-project-codec.ts`
- `packages/ConfigForm/workbench/src/project/persistence/adapters/indexed-db-project-keys.ts`
- `packages/ConfigForm/workbench/src/project/persistence/adapters/indexed-db-repository.ts`
- `packages/ConfigForm/workbench/src/project/persistence/adapters/indexed-db-project-retention.ts`
- `packages/ConfigForm/workbench/src/project/persistence/adapters/recovery-draft-store.ts`
- `packages/ConfigForm/workbench/src/project/persistence/services/persistence-session.ts`
- `packages/ConfigForm/workbench/src/project/persistence/services/save-coordinator.ts`
- `packages/ConfigForm/workbench/src/project/defaults/editor-session.ts`
- `packages/ConfigForm/workbench/src/project/services/editor-session.ts`
- `packages/ConfigForm/workbench/src/project/types/editor-session.ts`

### 4. Undo/redo、change set 与编译缓存

#### 当前行为

- Workbench 的空 change set、merge 和 recovery summary 都以 `pageIds/nodeIds/nodeChanges` 为精确失效范围（`packages/ConfigForm/workbench/src/project/persistence/services/persistence-session.ts:21`、`:72`）。
- Design Session 的 candidate cache key 是 `editVersion + current pageId + JSON(command)`；Runtime artifact LRU 以 `compilation.key.pageId` 为主键，只缓存 committed PageCompilation（`packages/ConfigForm/workbench/src/session/services/workbench-design.ts:65`；`packages/ConfigForm/workbench/src/session/services/page-runtime-cache.ts:37`）。
- undo/redo 本身正确委托 Model engine，历史跳转通过 `session.batch()` 只发布一次（`packages/ConfigForm/workbench/src/session/services/workbench-design.ts:233`）。应保留这一架构，不在 Workbench 另建历史。

#### Foundation 必须硬切

- `ProjectChangeSet` 应能精确表达 project、Surface、Dataset、Resource 和 node 变化；Workbench 的 empty/merge/parser/summary/fixtures 同步切换，不能把 Dataset/Resource 修改伪装成 `project: true` 后永久全量失效。
- Surface/Dataset 的增删改排、复制和引用更新必须都是 Model command/history transaction；Workbench 只调用 command，不直接 mutate document。
- 将 Page artifact cache 变成 Surface artifact cache，key 至少包含 Surface asset identity、asset revision/compilation key、Registry identity。它缓存编译产物，绝不能缓存 `SurfaceInstance` values/validation/focus/parameters。
- candidate cache 改用当前 `surfaceId`；切换 project/adapter/Surface、registry v3 或 invalidation 时清空。Draft 仍不得污染 committed cache。
- 同一 Surface 被打开两次只共享不可变 compilation，不共享任何 instance state；这是 cache 与 Prototype Runtime 的关键分界。

#### 精确文件

- `packages/ConfigForm/workbench/src/session/types/cache.ts`
- `packages/ConfigForm/workbench/src/session/types/projection.ts`
- `packages/ConfigForm/workbench/src/session/types/preview.ts`
- `packages/ConfigForm/workbench/src/session/types/workbench-design.ts`
- `packages/ConfigForm/workbench/src/session/services/page-runtime-cache.ts`（应硬切命名为 Surface，不保留旧 barrel alias）
- `packages/ConfigForm/workbench/src/session/services/projection-coordinator.ts`
- `packages/ConfigForm/workbench/src/session/services/preview.ts`
- `packages/ConfigForm/workbench/src/session/services/workbench-design.ts`
- `packages/ConfigForm/workbench/src/app/services/controller-project-binding.ts`
- `packages/ConfigForm/workbench/src/app/services/controller.ts`

### 5. Runtime Host v6、Preview transport 与 Prototype Runtime

#### 当前行为

- outer protocol 是 v6（`packages/ConfigForm/workbench/src/runtime-host/constants/protocol.ts:2`）。
- 每条消息身份固定为 `hostId/projectId/pageId/revision`，sync 传 `PageCompilation`（`packages/ConfigForm/workbench/src/runtime-host/types/protocol.ts:9`、`:44`）。
- schema 手写检查 PageCompilation、Canonical IR/Compiler 版本和 page identity，因此只改 TS 类型不会切 reader（`packages/ConfigForm/workbench/src/runtime-host/schemas/protocol.ts:54`、`:208`）。
- iframe child 直接编译单 Page 并挂载 `ConfigFormRenderer`；没有 Project session、page history、overlay instances 或 instance-owned state（`packages/ConfigForm/workbench/src/runtime-host/composables/use-runtime-host-protocol.ts:210`；`packages/ConfigForm/workbench/src/runtime-host/index.vue:1`）。
- Preview parent 和 session 都按 `projectId + adapter + pageId` scope 保存 values/validation，不能表达同一 Surface 的两个实例（`packages/ConfigForm/workbench/src/session/services/preview.ts:27`）。
- v6 还承载 Runtime Data Source request/cancel/result RPC（`packages/ConfigForm/workbench/src/runtime-host/types/protocol.ts:76`；`packages/ConfigForm/workbench/src/app/components/PreviewRuntimeHostFrame/index.vue:68`）。目标 Studio Dataset 不复用这套 HTTP 生命周期。

#### Foundation 必须硬切

- v7 reader/writer 同时切换，拒绝 v6、未来、缺失和混合消息；删除 `pageId` compatibility alias。
- design transport 传单 `SurfaceCompilation` 并以 `surfaceId` 标识当前资产；Experience transport 传完整 `ProjectCompilation`/Prototype session 所需的 JSON-safe snapshot，并以 `instanceId` 标识运行实例。共同 base 仍需 host/project/revision/sequence 防重放。
- 重复/循环 Surface 打开、close/back/navigate 后的消息必须校验 live `instanceId`，不能只校验 `surfaceId`。关闭实例后，late field/validation/focus/result 消息必须被拒绝。
- iframe Experience host 必须组合 Prototype Runtime `/vue`；root/session reducer 保持 DOM-free。Design host 可继续只渲染一个 Surface，但不能实现另一套 overlay/session reducer。
- 从 Studio Runtime Host 协议删除 Data Source RPC、`dataSourceRequest` capability 和对应 proxy/executor；生产 Runtime 的 code-authored Data Source 不受影响。后续 Dataset 使用共享纯查询服务，不通过 HTTP RPC。
- 保留 origin/source/host/sequence/revision 防护、design geometry 和 pointer transport，但 identity filter 改为 Surface/instance 语义。

#### 精确文件

- `packages/ConfigForm/workbench/src/runtime-host/constants/protocol.ts`
- `packages/ConfigForm/workbench/src/runtime-host/types/protocol.ts`
- `packages/ConfigForm/workbench/src/runtime-host/types/preview-frame.ts`
- `packages/ConfigForm/workbench/src/runtime-host/types/design-frame.ts`
- `packages/ConfigForm/workbench/src/runtime-host/schemas/protocol.ts`
- `packages/ConfigForm/workbench/src/runtime-host/composables/use-runtime-host-protocol.ts`
- `packages/ConfigForm/workbench/src/runtime-host/index.vue`
- `packages/ConfigForm/workbench/src/app/components/PreviewRuntimeHostFrame/index.vue`
- `packages/ConfigForm/workbench/src/app/components/DesignRuntimeHostFrame/index.vue`
- `packages/ConfigForm/workbench/src/services/preview-instance-state.ts`
- 删除目标 Studio 不再使用的 `runtime-host/types/data-rpc.ts`、`schemas/data-rpc.ts`、`services/data-rpc.ts` 及 barrels/tests；不要转成 Dataset RPC。
- 新建真实 `packages/ConfigForm/prototype-runtime/`，root 与 `/session` 不触 DOM，`/vue` 与 `/vue/style` 承担 Surface/overlay/focus/mask host。该包不是 Workbench 私有 helper。

### 6. Workbench 内置 Source 路径

#### 当前行为

- Workbench generator version 是 `4.0.0`，同步生成 Source 与 Config 两套 file set（`packages/ConfigForm/workbench/src/project/export/services/snapshot.ts:20`、`:50`）。
- Source generator 遍历 Canonical `pageOrder/pagesById`，生成 Vue Router Page 文件（`packages/ConfigForm/workbench/src/project/export/services/source.ts:32`、`:43`）。
- 当前私有 Source node 仍包含即将删除的 `bindings/conditions/reactions/runtime/optionSource`（`packages/ConfigForm/workbench/src/project/export/types/source.ts:20`）。
- adapter 在 Workbench 内构造 `CanonicalSourceBindingResolver`，并把它挂在 `WorkbenchAdapter.sourceResolver`（`packages/ConfigForm/workbench/src/adapters/services/load.ts:36`；`packages/ConfigForm/workbench/src/adapters/types/contracts.ts:13`）。
- Compiler 通过三个 `import.meta.glob(...?raw)` 读取 Core、Headless、Vue Runtime 源码，`getConfigFormRuntimeSources()` 再供 Workbench 拷进生成项目（`packages/ConfigForm/compiler/src/runtime-source/services/sources.ts:1`、`:129`）。

#### Foundation 必须做与不得做

- 把仍在 Workbench 内的临时 generator 身份升到 `5.0.0`，使其只消费 ProjectCompilation v5/Compiler 6，并生成 Page/Dialog/Drawer 的非递归引用结构；旧 Page-only generator 不能作为兼容分支保留。
- 生成项目必须调用共享 Prototype Runtime，而不是把 reducer/query engine 的源码复制进模板。推荐把 `@moluoxixi/config-form-prototype-runtime` 作为明确依赖并生成薄组合层；不要把 prototype-runtime 加进 `getConfigFormRuntimeSources()` raw glob。
- 当前 Core/Headless/Vue Runtime raw-source 闭包若继续临时存在，必须更新已删除类型引用并保持构建可运行；其最终归属由 Source 包任务处理。
- 本任务不要创建 `@moluoxixi/config-form-source`，不要迁移 Monaco/Viewer，不要删除 Studio 自己拥有的复制/下载/ZIP/dialog 命令，也不要添加未来包 wrapper。
- 最终的 `SourceProviderResolver`、异步 `SourceResourceReader`、`SourceFileSetV1` reader、binary canonical base64、Viewer controlled selection 及 Workbench 旧实现删除，全部属于 `config-form-source-package`。Foundation 只需暴露足够稳定的 ProjectCompilation、Prototype Runtime 和 Repository byte port，让后续抽离无需改领域合同。

#### Foundation 会受类型硬切影响的精确文件

- `packages/ConfigForm/workbench/src/project/export/services/source.ts`
- `packages/ConfigForm/workbench/src/project/export/services/source-canonical.ts`
- `packages/ConfigForm/workbench/src/project/export/services/source-page.ts`
- `packages/ConfigForm/workbench/src/project/export/services/source-project-files.ts`
- `packages/ConfigForm/workbench/src/project/export/services/source-layout.ts`
- `packages/ConfigForm/workbench/src/project/export/services/source-portability.ts`
- `packages/ConfigForm/workbench/src/project/export/services/source-libraries.ts`
- `packages/ConfigForm/workbench/src/project/export/services/source-registry.ts`
- `packages/ConfigForm/workbench/src/project/export/services/config.ts`
- `packages/ConfigForm/workbench/src/project/export/services/config-page.ts`
- `packages/ConfigForm/workbench/src/project/export/services/snapshot.ts`
- `packages/ConfigForm/workbench/src/project/export/types/source.ts`
- `packages/ConfigForm/workbench/src/project/export/types/bindings.ts`
- `packages/ConfigForm/workbench/src/project/export/types/snapshot.ts`
- `packages/ConfigForm/workbench/src/session/services/workbench-export.ts`
- `packages/ConfigForm/workbench/src/session/types/workbench-export.ts`
- `packages/ConfigForm/workbench/src/adapters/services/load.ts`
- `packages/ConfigForm/workbench/src/adapters/types/contracts.ts`
- `packages/ConfigForm/compiler/src/runtime-source/services/sources.ts`

### 7. 应留给后续任务的内容

| 后续任务 | 本任务不要实现 |
| --- | --- |
| `config-form-studio-assets` | 项目首页、完整资产树、Page/Dialog/Drawer 搜索/计数/上下文菜单、真实 presentation 设计外壳、项目 transfer 导入导出 UX、删除引用展示。现有 PageManager 若因硬切失效，只做最小 Page-kind Surface 适配或移除旧入口，不在 Foundation 偷做完整资产 UI。 |
| `config-form-studio-datasets` | Dataset 表格/JSON 编辑器、raw rows ingestion UX、Dataset/Resource 单资产导入导出冲突策略、options“保存为 Dataset”、Resource 管理 UI。Foundation 只固化类型、reader、repository bytes 和空集合/基础事务。 |
| `config-form-studio-materials` | Text/Button/Image/Table/List 等条目、主题编辑控件、双 adapter 视觉投影。Foundation 只固定 Registry v3 capability、Theme v1 与长度 reader，并迁移现有基础条目。 |
| `config-form-studio-interactions` | Inspector interaction 区、表达式编辑 UI、create-and-bind 事务入口、Experience 模式 UI。Foundation 必须完成 reducer/Surface host，但后续只接作者配置和 UI，不得改 reducer v1。 |
| `config-form-source-package` | 新 Source 包、最终 generator/provider/resource inputs、SourceFileSet v1、Viewer、Monaco lazy boundary、Workbench 旧 generator/Viewer 的最终删除和 Studio 直接组合。 |

### 8. 测试矩阵

#### 必须更新的现有测试

- Import/transfer: `project/__tests__/json-import.test.ts`、`app/__tests__/workbench-controller-template-create.test.ts`、`features/templates/__tests__/json-import-pane.test.ts`。删除 Page v2 happy path，覆盖 Project transfer v1、Surface transfer v1、完整 remap、旧/未来/缺失/mixed rejection 和落库补偿。
- Storage: `project/__tests__/project-document-repository.test.ts`、`project/__tests__/project-recovery-draft-store.test.ts`、`project/__tests__/project-persistence-session.test.ts`、`project/__tests__/project-editor-session.test.ts`。覆盖 v4 entity 独立 revision、CAS/replay、transaction rollback、bytes reachability/prune/delete、恢复草稿和新 change set。
- Cache/session: 把 `session/__tests__/page-runtime-cache.test.ts` 硬切为 Surface cache；更新 `projection-coordinator.test.ts`、`preview-session.test.ts`、`workbench-services.test.ts`、`design-session-layout-insert.test.ts`，证明同 asset compilation 可复用而两个 instance state 隔离。
- Protocol/host: `runtime-host/__tests__/protocol.test.ts`、`runtime-host-app.test.ts`、`runtime-host-instances.test.ts`、`preview-runtime-host-frame.test.ts`、Design frame test。删掉 Data RPC tests，新增 v7 exact-version、Surface/instance identity、late closed-instance message rejection、Project/Surface compilation mixed-version rejection。
- Export: `project/__tests__/canonical-config-export.test.ts`、`export-snapshot.test.ts`、`source-page-services.test.ts`、`preview-source-parity.test.ts`、`project/__integration__/exported-project.test.ts`。生成器 identity 改 5.0.0，执行 Page/Dialog/Drawer 和共享 Prototype Runtime；不能只断言字符串。

#### 必须新增的关键测试

- Project transfer v1 无 Resource 往返：`embeddedContents: []` 必填；裸 v6 document、v0/v2、额外内容全部拒绝。
- embedded Resource transaction：missing/duplicate/extra bytes、non-canonical base64、length/hash mismatch、预算超限时 metadata/bytes 均不写；并发失败不遗留 orphan key。
- `Surface/Dataset/Resource` entity revision 只在本实体变化时推进；undo/redo 返回精确 change set。
- Prototype Runtime Node import无 `window/document/Vue DOM`；`/vue` host覆盖 repeated same Surface、A -> B -> A、navigate/back/open/closeCurrent/closeAll、参数/结果、焦点恢复和 `instancesById` 精确可达集合。
- Runtime Host v7 对同一 `surfaceId` 的两个 `instanceId` 分别接受状态，对已关闭 instance 的 replay/late result 一律忽略。
- Workbench generator 5 生成项目安装、typecheck、test、build；确认生成项目导入共享 Prototype Runtime，模板中不存在复制 reducer。

### 9. 实施顺序建议

1. 先完成 Model repository/transfer/change-set 公共合同和 Prototype Runtime v1；否则 Workbench 会被迫定义临时 shape。
2. 切 IndexedDB v4、recovery、bytes transaction，并通过持久化测试。
3. 切 Compiler/Backend Project/Surface compilation 后，再改 Workbench design/cache/projection。
4. 最后一次性切 Runtime Host v7 parent + child + guards + tests；不能先发 writer 后留 v6 reader。
5. 适配临时 Workbench generator 5 和现有导出入口；只做硬切所需行为，不启动 Source 包迁移或 Studio 新 UI。

### 10. 文件索引

- `packages/ConfigForm/workbench/src/project/import/**` — 当前裸 Project/单 Page transfer 解析、预算、remap、预览。
- `packages/ConfigForm/workbench/src/project/persistence/**` — IndexedDB v3 manifest/entity、retention、recovery 与 autosave。
- `packages/ConfigForm/workbench/src/project/services/editor-session.ts` — Model engine/history 与 repository save 的 Workbench 边界。
- `packages/ConfigForm/workbench/src/session/**` — Page compilation cache、single-Page preview mirror、design/export coordination。
- `packages/ConfigForm/workbench/src/runtime-host/**` — Runtime Host v6 types、reader、iframe child 和 Data RPC。
- `packages/ConfigForm/workbench/src/app/components/{DesignRuntimeHostFrame,PreviewRuntimeHostFrame}/index.vue` — v6 parent writers与消息过滤。
- `packages/ConfigForm/workbench/src/project/export/**` — Workbench 私有 generator 4.0.0、Config export 与 file snapshots。
- `packages/ConfigForm/compiler/src/runtime-source/services/sources.ts` — Core/Headless/Vue Runtime 的 raw-source 收集入口。
- `packages/ConfigForm/workbench/src/adapters/services/load.ts` — 目前在 composition root 构造 Runtime 与 Source resolver。

### 11. External references

无外部资料。本结论只基于仓库当前代码、任务 PRD 和已审阅 Trellis contracts；第三方 IndexedDB wrapper 的事务语义由现有 `IndexDBStorage.updateItems` 测试约束。

### 12. Related specs

- `.trellis/spec/config-form/frontend/studio-domain-contracts.md` — 目标 shape、版本、diagnostics、测试矩阵。
- `.trellis/spec/config-form/frontend/product-boundaries.md` — Studio/Runtime/Source 职责与禁止兼容层。
- `.trellis/spec/config-form/frontend/runtime-state-boundaries.md` — form state 与 Prototype session state 分离。
- `.trellis/spec/config-form-workbench/frontend/index.md`
- `.trellis/spec/config-form-workbench/frontend/quality-guidelines.md` — 当前 Page-only exporter 与未来 Source 所有权硬切。
- `.trellis/spec/config-form-model/frontend/index.md`
- `.trellis/spec/config-form-compiler/frontend/index.md`
- `.trellis/spec/config-form-prototype-runtime/frontend/index.md`
- `.trellis/spec/config-form-source/frontend/index.md`
- `.trellis/spec/directory-structure.md`
- `.trellis/tasks/09-18-config-form-surface-foundation/prd.md`
- `.trellis/tasks/09-18-config-form-{studio-assets,studio-datasets,studio-materials,studio-interactions,source-package}/prd.md`

## Caveats / Not Found

1. **Surface transfer v1 缺少完整 wire shape。** 版本表只写了 Page transfer 2 -> Surface transfer 1，但 `studio-domain-contracts.md` 没有定义 envelope fields、依赖闭包或外部引用冲突语义。实现前必须在 task design/spec 中定型，不能照旧 Page envelope 猜测。
2. **Runtime Host v7 缺少完整 message union。** 规范给了版本号和 session 复用要求，却没有规定 design/experience sync 的 ProjectCompilation/SurfaceCompilation 分支、`surfaceId/instanceId` 必填矩阵、session command/result transport。必须先定型再同时改 parent/child/guards。
3. **Recovery Draft reader 版本未分配。** draft manifest 当前是 v1，但 payload 中的 snapshot codec 与 `ProjectChangeSet` 都会变化。若仍叫 v1，会让“精确当前版本”失去识别旧 payload 的外层身份；建议显式分配新版本，而不是依赖内层 v4 恰好报错。
4. **Resource byte repository port 未给出精确 API。** 规范只规定寻址和 Source reader input。Foundation 需要补清 create/commit/read/delete/prune 的 transaction contract、fresh-copy guarantee，以及 recovery draft 对未提交 bytes 的所有权。
5. **Workbench generator 5.0.0 与最终 SourceFileSet v1 的阶段边界存在张力。** 版本表要求 Foundation 升 Workbench generator，但 Source task才拥有最终 async resource reader/SourceFileSet。最小一致方案是 Foundation 完成 Surface/Prototype Runtime 的 generator 5 硬切并暴露稳定 repository port，Source task再一次性迁移所有权和最终输出合同；不要在两处同时实现完整 generator。
6. 当前 task `status` 仍为 `planning`，且目录中没有 `design.md/implement.md`。以上三个未定 wire/API（Surface transfer、Runtime Host v7、Recovery Draft/bytes）应先进入设计工件，再启动 implement agent。
