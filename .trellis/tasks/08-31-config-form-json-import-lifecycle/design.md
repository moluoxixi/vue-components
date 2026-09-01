# 技术设计

## 总体边界

```text
paste / File.text()
        |
        v
source budget + JSON.parse
        |
        v
iterative structural guard
        |
        v
version discriminator -> explicit migration -> current Zod schema
        |
        v
adapter + Registry contract analysis / supported component migrations
        |
        v
fresh identity instantiation -> schema revalidation -> compile preview
        |
        +-------------------+
        |                   |
 Repository create      one page.add Project Command
   (project target)         (page target)
```

Import 是 Workbench project ingress，不进入 Model Repository 的通用读取路径。Repository 继续只接收当前 `ProjectDocument`；旧协议、原始字符串、UI 状态与迁移诊断都不得进入持久化模型。

## 模块划分

### `src/project/import/`

- `types.ts`：`ConfigImportTarget`、稳定 diagnostic code、migration record、summary、prepared result。
- `guard.ts`：文本字节、深度、数组、总结构项、污染键、页面和节点预算；使用显式栈，避免对不可信输入递归遍历。
- `migrations.ts`：严格的 Project v3→v4 与旧 Page Model v1→当前 PageGraph v2。迁移输入先通过专用 Zod schema，输出再走当前 schema。
- `identity.ts`：基于现有 `remapTemplatePageIdentity` 组装 project/page fresh-instance remap；Project settings/resources 只 clone，不扫描不透明 JSON 猜测引用。
- `service.ts`：识别 payload、迁移、兼容分析、组件 migration、compile preview，并返回不可变 prepared result。
- `index.ts`：唯一 project import 出口。

现有 `identity-remap.ts` 去掉 Template 专属命名，保留兼容导出别名，避免模板和导入维护两套复杂引用重写。

### `src/features/create/`

- `CreationWorkspace.vue`：统一 header、目标标题、模板/JSON tabs、主题/语言、关闭与焦点合同。
- 当前模板目录主体拆为 `TemplateCatalogPane.vue`，行为保持不变。
- `JsonImportPane.vue`：粘贴/文件输入、分析状态、摘要、diagnostics、迁移清单、隔离预览和确认创建。

`App.vue` 只在 `designer | create` 间切换，不理解 import parser。模板与 JSON pane 都只调用 controller 的正式创建方法。

### Export 对称性

`ExportDialog.vue` 的 JSON/Tree 模式增加 `project | page` scope。Project 值仍是捕获快照的完整 document；Page 值是同一快照中由当前 page id 指定的 `ProjectPage`。复制、tree 与下载共享同一个 computed 值，避免展示与下载不同 revision。

## Wire Format 与迁移

### 当前 Project JSON

顶层含 `schemaVersion: 4`，完整通过 `parseProjectDocument`。创建前将 project id 和所有页面内身份实例化为新值，Registry lock 由兼容分析后的当前 adapter lock 重建为实际使用组件集合。

### Project v3

仅接受历史 `LegacyProjectDocumentV3` 结构。每页：

1. 若 `graph.flows` 与 `page.flows` 同时存在，返回 `IMPORT_FLOW_OWNERSHIP_AMBIGUOUS`。
2. 将唯一 Flow 所有权移动到 `page.flows`，删除 `graph.flows`。
3. 设置 `schemaVersion: 4` 并通过当前 parser。

### 当前 Page JSON

接受严格 `ProjectPage`，其 `graph.version` 必须为 2。页面导入不含 adapter 身份，使用当前项目 Registry lock 逐组件预检。

### Page Model v1

接受历史树形 `LowCodePageModel`：`nodes/children/slots/span`。迁移先检查重复 node id、field 节点子树、default slot 双重所有权，再展平为 `nodesById/root/placement`；Flow 迁到 `ProjectPage.flows`。输出通过 `projectPageSchema`。

其他 version、旧 Workspace Application、DesignerDocument 和 Source Config 都返回明确 unsupported diagnostic，不使用 shape 猜测降级。

## 安全与资源预算

`guard.ts` 在 Zod 前以 stack 遍历 `JSON.parse` 结果：

- `MAX_IMPORT_SOURCE_BYTES = 2 * 1024 * 1024`
- `MAX_IMPORT_DEPTH = 64`
- `MAX_IMPORT_ARRAY_LENGTH = 4096`
- `MAX_IMPORT_STRUCTURE_ENTRIES = 100000`
- `MAX_IMPORT_PAGES = 128`
- `MAX_IMPORT_NODES = 4096`

遍历时检查 own enumerable keys，拒绝 `__proto__`、`prototype`、`constructor`。大小按 `TextEncoder` UTF-8 字节计算；File 在 `text()` 前先用 `file.size` 快速拒绝，读后再次按文本字节确认。JSON parse 后不使用 object spread 进入普通原型对象，直到 guard 和 schema 均通过。

## Registry 与组件迁移

- Project target 根据 lock adapter 加载现有 adapter；只允许 `element-plus | antd-vue`。
- `componentRegistry.analyzeLock` 的 missing/unsupported/fingerprint diagnostics 为阻塞错误。
- 若唯一差异是 `MODEL_REGISTRY_COMPONENT_MIGRATION_REQUIRED`，逐节点调用 `migrateNode`；每一步已经由 Model 验证确定性、id/component/kind 不变。完成后以实际使用组件生成新的 Registry lock，再 compile 全项目。
- Page target 要求每个组件同时存在于 current project lock 与 available Registry，且两者 version/fingerprint 相同；Page JSON 没有来源 lock，因此不虚构 migration 起点。

## 身份与语义保持

将现有 remapper 泛化为 `remapProjectPageIdentity`，覆盖：

- page、node、field、reaction、Flow、Flow node、Flow edge id；
- root/slot hierarchy；
- compare validation field；
- condition/reaction operand/effect target；
- Flow trigger field/node、edge source/target、typed condition/reaction config。

Project import 对每页分别 remap，并同步 `pageOrder/homePageId/pagesById`。资源属于新 Project 命名空间，保持 id 和 opaque metadata 原样；这比扫描任意 JSON 字符串替换更安全且无跨项目冲突。

测试通过注入 identity factory 获得完全确定的 mapping；生产 factory 使用 `crypto.randomUUID` 并保证本次实例内唯一。Round-trip 比较使用 identity-normalized canonical document，不把“创建独立实例”误报为语义差异。

## Preview 与异步一致性

提取模板和导入共享的 `prepareIsolatedProjectPreview`：输入已验证的 ProjectDocument、pageId、adapter，输出 `PageCompilation`、初始 values、reaction projection 和 Runtime session identity。Runtime 只收到 compilation 和 JSON-safe state。

`JsonImportPane` 为每次分析递增 request id，并捕获 target、current project id/content hash。任何 `File.text`、adapter dynamic import 或 compile 完成时若 request/target/session 已变化，结果直接丢弃并清理旧 preview。

## 原子创建

### Project

controller 抽取 `createPreparedProject(document)`，模板与 import 共用：

1. 捕获 repository、current project id/hash 并检查未保存修改。
2. 对完整项目做 schema、Registry 与 compiler preflight。
3. `repository.create`。
4. `openProject` 并确认新 id 已激活。
5. open 失败时 `repository.delete` 补偿；补偿失败合并报告两层错误。
6. 只有激活成功才 refresh list/关闭创建工作区。

### Page

controller 抽取 `createPreparedPage(page)`：先把页面加入 current document clone 做完整 compile，再执行一个 `page.add` command，成功后选择新页面。Command failure 保留原 snapshot/history；成功后一次 Undo 完整撤销。

## UI 与可访问性

- 顶部使用 tabs 表达“模板 / JSON 导入”，粘贴/文件使用 segmented tabs，不用装饰卡片。
- 桌面为稳定两列：左侧输入与 diagnostics，右侧 summary/migrations/preview；900px 改为主从 pane，390px 用“输入 / 检查 / 预览”tabs。
- `ElUpload` 仅作为本地 drag/select 控件，`auto-upload=false`、`limit=1`；创建命令使用 `ElButton` 与 Lucide 图标。
- diagnostics 使用 list + code/path/message，错误摘要为 `role=alert`，分析进度为 `role=status`；tabs、list 和按钮遵循现有 roving/focus 模式。
- 关闭/创建后恢复 Designer 或触发按钮焦点；清空后回到输入；切换 target/mode 时 dispose preview。

## 测试策略

- Unit：syntax、预算边界、污染键、current/v3/v1 migration、歧义、future version、双 Registry、identity completeness。
- Property：使用成熟的 `fast-check` 生成受约束 Page/Project，验证 stringify→parse→instantiate→normalize round-trip 与 parser 永不抛出非诊断异常。
- Controller：Repository create/open/compensation、stale async、page single-command/undo、失败 snapshot/revision/selection 不变。
- Component：paste/file、retry/clear、diagnostics、migration summary、focus、locale/theme、request race。
- E2E：两个 adapter 的 Project/Page，paste/file，invalid/oversize，1440/900/390，Light/Dark，zh-CN/en-US，axe 与可视快照。

## 兼容、回滚与风险

- 新 migration 只在 `project/import`，不得被 Repository 自动读取或恢复旧 runtime compatibility。
- Export JSON scope 可独立回滚，不改变 canonical TypeScript/Source generator。
- UI pane 与 import service 通过 typed prepared result 隔离；移除 UI 不会改变 parser/Repository。
- 最大风险是 identity 漏改与 async 过期发布；schema revalidation、typed remap 测试和 captured hash gate 是强制门禁。
