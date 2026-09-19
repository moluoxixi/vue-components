# 清理 ConfigForm Source 遗留代码并通过相关门禁

## 目标

完成 `@moluoxixi/config-form-source` 抽包后的硬切收尾：默认导出程序员可直接接手的原生 Vue/Vue Router/目标 UI 源码，ConfigForm 仅作为独立可选绑定源码；删除旧生成器身份、Workspace 导出命名和伪事件语义，不保留 alias、wrapper、转发或兼容读取。

## 已确认事实

- Source 包已经拥有 `generateVueSource`、`generateConfigFormBindings` 和只读 Viewer；Workbench 直接消费 `rawSource` 与 `configBindings`，旧 generator、`WorkspaceCodeEditor`、`ProjectFileTree`、`source-page`、`source-project-files`、`source-canonical` 与 compiler `runtime-source` 均已物理删除。
- Workbench 快照中的 `generatorVersion` 只在服务和测试内部自循环，未进入持久化 Session；`SourceFileSetV1.version` 已承担文件集合同版本职责，应用代码更新也会重载内存 Session。
- ZIP 服务仍公开 `WorkspaceArchiveInput`、`createWorkspaceArchive`、`downloadWorkspaceArchive`；一个 `fileTree.generatedSource` 文案已无引用；模板测试还重复覆盖 archive 行为。
- Core 仍将 Data Source HTTP 响应公开建模为 `kind: 'event'`、`context.event`、`$event` 和 `usesEvent`。这不是合法的 UI 事件能力，应改为 response 语义；Source 自身使用 `result`，无需改动。
- 当前 Workbench 单元测试为 44 files / 540 tests 全绿；Source 专属架构与两项导出 E2E 全绿。全量 Playwright 的 37 项失败中，Source 直接失败为 0，21 项属于现有 Workbench/UI 断言或行为漂移，16 项仅缺新主题视觉基线。
- 全仓 package architecture 仍有 27 条既有违规，仅来自 `qiankun-router-kit` 与 `vite-plugin-style-scope`，与 ConfigForm Source 无依赖关系。
- 工作区已有 JSON 导入导出与 Workbench UI 改动。本任务必须逐 hunk 避让，不能回滚、覆盖或混入提交。

## 需求

- R1：保留双产物硬边界。原生源码继续作为默认产物且不依赖 ConfigForm；ConfigForm 绑定源码只包含公开绑定配置，不得输出 App、Router、Session、Reducer、Overlay Host、运行核心副本、事件函数桩或 handler registry。
- R2：从 Workbench `ExportSnapshot`、构建输入、Session stale 判定和测试中彻底删除 `CONFIG_FORM_EXPORT_GENERATOR_VERSION`、`generatorVersion` 与 `currentGeneratorVersion`。快照新鲜度只由完整 `ProjectCompilation.key` 与 committed/draft origin 决定。
- R3：将 ZIP 合同无兼容硬切为 `SourceArchiveInput`、`createSourceArchive`、`downloadSourceArchive`，同步所有生产消费者和测试；不得保留旧 Workspace 名称的 alias/re-export。
- R4：删除无引用的 `fileTree.generatedSource` 文案和模板域中的重复 archive 测试；archive 行为只在导出域拥有一套权威覆盖。
- R5：将 Core 的 Data Source 响应合同无兼容硬切为 `kind: 'response'`、`ConfigFormValueContext.response`、`$response` 与 `usesResponse`，同步 runtime、公开类型、README、单测与 Changeset，并用负向测试拒绝旧 `event/$event` 合同。Vue 合法 `$event`、组件 listener、字段取值事件和 Prototype Interaction 必须保留。
- R6：补齐防回生门禁，覆盖已删除的旧 generator/viewer 路径、旧 Workspace archive 符号和 Core response 注入点；门禁范围必须精确，不能误伤合法 Vue/Runtime 事件。
- R7：更新长期规范与 ROADMAP，删除 Workbench generator `5.0.0`、`WorkspaceFile`、`ExportFileSet`、`snapshot.source/config`、旧 Config/JSON/Tree 编辑器等已失效合同，统一为 `rawSource`、`configBindings` 与 `SourceFileSetV1`。
- R8：只提交本任务拥有的文件和 hunk；用户现有 JSON import/export、Topbar、E2E 与主题改动保持原样。

## 验收标准

- [x] AC1：Source 双产物合同和生成项目依赖边界保持通过，原生源码与 ConfigForm 绑定源码均不包含运行核心副本或事件编排设施。
- [x] AC2：ConfigForm 生产代码、当前测试和当前规范中不再存在旧 generator version 或 Workspace archive API；历史归档任务与 Changeset 不做伪造性改写。
- [x] AC3：编辑版本、draft identity、编译 key 变化仍能正确标记快照 stale；生成失败仍原子保留上一个完整快照。
- [x] AC4：Source archive 对 text/binary 文件保持精确字节、稳定安全根路径、延迟 URL 回收和正确下载文件名。
- [x] AC5：Core 公开 API 只接受 response 语义，Data Source runtime 将 HTTP 响应注入 `$response`；旧 `kind: 'event'` 与 `$event` 表达式被稳定拒绝，合法 UI 事件能力不受影响。
- [x] AC6：架构测试证明旧 generator/viewer/archive/event-response 路径和符号不能回生，且不通过 allowlist 隐藏违规。
- [x] AC7：Source test/typecheck/build、Core test/typecheck/build、Workbench 44-file 单测、ConfigForm 三组架构门禁和 Source 专属 E2E 全部通过；`git diff --check` 通过。
- [x] AC8：提交前按 path 与 hunk 复核，任务提交不包含用户现有 JSON 导入导出和 Workbench UI 改动。

## 范围外

- 不新增源码回导、在线代码编辑、事件编辑器、事件编排、任意事件转发或设计器函数实现。
- 不修复当前 21 项独立 Workbench/UI E2E 漂移，也不直接接受 16 张新视觉基线；这些需要各自产品行为确认和人工审图。
- 不默认修复 `qiankun-router-kit` 与 `vite-plugin-style-scope` 的 27 条既有架构债务。
- 不修改归档任务、历史 Changeset 或提交记录中的历史名称。

## 范围决定

按 ConfigForm 产品边界验收：纳入本 PRD 的 Source/Workbench/Core 收尾并让相关门禁全绿，对无关失败给出可复现报告；不扩展到两个无关包、Workbench UI 行为修复和视觉基线审查。
