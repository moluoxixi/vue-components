# ConfigForm 编辑持久性与故障恢复

## 目标与用户价值

把 ConfigForm Workbench 从“依赖用户手动保存的本地演示工具”提升为能够承受长时间编辑、刷新、崩溃、存储失败和多标签页并发的生产级 Design-first Low-Code IDE。用户的有效设计修改应当自动持久化；发生异常时，应能明确判断哪些内容已保存、哪些内容可恢复，并在不破坏当前版本的前提下回到历史检查点。

## 已确认事实

- `ProjectDocument` 是唯一业务内容，`ProjectSnapshot` 只绑定编辑版本与内容身份；持久化元数据不进入页面模型。
- `ProjectEditorSession` 已用 cursor 与 saved cursor 计算 dirty，并通过 `ProjectSaveCoordinator` 固定保存捕获；保存期间产生的新编辑不会被误标为已保存。
- IndexedDB Repository 已具备分实体原子事务、CAS、命令幂等 receipt、checksum 校验和配额失败整笔回滚；不需要为 autosave 新建第二套项目模型。
- 当前 Workbench 只在用户点击保存按钮时调用 `session.save()`；组件卸载时直接关闭 Repository，没有 autosave、`beforeunload`/`pagehide` 离开保护或崩溃草稿恢复。
- 当前多标签页只在 commit 时通过 CAS 发现冲突；没有跨标签页 revision 通知。冲突 UI 只能重新加载最新持久化版本，并明确丢弃本地未保存编辑。
- IndexedDB 使用 revisioned Page/Resource entity key，receipt 也保留历史 snapshot manifest，但目前没有公开的版本索引、恢复合同或不可达实体清理策略。
- GrapesJS Storage Manager 默认支持按变更步数 autosave/autoload；Figma 持续更新当前版本、定期建立 autosave checkpoint，并为断网或崩溃保留恢复点。生产级编辑器不能把“用户记得点击保存”作为数据安全边界。

## 产品决策

- autosave 直接推进正式项目 revision，不再把“手动保存”作为正式持久化的必要步骤。
- 原保存入口调整为“立即保存 / 创建命名检查点”；立即保存 flush 当前 autosave，命名检查点在存在 dirty 时命名同一次正式 commit，在内容未变化时命名当前正式 revision。
- 恢复草稿仍独立于正式 revision，只覆盖 autosave 尚未成功的崩溃窗口，不承担发布语义。

## 范围内需求

### R1. 自动保存合同

- 有效 Project Transaction 应自动触发合并保存；连续输入不得每次按键都创建独立持久化 revision。
- autosave 默认使用 800ms 空闲 debounce 和 5s 最大等待时间；二者通过可注入 policy 配置和测试，持续编辑也必须在 5s 内形成中间安全 revision。
- 同一时刻只允许一个保存事务；保存期间的新编辑在当前事务成功后继续排队，不得丢失或被错误标记为已保存。
- Undo/Redo、页面操作、Flow、Inspector 和拖拽都走同一 autosave 合同，不允许 UI 调用方各自实现保存逻辑。
- autosave 不得切断 Undo merge group、改变焦点或新增 Model history；手动命名检查点可以显式封闭当前 merge group。
- 手动“立即保存”只 flush 当前队列；“创建命名检查点”在存在 dirty 时先提交并命名新 revision，在内容未变化时直接命名当前正式 revision，不伪造空内容 revision。

### R2. 会话草稿与异常恢复

- 正式 autosave 尚未完成时，当前会话应保存独立 draft identity；刷新、崩溃或进程异常后可检测比正式 revision 更新的草稿。
- recovery draft 默认使用 250ms 空闲 debounce 和 1s 最大等待时间，绑定 project、session、base revision、edit identity、checksum 和 Registry lock。
- 恢复入口必须展示项目、页面、时间、基线 revision 和差异摘要；用户可选择恢复或丢弃，不得静默覆盖正式项目。
- 草稿成功合并为正式 revision 后应清理；过期、损坏、Registry 不兼容或 schema 不匹配的草稿 fail closed 并给出可操作诊断。
- autosave 只覆盖较早 capture 时，更新的 recovery draft 必须在不产生无保护窗口的前提下重基线到新正式 revision；重基线失败时保留旧 draft 并报告可恢复冲突。
- volatile storage 模式不得伪装为可恢复；界面必须持续说明刷新会丢失数据。
- `visibilitychange/pagehide` 只做 best-effort flush，数据安全依赖持续草稿而不是卸载时异步写入；仅当当前修改尚未被正式 revision 或 durable draft 覆盖时注册 `beforeunload` 提示。

### R3. 版本检查点与非破坏性恢复

- 用户可以浏览带时间与来源的项目检查点，并以只读方式检查目标版本。
- 恢复历史版本必须创建新的当前 revision，保留恢复前版本；不得覆盖或删除现有历史。
- 自动检查点与用户命名检查点使用明确保留策略；被历史索引或 receipt 引用的实体不得提前清理，不可达实体必须可确定性回收。
- 默认保留最近 50 个 autosave revision、最近 30 天每天一个自动锚点；命名检查点在用户显式删除前保留。当前 revision、可见检查点和幂等 receipt 引用始终优先于清理策略。
- 有效 recovery draft manifest 引用的正式或 draft entity 同样属于可达数据；命名检查点支持重命名和取消命名，取消后按普通自动版本保留策略处理。
- 版本读取与恢复必须验证 schema、checksum 和 Registry lock，损坏历史不能进入当前编辑会话。

### R4. 多标签页协调与冲突恢复

- 同一浏览器中的其他标签页提交新 revision 后，当前标签页应立即获知，而不是等下次保存才发现。
- 本地无修改时自动载入最新 revision 并保持当前页面；本地有修改时必须停止 autosave、固定 durable draft，并提供查看最新版本、放弃本地修改或把本地草稿另存为新项目的显式路径。
- 不做隐式 last-write-wins，也不把整份 ProjectDocument 做不透明覆盖。
- 重复通知、乱序通知、标签页关闭和通信能力不可用时必须保持 CAS 正确性。
- 恢复发现必须区分已崩溃 session draft 与仍由其他标签页持有的 active draft；无法确认 presence 时只提示用户检查，不得自动恢复或删除。

### R5. 状态与交互

- 顶栏状态至少区分：正在保存、已保存、存在未保存修改、保存失败、离线/临时存储、检测到外部 revision、存在可恢复草稿。
- 顶栏使用“正在自动保存 / 已自动保存 / 保存失败”等用户语义；版本显示采用 `v{revision}`，不再暴露含义不明的 `r0`。
- 手动命令、键盘快捷键、恢复 dialog、版本历史和错误反馈在 Light/Dark、zh-CN/en-US、1440/900/390 下均可完成。
- 状态变化需通过 `aria-live` 或等价合同可访问；dialog 必须管理焦点、Escape 和关闭后的焦点恢复。
- Preview、Design 和 Export snapshot 的 revision 语义保持不变；持久化状态不得进入 Canvas Runtime DOM。

### R6. 故障与可观测性

- 覆盖 IndexedDB 不可用、配额不足、事务中止、损坏记录、重复 commit、保存期间继续编辑、刷新、崩溃恢复和跨标签页冲突。
- 保存与恢复失败必须保留仍可恢复的数据，并提供稳定 diagnostic code；不得只记录 console error。
- autosave、draft、checkpoint 和清理操作需要确定性的状态机与时钟注入，以便单元测试而不是依赖真实延时。
- 2000 节点页面的 draft 调度不得在主线程重复完整 parse/clone ProjectDocument；capture 回调 p95 低于 4ms，后台持久化期间 Canvas pointer/typing 不得出现超过一帧的新增阻塞。

## 验收标准

- [ ] 以 50ms 间隔连续 100 次 Inspector 输入时，5s 内形成中间正式 revision，停止输入后 800ms policy window 内完成最终 autosave，且不会按每次按键创建 revision。
- [ ] 连续编辑超过最大等待时间时，在用户未停手的情况下仍会产生中间安全 revision，且编辑焦点和 Undo merge group 不受影响。
- [ ] 保存事务未完成时继续编辑，首次保存只确认捕获的 cursor，后续修改自动进入下一次保存并最终清空 dirty。
- [ ] 首次保存提交较早 capture 后，较新的 durable draft 原子重基线到新 revision；在重基线写入失败时旧 draft 仍可读取。
- [ ] 刷新或模拟崩溃后能够检测、预览、恢复或丢弃较新的草稿；恢复和丢弃均不会破坏最后正式 revision。
- [ ] 历史版本可列出、只读检查并非破坏性恢复；恢复前后的版本都能再次读取。
- [ ] 两标签页同时编辑时，外部 revision 会即时提示；无修改标签页可安全更新，有修改标签页不会自动覆盖任一方。
- [ ] QuotaExceededError、第二条实体写入失败和 manifest 写入失败均不会暴露混合 revision，重试后可成功保存。
- [ ] 历史保留和清理后，所有可见 checkpoint、receipt 和有效 recovery draft 引用仍可读取，不可达实体不再无限增长；命名检查点可重命名或取消命名。
- [ ] 两标签页并发执行 v2->v3 migration、commit 与 GC 时，迁移幂等、GC 不删除最新 manifest 引用，关闭页面也不会提前关闭仍有写入的 Repository。
- [ ] 2000 节点页面连续编辑时，draft capture 主线程 p95 低于 4ms，autosave/draft 写入不新增长任务或拖拽掉帧。
- [ ] 1440/900/390、Light/Dark、zh-CN/en-US 下保存、恢复、版本和冲突路径无溢出、遮挡或焦点丢失，并通过 axe WCAG 2 A/AA。
- [ ] Workbench 单测、Model/IndexedDB 定向测试、typecheck、production build、Playwright、全仓 lint 和 `git diff --check` 全部通过。

## 范围外

- 服务器端账户、云同步、多人实时协同、OT/CRDT 和跨设备版本合并。
- 导入历史 Vue 项目或把 Source/Config 反向写回 Design。
- 修改 `ProjectDocument` 以保存 UI 状态、Repository revision、草稿或生成文件。
- 为 autosave 引入远程数据库或新后端服务。
