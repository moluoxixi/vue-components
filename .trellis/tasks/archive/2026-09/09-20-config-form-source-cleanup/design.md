# ConfigForm Source 收尾技术设计

## 1. 边界与原则

本任务不再增加导出能力，而是收紧已经完成的所有权切分：

```text
ProjectCompilation
  -> @moluoxixi/config-form-source
       -> RawSourceFileSetV1       (默认，原生 Vue/UI 工程)
       -> ConfigBindingFileSetV1   (可选，仅 ConfigForm 绑定配置)
  -> Workbench ExportSnapshot      (同一次 compilation 的内存快照)
  -> ConfigFormSourceViewer / copy / single-file download / Source ZIP
```

Source 继续拥有生成和只读查看；Workbench 只拥有组合、快照和下载命令；Core 只拥有通用值引用及 Data Source 执行合同。任何旧实现都采用物理删除，不提供 deprecated alias、wrapper、双读或迁移分支。

## 2. ExportSnapshot 收敛

收敛后的快照形态为：

```ts
interface ExportSnapshot {
  readonly compilation: ProjectCompilation
  readonly rawSource: RawSourceFileSetV1
  readonly configBindings: ConfigBindingFileSetV1
}
```

`isExportSnapshotStale(snapshot, current)` 只比较：

- `ProjectCompilation.key` 的 project/content/registry/compiler/environment/IR identity；
- committed `editVersion` 或 draft `baseEditVersion + draftId`。

`generatorVersion` 不表达可持久化协议，也无法跨页面重载保持意义；生成代码变化会随应用 bundle 重载并重建内存 Session。文件集结构继续由 `SourceFileSetV1.version` 验证，因此删除该字段不会降低兼容性或 stale 正确性。

刷新仍采用先完整生成双文件集、成功后一次发布的原子流程。失败保留旧 snapshot 与错误，不发布半套 raw/bindings 文件。

## 3. Source archive 命名

ZIP API 硬切为：

```ts
interface SourceArchiveInput {
  files: readonly SourceFile[]
  name: string
}

createSourceArchive(input: SourceArchiveInput): Promise<Uint8Array>
downloadSourceArchive(input: SourceArchiveInput): Promise<string>
```

内部 `downloadArchive` 同样使用 `SourceArchiveInput`。导出 Dialog、export barrel 与测试一次性迁移，旧 Workspace 符号不继续导出。archive 保持现有安全 slug、text/binary 精确字节和 zip level，不改变用户可见文件内容。

## 4. Response 语义硬切

Core 当前 `$event` 实际承载 HTTP response，与已删除的事件系统同名。硬切映射为：

| 旧合同 | 新合同 |
| --- | --- |
| `kind: 'event'` | `kind: 'response'` |
| `ConfigFormValueContext.event` | `ConfigFormValueContext.response` |
| `$event` | `$response` |
| `usesEvent` | `usesResponse` |

Data Source runtime 在请求完成后只注入 `response`。Reader/表达式校验明确拒绝旧 kind 和 `$event`；不增加兼容读取。扫描门禁只覆盖 Core value-reference 与 Data Source response 注入点，避免误伤 Vue 模板 `$event`、组件监听、`getValueFromEvent`、Runtime Host pointer 事件和 Prototype Interaction。

因为这是 `@moluoxixi/config-form-core` 的公开破坏性合同变化，增加独立 minor Changeset，并在 README 中说明 response 上下文。Source 继续使用其生成器内部 `result` 语义，不做无意义的统一改名。

## 5. 文档归属与防回生

- Designer `state-management.md` 不再维护导出实现细节，只保留到 Workbench Source export 合同的引用或删除过时章节。
- Workbench `quality-guidelines.md` 成为内存快照、双文件集和下载一致性的权威规范。
- Core architecture、Studio domain contracts 与 ROADMAP 删除 `5.0.0` 和旧 Workspace/Config editor 叙述，改用 `SourceFileSetV1`、`rawSource`、`configBindings`。
- Workbench architecture test 增加已删除 generator/viewer 路径以及旧 archive 符号；Core 测试增加旧 response-as-event 合同的精确负向断言。
- 历史归档任务、历史 Changeset 和 git 历史保留原文，它们不是当前 API。

## 6. 脏工作区策略

当前 `messages.ts`、download service/types/tests 等文件同时含用户 JSON 导入导出改动。实现时逐文件读取当前内容，只对本任务符号做最小 hunk 修改；提交使用显式 path/hunk 审核，禁止整文件还原或把所有工作区修改一次性暂存。

## 7. 验证与回滚

先运行 Source/Core/Workbench 定向单测和类型检查，再运行 ConfigForm 架构门禁与 Source E2E。完整 Playwright 作为外部基线复核：本任务不得新增失败，但不通过盲目更新截图修复已有 21+16 项漂移。

代码改动可以按三组原子回滚：

1. snapshot version 删除；
2. Source archive 硬改名和消费者迁移；
3. Core response 语义硬切与 Changeset。

任一组回滚必须连同对应类型、barrel、消费者、测试和规范一起回滚，不能留下双合同。
