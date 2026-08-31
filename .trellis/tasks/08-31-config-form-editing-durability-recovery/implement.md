# ConfigForm 编辑持久性与故障恢复实施计划

## 1. 实施顺序

### 1.1 固化测试基线与公共合同

- 为 `ProjectEditorSession`、`ProjectSaveCoordinator` 和两种 Repository 建立 fake clock、deferred commit、可注入 ID 的测试夹具。
- 扩展 `ProjectRepositoryCommitInput`、commit checksum、保存捕获与成功 identity。
- 确认 autosave 模式不调用 `sealHistoryGroup()`，手动模式继续封闭 merge group。
- 为新增 diagnostic code 建立稳定枚举和中英文映射。
- 扩展 IndexedDB error cause 归一化，稳定区分 quota、transaction abort、unavailable、corrupt 与 conflict。

### 1.2 Repository v3 与版本 API

- 同步扩展 Memory/IndexedDB Repository 的 version summary、list/get/setLabel/prune 合同。
- 为 IndexedDB 增加 v2 parser 与 v3 manifest；实现验证后原子迁移。
- 拆分 manifest schema version 与 entity codec version，验证 v3 manifest 可安全复用已知 v2 entity。
- 抽取正式版本与 draft 共用的 snapshot/entity codec，禁止复制 checksum/parser 实现。
- 正式 commit 在同一事务中发布 entity、current snapshot、version entry 和 receipt。
- 实现命名当前 revision、非破坏性 restore 所需读取与 CAS 提交。
- 实现把 current、versions、receipts 和 recovery drafts 都纳入 root 的 mark-and-sweep；先测试再接 idle 清理。
- 增加两连接并发 migration/commit/GC 测试，证明事务内重新读取 manifest 后不会误删新引用。

### 1.3 Recovery Draft Store

- 实现 memory 与 IndexedDB draft store、共享 entity codec、严格 parser 和 summary；按累计 change set 复用未变化实体。
- 覆盖 put/get/list/delete、损坏记录、Registry/schema 不兼容和多个 session draft。
- 实现只清理被 `savedIdentity` 覆盖的 draft，禁止误删更新草稿。
- 实现较新 draft 在正式保存成功后的写后切换重基线，失败时旧 draft 保持可读。

### 1.4 ProjectPersistenceSession

- 实现 250ms/1s draft scheduler 和 800ms/5s autosave scheduler。
- 保存状态与 `draftCoverage` 分开建模，离开保护按当前 edit identity 是否已被正式 revision 或 durable draft 覆盖判断。
- 实现 single-flight save loop、pending identity、失败重试边界和 deterministic dispose。
- 接入立即保存与命名检查点；持续输入不得产生每按键 revision。
- 增加状态机单测，覆盖保存期间编辑、Undo/Redo、无效 transaction、retry 和 timer race。
- 增加 2000 节点 capture/serialization benchmark 与 long-task/交互预算断言。

### 1.5 跨标签页协调

- 实现 versioned `ProjectCoordinationChannel`、revision/presence 消息与无 BroadcastChannel fallback。
- clean session 自动加载最新 revision；dirty session 暂停 autosave并固定 draft。
- 实现放弃本地、查看最新、draft 另存新项目三条冲突路径。
- 使用两个 Repository connection/session 测试重复、乱序、同时首次保存和关闭竞态。
- 测试 active/unknown/crashed draft presence，任何不确定状态都不得自动恢复或删除。

### 1.6 Workbench 生命周期与 UI

- Controller 在 open/switch/dispose project 时创建和销毁 persistence session；异步 dispose 接管 Repository close ownership。
- 接入 `visibilitychange`、`pagehide` 和条件式 `beforeunload`。
- Topbar 将 `r0` 改为 `v{revision}`，状态改为 autosave 语义；保存按钮改为菜单。
- 新增 Recovery 与 Version History dialog，复用 dialog focus helper、Runtime/Config 只读投影和现有 locale contract。
- 移除“冲突只能重新加载并丢弃本地修改”的旧提示路径。

### 1.7 完整验证与清理

- 执行 Repository、session、controller、dialog、两标签页和浏览器故障矩阵。
- 在 1440/900/390、Light/Dark、zh-CN/en-US 下跑视觉与 axe 验收。
- 检查 `ProjectDocument`、Compiler、RuntimeHost 和 Export identity 未引入 persistence metadata。
- 完成 spec 更新、变更说明和存储升级回滚说明后再提交。

## 2. 重点测试矩阵

| 层级 | 场景 |
| --- | --- |
| SaveCoordinator | fixed capture、newer edits、同一时刻单飞、metadata checksum、失败重试 |
| EditorSession | autosave 不 seal history、manual seal、savedIdentity 精确、dirty 计算 |
| Repository | v2->v3、原子 commit、版本读取/命名/restore、receipt replay、CAS、quota/partial failure |
| DraftStore | entity 复用、debounce、checksum、损坏、重基线、多个 session、volatile |
| PersistenceSession | 100 次输入、max wait、save-during-edit、timer race、dispose |
| Cross-tab | clean reload、dirty pause、fork draft、active draft presence、重复/乱序消息、无 BroadcastChannel |
| Migration/GC | 双连接 v2->v3、current/version/receipt/draft 可达性、命名 pin、并发 commit、不可达实体回收 |
| Performance | 2000 节点 capture p95、无完整同步 parse/clone、无新增 long task、拖拽/输入帧预算 |
| UI/E2E | 状态、菜单、恢复、历史、焦点、beforeunload、1440/900/390、Light/Dark、双语 |

## 3. 验证命令

```bash
pnpm --filter @moluoxixi/config-form-model test
pnpm --filter @moluoxixi/config-form-model typecheck
pnpm --filter @config-form/workbench test
pnpm --filter @config-form/workbench typecheck
pnpm --filter @config-form/workbench build
pnpm --filter @config-form/workbench test:e2e
pnpm lint
git diff --check
```

如果 Workspace filter 名称与当前 package manifest 不一致，以 manifest 中的真实 `name` 为准调整命令，但不得跳过对应包测试。

## 4. 高风险文件与检查点

- `packages/ConfigForm/model/src/repository.ts`：公共 Repository 合同；Memory 与 IndexedDB 必须同构。
- `packages/ConfigForm/workbench/src/project/project-document-repository-indexed-db.ts`：存储 schema、migration、atomicity 和 GC。
- `packages/ConfigForm/workbench/src/project/project-save-coordinator.ts`：幂等与 capture identity。
- `packages/ConfigForm/workbench/src/project/project-editor-session.ts`：dirty、history merge 与保存边界。
- `packages/ConfigForm/workbench/src/app/workbench-controller.ts`：session 生命周期和跨标签页竞态。
- `packages/ConfigForm/workbench/src/app/WorkbenchTopbar.vue`：状态/命令 UI，不得重新拥有保存状态机。

每完成一个检查点必须运行该层定向测试；Repository v3、autosave session、跨标签页和 UI 集成分别保持可回滚提交边界。

## 5. 实施前门禁

- [x] PRD、design、implement 已通过最终评审并获得新的实施批准。
- [x] 当前工作树中的用户修改已识别，不覆盖无关变更。
- [x] `trellis-before-dev` 已加载相关 spec。
- [x] 存储 v2 fixture、quota/abort fixture、fake clock 和双连接 fixture 已准备。
- [x] 明确禁止通过真实延时、console-only 错误或字符串测试代替状态机与浏览器断言。

## 6. 本轮完成与验证

- [x] Repository v3、版本历史、非破坏性恢复、GC、recovery draft、autosave、跨标签页协调和 Workbench 生命周期已实现。
- [x] Light/Dark、zh-CN/en-US、1440/900/390、RuntimeHost Preview、只读导出和无障碍路径已通过浏览器验收。
- [x] Designer Canvas 的键盘目标在首次渲染前注册；目标解析暂不可用时，Palette 使用同一 candidate ID 做短暂可取消重试。
- [x] `pnpm --filter @moluoxixi/config-form-model test`（53/53）与 `typecheck` 通过。
- [x] `pnpm --filter @config-form/workbench test`（185/185）、`typecheck`、`build` 通过。
- [x] 键盘/触控拖拽用例重复 20 次通过；完整 `test:e2e` 23/23 通过。
- [x] 全仓 `pnpm lint` 与 `git diff --check` 通过。
