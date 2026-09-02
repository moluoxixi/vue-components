# 技术设计：ConfigForm 全包当前契约 Hard Cut

## 1. 设计目标

本任务在产品尚未上线的前提下，对 `packages/ConfigForm/` 做一次同步的 current-only hard cut：所有生产写入端、读取端、公共类型、测试 fixture、示例和当前文档只描述当前契约。旧开发数据允许失效；实现不得通过迁移、别名、fallback 或 dormant extension point 保留旧契约。

所有格式/协议身份版本统一使用字段名 `version`。模板 manifest 的原 `version` 作为内容修订显示字段被删除；同名字段重新定义为严格的格式身份 `version: 1`，不提供旧语义兼容。Project、PageTransfer、Registry Snapshot、Coordination、Recovery、Runtime Host、Flow、RuleSet 等边界全部采用 `version`；`revision` 只表示编辑/持久化内容修订，`adapterVersion`/`contractVersion` 只表示依赖或组件合同版本。旧 `schemaVersion`、`protocolVersion`、`storageSchemaVersion` 字段名一律拒绝，不做别名。

## 2. 边界与数据流

### 2.1 JSON 导入

`source bytes -> JSON.parse -> iterative guard -> exact current envelope parser -> exact Registry match -> fresh identity remap -> full project compile -> PreparedConfigImport -> create`

- Project 只接受 `version: 4` 的 `ProjectDocument`。
- Page 只接受：

```ts
interface PageTransferDocument {
  kind: 'config-form-page'
  version: 1
  registryLock: RegistryLock
  page: ProjectPage
}
```

- 裸 `ProjectPage`、裸 `PageGraph`、Project v3、Page Model v1、缺失/未来/未知版本均在分析阶段拒绝。
- `PreparedConfigImport` 是分析阶段到创建阶段的唯一跨层类型；未经准备的 `unknown`、原始字符串和解析中间值不得进入 Runtime、Repository 或 Project Command。
- Registry 锁在身份重映射前做 adapter/adapterVersion/fingerprint/component key/contractVersion/fingerprint 精确匹配，不重建、不迁移。

### 2.2 模板

模板 Provider 仅返回 JSON-safe `{ manifest, page }` seed。`ProjectTemplateManifest` 必须包含 `version: 1`，禁止包含 `schemaVersion`、`protocolVersion` 或将 `version` 当作内容修订的额外字段。Catalog parser 使用严格 allowed-key 集合，旧字段得到稳定 `TEMPLATE_INVALID`/`TEMPLATE_VERSION_INVALID` 诊断。

规范化 seed 指纹覆盖 manifest（不含可变字段）和 page 的 canonical JSON；服务层使用 `template:<id>:<fingerprint>:<projectId>` 作为预览 revision。UI 不再展示模板内容版本。

### 2.3 持久化

IndexedDB 打开时只接受当前 manifest 结构和当前 namespace，存储 manifest 的格式身份也使用 `version`。发现旧/未知 manifest 时返回稳定 storage diagnostic，并清理/隔离旧开发记录后以空的 current store 启动；不执行 v2→v3 字段转换。Recovery Draft、Coordination、Runtime Host、Flow、RuleSet 的 current version `1` 仍按各自精确 gate 运行。

### 2.4 Runtime、Headless 与公开 API

- 删除 Runtime 旧 node id/event alias、旧 props 名称和 shape fallback；保留当前字段及当前层间 placement/span 投影。
- 删除 Headless deprecated export 和 Workbench/template legacy identity helper。
- 删除 Model component migration 类型、注册器、调用链和成功诊断分支。当前 Registry 只能 exact match。
- 架构扫描覆盖所有 ConfigForm 生产源码与公共 exports，排除归档任务和 changelog 历史文本。

### 2.5 Source export

从同一个 pinned `ProjectCompilation.snapshot.document` 生成 Config、Tree、Source、copy/download。Source generator 必须完整投影当前字段的 `validation`、`validateOn`、custom/Zod/required 规则以及 tablet/mobile responsive overrides；不得用默认值覆盖已声明语义。Preview、Config export、Source export 共享同一 canonical projection。

## 3. 关键实现决策

1. **版本字段统一**：所有格式/协议身份字段统一命名为 `version`；删除旧模板内容修订语义，使用 canonical seed fingerprint；`revision`、`adapterVersion`、`contractVersion` 保持各自非格式版本语义。
2. **失败方式**：边界统一返回稳定 diagnostic code/path；禁止 shape guessing、silent repair 和迁移记录。
3. **存储 reset**：旧 IndexedDB manifest 只触发开发态拒绝/reset，不尝试读取旧实体再写新实体；reset 结果需可测试且不影响新 namespace。
4. **身份安全**：导入/模板实例化继续对 Project/Page/Node/Field/Flow/Edge/Reaction 生成有界、唯一的新 identity，只重写形式化引用。
5. **创建原子性**：完整候选编译成功后才 Repository create/page.add；activation preparation 失败要补偿删除并报告补偿失败；页面导入始终一个 Project Command、一个 Undo。
6. **产品边界**：不扩张 API action、动态 option resolver、文件资源、发布、账号或云协作；Source 当前语义丢失属于本任务必修复项。

## 4. 受影响模块

- `packages/ConfigForm/workbench/src/project/import/`：删除 migrations 链，重写 current parser/service/types/export envelope。
- `packages/ConfigForm/workbench/src/project/templates/`：manifest version gate、删除旧内容修订语义、canonical fingerprint、更新 built-in/provider/service/UI。
- `packages/ConfigForm/workbench/src/project/project-document-repository-indexed-db.ts`：移除 manifest migrator，增加旧 manifest reject/reset。
- `packages/ConfigForm/model/src/`：移除 component migration 公共 API 与 schema/type 引用。
- `packages/ConfigForm/runtime/src/`、`headless/src/`：移除 legacy aliases/fallback/deprecated exports。
- `packages/ConfigForm/workbench/src/project/export/`：补齐 Source validation/responsive 投影并统一 pinned snapshot。
- ConfigForm 当前 README、locale、tests、fixtures、E2E、CI gate 和架构扫描。

### 4.1 文件组织

所有 feature 根目录只保留 `index.ts` 与可选 `index.vue`，其余实现按职责放入
`types/`、`components/`、`composables/`、`state/`、`services/`、
`schemas/`、`adapters/`、`utils/`、`constants/`、`defaults/`。Vue 的
props/emits/expose/slots 和领域纯类型统一归入 `types/`；运行时默认值与
Expose 代理分别进入 defaults/constants 与 composables/services。每个实际存在的职责目录有自己的 `index.ts`，
不为未使用的职责创建空目录。Runtime Renderer、根 ConfigForm、Element/Antd、
Designer Canvas/PropertyPanel、Workbench 导入/导出/模板/持久化优先重整；
barrel 不提供旧 subpath 或别名转发，公共 contract 只有一个声明位置。

## 5. 错误与可观测性

每个拒绝都包含稳定 code、用户可定位的 escaped JSON path 和本地化文案。版本字段误用按边界处理：格式/协议 `version` 低于或高于 current 时拒绝；出现 `schemaVersion`、`protocolVersion`、`storageSchemaVersion` 等旧字段名时拒绝；真正的 current v1 协议照常接受。不得将历史迁移记录写入用户状态或导出结果。

## 6. 测试策略

- Parser：current/old/future/missing/ambiguous 版本、裸 page、unsafe key、深度/数组/总条目边界、Registry subset exact match、最大长度 identity。
- Template：version 精确 gate、旧字段名/错误 version、fingerprint 稳定性、seed immutability、provider isolation、预览 stale completion。
- Storage：v2/未知 manifest reject/reset，新 current manifest round trip，旧实体不被重写。
- Runtime/Headless/Model：公共导出架构扫描、旧 alias 不可编译、component migration API 不存在、current protocol v1 正常运行。
- Export：validation、validateOn、required/Zod/custom validator、tablet/mobile overrides 与 Preview/Config 一致；pinned page 消失时 copy/download disabled。
- Workbench：项目/页面创建补偿、单命令 history/Undo、两种 adapter、双语/主题/1440/900/390 E2E。

## 7. 回滚与风险

本任务是开发阶段 hard cut，不提供运行时兼容回滚。若实现阶段发现当前 schema 本身错误，回到 planning 修订 current contract 和 fixture，再重新执行；不得恢复被删除的迁移入口。主要风险是跨包删除造成类型级联失败、测试夹具仍携带旧字段、IndexedDB 本地开发数据触发 reset，以及 Source generator 与 Compiler 投影遗漏新字段。
