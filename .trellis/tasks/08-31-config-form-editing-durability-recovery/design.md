# ConfigForm 编辑持久性与故障恢复设计

## 1. 设计目标

在不改变 `ProjectDocument` 单一业务真源的前提下，为 Workbench 增加持续正式保存、崩溃恢复、版本检查点和跨标签页协调。所有持久化行为必须继续经过现有 `ProjectEditorSession -> ProjectSaveCoordinator -> ProjectRepository` 路径，CAS 与原子事务仍是最终正确性边界。

## 2. 不变量

- `ProjectDocument` 不增加 revision、草稿、保存状态、版本列表或 UI 字段。
- 一个正式 autosave 对应一次 Repository commit；一次 commit 最多推进一个 `repositoryRevision`。
- recovery draft 不是正式 revision，不能进入 Preview/Export 或替代当前 Repository snapshot。
- autosave 不修改 Model history、selection、focus 或 Undo merge group。
- BroadcastChannel 只发送 revision hint；Repository load + CAS 才能确认真实状态。
- 任何失败都优先保留数据。清理可以延后，不能因清理失败破坏当前 revision。

## 3. 现有边界

- `project-editor-session.ts` 已把 Domain cursor 与 `savedCursor` 比较为 dirty，并能固定一次保存捕获。
- `project-save-coordinator.ts` 已保证保存期间产生的新编辑不会被误标为已保存，但当前并发保存会返回 busy。
- `project-document-repository-indexed-db.ts` 已在一个 native transaction 中写入 entity、manifest 和 receipt，并通过 CAS、checksum 与幂等 command ID 防止混合 revision。
- `workbench-controller.ts` 当前只在手动命令时调用 `session.save()`，卸载时直接关闭 Repository。

这些边界继续保留。新增层负责调度和可恢复状态，不把调度逻辑散落到 Inspector、Flow、Pages 或 Designer。

## 4. 目标架构

```text
Project Command / Undo / Redo
              |
              v
     ProjectEditorSession
              |
      snapshot/changeSet
              v
  ProjectPersistenceSession
      |                  |
      |                  +--> RecoveryDraftStore
      |                       250ms idle / 1s max
      |
      +--> autosave queue
           800ms idle / 5s max
                  |
                  v
       ProjectSaveCoordinator
                  |
                  v
       ProjectVersionRepository
       entity + manifest + version + receipt
                  |
                  +--> RevisionChannel hint
```

Workbench Controller 只负责创建、切换和销毁上述 session，并把其只读 snapshot 投影给 UI。

## 5. 合同设计

### 5.1 正式提交元数据

扩展 Model Repository 合同：

```ts
type ProjectCommitSource = 'autosave' | 'manual' | 'restore'

interface ProjectCommitMetadata {
  source: ProjectCommitSource
  label?: string
  restoredFromRevision?: number
}

interface ProjectRepositoryCommitInput {
  commandId: string
  document: ProjectDocument
  expectedRepositoryRevision: number
  id: string
  metadata: ProjectCommitMetadata
}
```

提交 checksum 必须包含 metadata，防止相同 command ID 以不同来源或标签重放。

### 5.2 保存捕获身份

`ProjectSaveCapture` 增加 `editVersion` 与 `contentHash`；成功结果返回精确 `savedIdentity`：

```ts
interface ProjectSavedIdentity {
  cursor: string
  editVersion: number
  contentHash: string
  repositoryRevision: number
}
```

`ProjectEditorSession.save()` 接受保存模式：

```ts
save(options: {
  source: 'autosave' | 'manual'
  label?: string
  sealHistoryGroup: boolean
}): Promise<ProjectEditorSessionSaveResult>
```

autosave 使用 `sealHistoryGroup: false`；手动立即保存和命名检查点使用 `true`。保存成功后只清理被 `savedIdentity` 覆盖的草稿；更晚的草稿必须保留。

### 5.3 持久化调度器

新增 `ProjectPersistenceSession`，它是唯一的 autosave owner：

```ts
interface ProjectPersistencePolicy {
  autosaveIdleMs: number
  autosaveMaxWaitMs: number
  draftIdleMs: number
  draftMaxWaitMs: number
}

interface ProjectPersistenceSession {
  readonly snapshot: ProjectPersistenceSnapshot
  flush: () => Promise<void>
  createNamedCheckpoint: (label: string) => Promise<void>
  handleVisibilityHidden: () => Promise<void>
  dispose: () => Promise<void>
}
```

内部只有一个正式保存 promise。编辑期间重新触发只更新 pending identity；当前保存结束后，如果最新 identity 仍 dirty，立即进入下一轮。调度器不把正常排队交给 `PROJECT_EDITOR_SAVE_BUSY` 错误处理。

计时器、当前时间和 ID 生成器均可注入，单测使用 fake clock。

### 5.4 Recovery Draft

新增独立 Workbench 合同：

```ts
interface ProjectRecoveryDraft {
  draftId: string
  projectId: string
  sessionId: string
  baseRepositoryRevision: number
  editVersion: number
  contentHash: string
  document: ProjectDocument
  registryLock: RegistryLock
  createdAt: string
  updatedAt: string
  checksum: string
}

interface ProjectRecoveryDraftCapture extends Omit<
  ProjectRecoveryDraft,
  'checksum' | 'createdAt' | 'updatedAt'
> {
  changeSet: ProjectChangeSet
}

interface ProjectRecoveryDraftStore {
  put(capture: ProjectRecoveryDraftCapture): Promise<void>
  list(projectId?: string): Promise<ProjectRecoveryDraftSummary[]>
  get(draftId: string): Promise<ProjectRecoveryDraft | undefined>
  delete(draftId: string): Promise<void>
}
```

IndexedDB 实现使用同一数据库中的独立 key namespace，但不写正式 project manifest。Memory/volatile 实现明确标记为不可跨刷新恢复。

IndexedDB draft 不得每次写入一个完整深克隆 document。实施时从正式 Repository 抽取共享 snapshot/entity codec：draft manifest 复用 base revision 中未变化的 Page/Resource reference，只为累计 `ProjectChangeSet` 影响的实体写 draft-scoped key；无法精确归因时才保守重建全部 reference。读取 draft 时再组装并严格验证完整 `ProjectDocument`。这样正式版本、历史和草稿共用一套 checksum/parser，不形成第二个存储模型。

保存较早 capture 成功后，如果当前 edit identity 更新，调度器先以新 `repositoryRevision` 写入同一内容的新 draft manifest，事务成功后才淘汰旧基线 draft。重基线失败时保留旧 draft，进入 recoverable conflict，不能先删后写。

启动时先列出比正式 revision 更新或基于同 revision 但 contentHash 不同的 draft。完整读取后再次验证 checksum、schema、project ID 和 Registry lock，失败时展示诊断，不自动应用。

### 5.5 版本检查点

扩展 Repository：

```ts
interface ProjectVersionSummary {
  projectId: string
  repositoryRevision: number
  source: ProjectCommitSource | 'migration'
  label?: string
  contentHash: string
  createdAt: string
}

listVersions(projectId: string): Promise<ProjectVersionSummary[]>
getVersion(projectId: string, revision: number): Promise<PersistedProjectEnvelope | undefined>
setVersionLabel(input: {
  projectId: string
  revision: number
  label?: string
  expectedRepositoryRevision: number
}): Promise<void>
pruneVersions(projectId: string, policy: ProjectVersionRetentionPolicy): Promise<void>
```

命名当前 clean revision 只更新版本元数据，不创建空 revision。label 必须 trim、限制为 1-80 字符并拒绝控制字符；传入 `undefined` 表示取消命名，版本随后按普通自动版本策略保留。恢复流程读取目标版本、验证后，以当前最新 revision 为 CAS 基线提交目标 document，metadata 使用 `source: 'restore'` 与 `restoredFromRevision`，然后重新打开 Editor Session。旧当前版本和目标版本均保留。

### 5.6 跨标签页通知

`ProjectCoordinationChannel` 使用 `BroadcastChannel`。revision 消息只包含：

```ts
{
  protocolVersion: 1
  projectId: string
  repositoryRevision: number
  sourceSessionId: string
  committedAt: string
}
```

收到消息后先比较 revision，再通过 Repository 读取确认：

- 本地 clean：自动载入最新 revision，尽量保持 current page。
- 本地 dirty：暂停 autosave，先固定 recovery draft，进入 conflict 状态。
- 乱序、重复、自身消息：忽略。
- 不支持 BroadcastChannel：不降级为错误；下一次 CAS 仍能发现冲突。

dirty 冲突只提供三条非破坏路径：查看最新、放弃本地并载入最新、把本地 draft 另存为新 project identity。本任务不做字段级 merge。

同一 versioned channel 还支持不携带项目数据的 `presence:query` / `presence:reply`。恢复发现时短暂查询 draft 的 `sessionId` 是否仍存活；收到 reply 的 active draft 不进入“崩溃恢复”列表，而显示为其他标签页正在编辑。无 BroadcastChannel 或超时只能得到 unknown presence，UI 可提示但不得自动恢复、覆盖或删除。

## 6. Repository 存储设计

IndexedDB manifest 升级为 v3：

```text
StoredProjectManifestV3
  snapshot   -> 当前正式 revision
  versions[] -> 可浏览的 snapshot manifest + metadata
  receipts[] -> 幂等 commit receipt
  checksum
```

一次正式 commit 在同一事务中写入：

1. 新增或变化的 Page/Resource entities；
2. 当前 snapshot manifest；
3. version entry；
4. commit receipt；
5. 顶层 manifest checksum。

v2 -> v3 迁移先完整解析 v2 manifest 与所有被引用 entity，使用当前 snapshot 和可用 receipt snapshots 建立 migration version entries，再原子替换 manifest。验证失败不写任何数据，也不删除源记录。

manifest schema version 与 entity codec version 必须分离。v3 manifest 可以继续引用已通过 checksum 验证的 v2 Page/Resource entity；只要 entity payload 格式未变化，就不因 manifest 升级重写全部实体。entity parser 接受明确列出的已知 codec version，未知版本仍 fail closed。

迁移采用 compare-and-replace：事务内重新读取 manifest checksum；仍是相同 v2 时写 v3，已被另一标签升级为合法 v3 时直接采用，checksum 或 revision 已发生其他变化时重新读取并计算。迁移不能依赖数据库 versionchange，因为当前应用在一个 object store 内管理业务 schema。

## 7. 保留与清理

默认策略：

- 最近 50 个 autosave revision；
- 最近 30 天每天一个自动锚点；
- 所有命名检查点；
- 当前 revision；
- 所有仍在 receipt window 中被引用的 snapshot；
- 所有通过 checksum/schema 验证的 recovery draft manifest 及其正式/draft entity reference；
- restore 产生的 revision 按 autosave/manual 规则保留；只要 restore entry 仍被保留，其 `restoredFromRevision` 目标也必须可读。

清理使用 mark-and-sweep：先枚举 candidate key，再在包含正式 manifest、draft manifests 与 candidate keys 的同一 readwrite transaction 中重新读取最新状态，从 current、versions、receipts、有效 recovery drafts 收集 reachability 后删除仍不可达的 key。新 commit/draft 在枚举后产生的 key不在 candidate 集合中，因此不会被误删；manifest 在事务前变化时以事务内最新值为准。清理只在成功 commit 后的 idle 阶段运行；失败只产生 diagnostic，下次重试，不回滚已成功 commit。

## 8. 页面生命周期

- `visibilitychange -> hidden`：立即请求 draft flush，不强制正式 commit。
- `pagehide`：best-effort draft flush；不宣称异步 IndexedDB 一定完成。
- `beforeunload`：仅当当前 edit identity 未被正式 revision 或 durable draft 覆盖，或最近持久化失败时注册提示。
- `onBeforeUnmount`：同步停止 timer/channel 和新请求，启动异步 dispose；项目切换只销毁 persistence session，不关闭 Controller 共享的 Repository。Workbench 卸载时由 Controller 在 draft/save in-flight settled 后关闭 Repository，Vue unmount 本身不被假定会等待 promise。

持续写入 recovery draft 是安全主线，卸载事件只是补充。

## 9. UI 状态

`ProjectPersistenceSnapshot` 至少包含保存状态与独立的 draft coverage。保存状态区分：

- `pending`：等待 autosave；
- `saving`：正式 commit 中；
- `saved`：最新 edit identity 已正式保存；
- `failed`：正式保存失败但 draft 可恢复；
- `conflict`：检测到外部 revision，autosave 已暂停；
- `volatile`：当前 Repository 不可跨刷新持久化。

`draftCoverage` 区分 `none / pending / durable / failed`，`beforeunload` 和恢复提示依据 edit identity coverage 判断，不能仅凭保存状态猜测。

顶栏显示 `v{repositoryRevision}` 与“正在自动保存 / 已自动保存 / 保存失败”等文本，并通过 `aria-live` 发布变化。保存按钮改为菜单：立即保存、创建命名检查点、查看版本历史。

恢复 dialog 展示 draft 时间、基线 revision、页面/节点变化摘要和诊断。版本历史 dialog 以只读 Runtime/Config 摘要检查目标版本，恢复前明确说明会创建新 revision。

## 10. 故障策略

| 故障 | 行为 |
| --- | --- |
| QuotaExceeded / transaction abort | 正式 revision 不变；保留内存状态和已有 draft；进入 failed |
| 保存期间继续编辑 | 当前 capture 正常提交；最新 identity 排入下一轮 |
| draft 写入失败 | 不伪装可恢复；必要时启用 beforeunload |
| CAS conflict | 暂停 autosave；固定 draft；进入 conflict |
| 版本 checksum/schema 失败 | 禁止预览/恢复；当前项目不变 |
| BroadcastChannel 重复/乱序 | 忽略；不触发重复 reload |
| GC 失败 | commit 仍有效；记录 diagnostic，稍后重试 |
| volatile repository | 允许编辑但持续显示临时会话警告 |

底层 IndexedDB error 必须沿 `cause` 链归一化为稳定 diagnostic，例如 quota、transaction aborted、corrupt、conflict 和 unavailable；UI 与测试不得依赖浏览器本地化错误文本。

## 11. 性能边界

- draft capture 只读取 immutable snapshot identity 和累计 change set，不同步调用完整 `assertProjectDocument` 或 `structuredClone`。
- 2000 节点 fixture 下，主线程 capture p95 小于 4ms；任何单个新增 long task 不得超过 16.7ms。
- draft entity 编码和 IndexedDB 提交在 Canvas pointer/typing 关键路径之外排队；`requestIdleCallback` 仅作为调度优化，1s max wait 仍由可注入 timer 保证。
- version list 只加载 summary；目标 snapshot、Runtime 和 Config 投影在用户打开具体版本时按需加载。

## 12. 兼容性与回滚

- `ProjectEditorSession.save()` hard cut 为必填显式保存模式，不保留无参数旧入口；Workbench 生产入口全部切到 `ProjectPersistenceSession`。
- Memory Repository 与 IndexedDB Repository 必须同时实现版本合同，避免测试与生产语义分叉。
- 存储升级采用 v2 read + v3 write；不提供 v3 向旧代码的降级写入。
- 若 UI 集成需要回滚，可关闭 autosave policy 并恢复手动 flush，但 v3 Repository 和已写版本仍保持可读，不能回退存储格式或删除版本。
