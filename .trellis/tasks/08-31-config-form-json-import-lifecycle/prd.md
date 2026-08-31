# ConfigForm JSON 导入与新建流程

## 目标与用户价值

在统一的新建流程中提供明确的 Config Model JSON 导入入口，让用户可以把平台导出的 JSON 安全地创建为新项目或新页面，而不覆盖当前设计或尝试解析任意源码工程。

## 已确认事实

- 当前 Export Dialog 已能查看/下载只读 Config JSON/Tree/TypeScript 和 Source 工程。
- 当前没有与导出对称的 JSON import UI；新建主要从内置模板开始。
- `ProjectDocument`、PageGraph schema、Registry lock 和 Model diagnostics 已具备严格验证基础。
- 既有产品决策明确不支持导入真实 Vue 工程，也不支持 Source/Config 反向编辑当前 Design；本任务只导入平台 Config Model JSON 并创建新实体。

## 需求

- 在新建项目/页面工作区提供“从 JSON 导入”，支持粘贴和本地 `.json` 文件选择。
- 解析后依次验证 JSON 语法、schema version、Project/Page shape、Registry component/slot/event/binding contract 和 adapter compatibility。
- 导入确认前展示项目/页面摘要、组件数量、页面数量、adapter、潜在迁移和 diagnostics；原始 JSON 不直接进入 Runtime。
- 导入默认创建新项目或新页面，不覆盖当前实体；identity 冲突通过确定性 remap 处理，并同步 node、flow target、resource 等引用。
- 支持当前 schema 的 lossless round-trip；旧的受支持 schema 必须先显式迁移并展示迁移结果，未知/未来版本 fail closed。
- 非法组件、任意 HTML、函数、`__proto__`/prototype pollution、超大载荷和深层嵌套均有明确限制与诊断。
- 成功创建走 Repository/Project Command 正式入口，失败时当前 Project、history、selection 和 persistence revision 保持不变。

## 验收标准

- [ ] 平台导出的 Project JSON 和单页 JSON 可分别创建新项目/页面，导入后再次导出语义等价。
- [ ] identity remap 后 node hierarchy、slot、Flow trigger target、binding 和 resource 引用全部一致，无重复 id。
- [ ] 语法错误、schema 错误、未知组件、adapter 不兼容、污染键、超限数据均在确认前被拒绝且不改变当前项目。
- [ ] 导入预览在 1440/900/390、Light/Dark、zh-CN/en-US 下可读，文件选择、粘贴、取消和返回焦点符合可访问性要求。
- [ ] 导入成功后 Repository revision、Undo/Redo 和 autosave 使用正式创建合同，不留下半创建实体。
- [ ] parser/migration/security 单测、round-trip 属性测试、两套 provider 集成、Playwright、typecheck 和 build 通过。

## 范围外

- 不导入 `.vue`、`package.json`、ZIP 工程、Babel AST、任意 HTML DOM 或用户 JavaScript 函数。
- 不允许 JSON 直接覆盖当前 ProjectDocument。
- 不把 Config/Source 查看器改回可编辑 provider。
