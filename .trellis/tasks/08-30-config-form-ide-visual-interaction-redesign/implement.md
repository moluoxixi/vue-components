# ConfigForm IDE 架构重构实施计划

## 实施原则

- 先建立独立领域 Model、Project Transaction Engine 和 Runtime parity 合同，再迁移 UI。
- 每个工作项保持可构建、可测试；迁移在 repository ingress 单向完成，不用长期 feature flag 维护两套正常架构。
- 旧 `WorkspaceApplication`、`LowCodePageModel` 和 `DesignerDocument` 只作为兼容输入/输出，不允许新功能继续依赖它们。
- 每个工作项结束都执行本项测试和受影响包的全量质量检查；不能用兼容投影的测试代替新架构行为证据。

## 阶段清单

### 0. 基线与保护网

- [ ] 固定当前主入口和测试命令，补充 architecture smoke test。
- [ ] 为旧 `WorkspaceApplication`/`LowCodePageModel`、slot 规则、Operation inverse、Preview revision、ExportSnapshot 建立迁移基线 fixture。
- [ ] 记录当前 Designer/Preview 的真实 DOM 节点 id、尺寸、组件类型和 props 快照。
- [ ] 增加依赖方向测试，禁止 Model/Core 依赖 Vue、Designer、Workbench 或 adapter。

验证：

```text
pnpm --filter @moluoxixi/config-form-designer test
pnpm --filter @moluoxixi/config-form-designer typecheck
pnpm --filter @config-form/workbench test
pnpm --filter @config-form/workbench typecheck
```

回滚点：只新增 fixture 和架构约束，不改变默认运行路径。

### 1. 独立 Model 包与 ProjectDocument

- [x] 新建纯 TypeScript `@moluoxixi/config-form-model`，拥有 JSON value、ComponentContract、ProjectDocument、PageGraph、ProjectCommand、ProjectOperation、AppliedProjectTransaction、diagnostics 和版本常量。
- [x] PageGraph 使用 `root: SlotItem[] + nodesById`；节点只保留 `slots: Record<SlotName, SlotItem[]>`，默认子节点进入 `slots.default`，field/layout 使用判别联合；slot item 持有 placement，删除通用节点上的 `span` 泄漏。
- [ ] 在 repository ingress 实现 `WorkspaceApplication v2`、`LowCodePageModel v1` 和 `DesignerDocument v1` 到 ProjectDocument 的确定性迁移。
- [x] ProjectDocument 不保存生成源码文件；只保存页面、路由、项目设置、资源引用和 registryLock；页面 Flow 由对应 `ProjectPage.flows` 保存，与视觉 PageGraph 同级并随 Page entity 原子持久化。
- [ ] 明确 `ProjectDocument` 是唯一业务内容且不含持久化元数据，`ProjectSnapshot` 是 `{ document, editVersion, contentHash }` editor envelope；Repository 以 `{ document, repositoryRevision, entityRevisions, timestamps }` envelope 原子组装 Manifest/Page/Resource，不得把物理分片变成第二套业务模型。
- [ ] 更新包 exports、README 依赖图、发布包验证和独立 TypeScript consumer。

验证：Model schema/migration 全量单测、legacy fixture round-trip、依赖方向测试、包 build/typecheck/publint consumer。

回滚点：旧记录保持只读原文；新格式写入失败时不覆盖旧记录。

### 2. Project Transaction Engine 与 History

- [x] 把 UI/插件意图统一为 ProjectCommand，Command Engine 基于当前快照解析为 ProjectOperation；所有节点 operation 显式携带 pageId，并由一个 ProjectTransaction 原子提交。
- [x] Command resolver 的中间草稿允许跨 action 暂态不满足引用约束，但完整 OperationBatch 发布前必须通过最终 Graph/Registry/Flow 校验。
- [x] `node.patch` 使用显式 JSON-safe `set/unset`；禁止以 `undefined` 表达删除，覆盖序列化往返、字段冲突与非法 unset 诊断。
- [ ] 为事务生成 semantic inverse，删除正常路径的 `update-page-model` 和整份 Project 深拷贝 history。
- [ ] 统一 mergeKey、diagnostics、conflict handling 和 changed entity set；分离 editVersion、repositoryRevision、contentHash、registry fingerprint 和 compiler version。
- [ ] 使用 normalized graph 的 copy-on-write 更新，保证 failed operation、batch failure、undo/redo 不改变输入对象和 revision。
- [ ] Transaction id 作为 command id 提供幂等保护；Repository commit 使用 CAS，覆盖多标签页冲突、部分写入恢复和保存期间继续编辑。
- [x] 以纯 `ProjectDomainEngine` 替代混合 ProjectStore，并拆出 Workbench `ProjectEditorSession` 与 `ProjectSaveCoordinator`；当前页属于导航 session，Repository/CAS 不进入领域引擎。

验证：Transaction 全量单测、100/500/2000 节点性能、跨页面原子操作、revision conflict 和保存期间继续编辑集成测试。

回滚点：按代码提交回滚 Transaction Engine；不在产品运行时保留双 history 开关。

### 3. 统一 Registry 内部合同

- [ ] 把当前 Material 定义拆为 Model `ComponentContract`、RuntimeBinding、DesignMetadata、SourceBinding。
- [ ] 保留现有 Registry facade、组件 key、layer precedence、allowedParents 和 source capability 行为。
- [ ] 为每个注册组件补齐默认值、props、events、bindings、slots、source 和 design policy 的完整 fixture。
- [ ] 组合根生成 JSON-safe、带 adapter key、版本和内容指纹的不可变 RegistryContractSnapshot；ProjectDocument registryLock 按实际使用组件保存 `{ key, contractVersion, fingerprint }`，Vue Component、图标和函数只存在于对应 resolver。
- [ ] 为每个组件合同增加 contractVersion 和确定性 migration chain；fingerprint 只检测差异，缺失/不可迁移组件必须产生可恢复诊断。
- [ ] 增加 design adapter 的 `visualEquivalence` 能力和缺失能力诊断；声明必须有 geometry/computed-style 测试证明。

验证：Element Plus、Ant Design Vue 全部物料 registry 测试、包边界类型消费者、source binding 完整性测试。

回滚点：Facade 保持旧 definition shape，内部新类型可单独撤销。

### 4. CompileCoordinator、Canonical Program、Runtime Backend 与 RuntimeHost

- [x] 新建独立 `@moluoxixi/config-form-compiler`，纯 Semantic Compiler 消费 ProjectCompilationSnapshot + RegistryContractSnapshot + RuntimeStructuralEnvironment，输出 viewport-neutral、框架无关且不可变的 Canonical Program。
- [ ] 拆分 `editVersion`、content identity、compile key 与 runtime instance identity；禁止 editVersion 进入 IR hash。
- [x] 增加 PageCompilation 与 CompileCoordinator，实时路径只编译活动页面并按 ProjectChangeSet 做页面级失效；ProjectCompilation 仅在导出等全局场景按需组装。
- [ ] Vue Runtime Backend 从 CanonicalProjectIR 生成 RenderPlan；Source Backend 从同一 IR 生成 standalone Vue AST/file graph。禁止任一 backend 重新解释 ProjectDocument。
- [x] 将页面级 CompileCoordinator 扩展为子树级 Incremental Compiler Service，基于结构共享、derived parent/dependency index、subtree hash 与 page-qualified changed entity set 管理缓存和 invalidation；拖拽 candidate 不重新编译或挂载整页。
- [x] Design/Preview 共用同一 project revision 的 node id、path、slot、component、props 和 layout 解析结果。
- [x] Design/Preview 分别创建独立 RuntimeHost；viewport、locale、字体和 runtime theme 由 RuntimePresentationSnapshot 控制，`mode` 只控制 editor bridge、事件拦截和生命周期，不改变 RenderPlan 或默认替换组件。
- [x] RuntimeHost 隔离 IDE CSS、组件库全局样式、Teleport 和副作用；生产 Workbench 使用 iframe bootstrap，overlay 通过 node geometry/event bridge 工作。
- [x] Preview 已迁移到独立 iframe RuntimeHost；父子 realm 只传 JSON-safe PageCompilation/运行状态，iframe 独立加载 adapter、组件样式与 Teleport，并保持同页 Runtime session 生命周期。
- [x] Design 迁移到独立 RuntimeHost，并实现 node geometry/event bridge；节点以稳定 nodeId 注册，path/slot 作为可更新 metadata，pointer lifecycle 和跨 slot cleanup 均由协议测试覆盖。
- [ ] 仅允许声明视觉等价性的受控 adapter，增加 geometry/DOM parity 测试。
- [ ] 保留 RuntimeSurface 的真实 Vue 递归渲染、ARIA、readonly 和 editor metadata。

验证：Runtime 全量测试、Designer/Preview 节点计数与顺序一致性、嵌套 slot、空容器和响应式尺寸测试。

回滚点：按调用方逐一迁移并保持旧 compiler 仅供 compatibility API 使用；不改动已发布 RuntimeSurface API。

### 5. Design Session 与 Canvas 交互

- [ ] 将 selection、drag session、candidate transaction、overlay geometry、keyboard target 收敛到 Design Session。
- [ ] 删除正常 Workbench 路径中的 Designer local history；DesignSurface 只提交 ProjectCommand，ProjectStore 只产生一个 AppliedProjectTransaction。
- [x] 拖拽 candidate 使用带 base identity 和 draftHash 的 ProjectDraftSnapshot 通过同一 Runtime Compiler 渲染，禁止把草稿伪装为正式 ProjectSnapshot；DOM clone 只能作为测量后跟随指针的视觉副本，不能作为主 candidate 状态。
- [ ] 完成多级嵌套、空 Flex/Grid、最后一个位置、跨 slot、resize、多选和 keyboard drag 测试。
- [ ] Canvas overlay 不阻断子节点命中；drag overlay 尺寸来自真实 candidate bounding box。

验证：Designer 单测、Playwright pointer/keyboard hit testing、真实组件截图和 axe WCAG 2 A/AA。

回滚点：旧 ConfigFormDesigner 入口留在 compatibility adapter；Workbench 不保留双编辑路径。

### 6. Preview Session 与 Flow Engine

- [ ] 把 Preview values、reaction projection、validation、AbortController 和 trace 从 Workbench Controller 移入 Preview Session。
- [ ] 把 Flow graph 编辑、action registry、execution plan 和运行调度移入 Flow Engine。
- [x] 新增页面级 PageFlowEngine，收口 action registry、当前 execution plans、Flow projection、调度、trace/error 与跨 page/revision stale generation；Controller 只负责事件适配和 Preview values 端口。
- [x] Workbench Inspector 以 Registry 事件作为唯一正常组件事件入口；点击事件直接打开精确 `nodeId + event` 的 Flow，已有流程选中、无流程按事件源创建，旧 action 字符串编辑仅留给兼容宿主。
- [ ] 明确纯同步 binding/reaction 与异步/副作用 Flow 的能力边界和冲突诊断。
- [x] Core 将 FlowGraph 编译为不含 position/revision、包含完整执行元数据的 portable execution plan；Workbench Preview 和 standalone Source 只消费该 plan。
- [x] 生成 standalone flow runtime，并执行 `latest/queue/ignore`、timeout、abort、error policy、model-order 和 value patch 矩阵。
- [x] 保证 Design 操作刷新 Preview revision，过期异步结果不能覆盖新页面；PageFlowEngine 另以 page/revision generation 阻止旧值和 projection 提交。
- [ ] Preview 在切换 RenderPlan 时按稳定 node id/字段合同协调兼容状态；删除或合同变化的字段才清理，不做每 revision 全量重置。
- [ ] Workbench 和 standalone Source 使用同版本 portable flow runtime；导出工程内嵌源码，不复制第二套解释器逻辑。

验证：Core flow tests、Preview coordinator tests、generated Source executable tests、导出工程安装/typecheck/build。

回滚点：保留旧 PreviewFlowCoordinator 和 generated flow runtime，按 revision key 切回。

### 7. Readonly Export Service

- [x] 将纯 `buildExportSnapshot` 与有状态 `ExportSession` 分离；Config、Source、Tree 和 ZIP 统一接入含 project revision、registry fingerprint、generator version 的 immutable ExportSnapshot。
- [x] Config 生成器只从 ProjectDocument/PageGraph 无损生成 `defineFields<T>()` / `defineField` 源码和 JSON/Tree 投影。
- [x] Source Backend 只从 CanonicalProjectIR 输出完整 standalone Vue 工程、真实文件树、package.json、页面、路由和 flow runtime。
- [x] 生成器使用统一安全序列化/AST helper，补齐 HTML-sensitive values、特殊 key、二进制文件和路径校验。
- [x] 明确 Source/Config 只读，设计修改只标记 snapshot stale，显式刷新才替换快照。

验证：export dialog、file tree、single-file download、ZIP byte consistency、多页工程 integration tests。

回滚点：保留现有 `createWorkspaceApplicationSourceExport` 和 `formatLowCodePageConfig` 作为 compatibility generator。

### 8. Workbench Shell 与 UI State 拆分

- [x] Workbench 主状态源和 Repository 已切换到 ProjectEditorSession/ProjectDomainEngine/ProjectDocument；旧 WorkspaceApplication/LowCodePageModel 只作为 Pages/Designer/Export 的无状态只读兼容投影。
- [ ] 将剩余 `workbench-controller.ts` 拆为 Design Session、Preview Session、Flow Engine、Export Service 和 UI Store contexts。
- [ ] `WorkbenchShell` 只组合 service/session contexts、路由页面和 dialogs，不直接执行领域逻辑。
- [ ] 保持 Pages 唯一切换入口、Flow/Export/Page Manager 弹窗、Source/Config 只读和移动端 Dock。
- [ ] 重新校准三栏、900px drawer、390px Dock、Dark token、Canvas sheet 主题隔离和 Inspector 密度。
- [ ] 为 panel/dialog 焦点恢复、locale、keyboard command 和 responsive geometry 增加浏览器验收。

验证：1440/900/390 Light/Dark zh-CN/en-US Playwright 截图、console error 过滤、axe 检查。

回滚点：UI Store 可以独立回退，不回退 Project Store 和 Runtime Compiler。

### 9. 兼容边界与清理

- [ ] `WorkspaceApplication`、`LowCodePageModel`、`DesignerDocument` 仅保留 legacy migration 和旧公共 API adapter。
- [ ] 删除正常 Workbench 路径中的 `configModelToDesignerDocument`、`designerDocumentToConfigModel` 和 `update-page-model`。
- [ ] 保留旧配置解析器仅用于一次性迁移，不支持 Source/Config 回写 Model。
- [ ] 更新 `packages/ConfigForm/README.md`、相关 `.trellis/spec`、包 exports 和 API smoke consumer。
- [ ] 标记并移除旧 history、重复 compiler、重复 provider 代码。

验证：完整 ConfigForm package quality gate、legacy fixture、发布包声明、独立 TypeScript consumer、生成项目 integration。

回滚点：清理必须是最后独立提交；若失败，保留新 Provider 和旧 compatibility adapter 共存。

## 最终质量门

```text
pnpm test:config-form-packages
pnpm --filter @moluoxixi/config-form-designer test
pnpm --filter @moluoxixi/config-form-designer typecheck
pnpm --filter @config-form/workbench test
pnpm --filter @config-form/workbench typecheck
pnpm --filter @config-form/workbench build
pnpm --filter @config-form/workbench verify:templates
pnpm --filter @config-form/workbench test:e2e
```

最终验收必须同时证明：

1. Canvas 和 Preview 使用同一 revision 的 Runtime Tree，组件、props、slot 顺序和可见几何一致。
2. 任意设计操作只产生一个 Project Transaction，Undo/Redo 不依赖 DOM、运行实例或完整 Project 快照。
3. Source、Config、Tree、单文件下载和 ZIP 均来自同一 immutable snapshot。
4. Flow Preview 与 standalone Source 在完整并发/错误矩阵下行为一致。
5. 设计器、Runtime、Export 和 Workbench 的受影响包都通过 lint/typecheck/test/build 和浏览器可访问性检查。

## 本轮验证记录（2026-08-31）

- Workbench Playwright：`20 passed`。覆盖 Element/Ant 全量真实物料、三级嵌套、Design inert 与 Preview interactive、pointer/keyboard/touch candidate、真实 drag visual、candidate/落地/Preview 同一 Runtime tree、Inspector 到 Flow 的单一事件入口、两套 Provider 的 binding/non-binding `component.event` exactly-once、Flow 弹窗、Dark/Light、移动端、只读 Source/Config 下载和 axe。
- Designer：`13 files / 152 tests`；Workbench：`36 files / 200 tests`；Runtime：`23 files / 204 tests`；RuntimeHost protocol：`6/6`。
- Designer/Workbench typecheck 与 build 均通过；Design 与 Preview iframe 以稳定 nodeId 同步 geometry，三级嵌套跨 slot candidate 不再被旧 cleanup 删除。
- 最新本地服务 `http://127.0.0.1:4319/` 人工检查：Workbench Inspector 的事件页只显示 Registry 注册事件，不显示旧 action 输入；点击事件行后 Flow 辅助弹窗打开并把精确节点事件标为首选来源；IDE 暗色控件清晰，干净重载后的页面控制台无 warning/error。
- 本任务仍为 `in_progress`：ExportSnapshot/Canonical Source、Preview Session/Flow Engine 与 Workbench Controller 拆分、Canvas camera/zoom 和其余实施清单尚未完成，因此不归档父任务。

## Readonly Export Service 验证记录（2026-08-31）

- ExportSnapshot stale identity 现在同时比较 compilation key、committed/draft origin 和 generator version；普通 `sync()` 不触发全项目 capture。
- retained binary 使用防御性 getter，外部修改源 buffer 或读取 buffer 都不能改变后续单文件/ZIP 字节；文本与二进制单文件统一经过 download helper，并延迟回收 Object URL。
- Canonical Config Source 保留 Project schemaVersion、Registry lock、graph version/props、完整 SlotItem placement、节点 authoring metadata 和 Flow position；`span` 只保留 Runtime 兼容投影。
- Config 生成器与 legacy parser 共用危险键守卫，嵌套 `__proto__`、`constructor`、`prototype` 均 fail closed 并报告路径。
- 定向导出回归 `5 files / 21 tests`、Workbench 全量 `38 files / 210 tests`、Playwright `20/20`、导出工程安装/typecheck/build `4/4`、Workbench typecheck/build 与全仓 lint 通过。
- Source/Config 下载浏览器回归同时捕获到 Chromium 对 `allow-scripts + allow-same-origin` 的无效 sandbox 警告；Design/Preview RuntimeHost 已移除伪安全 sandbox，继续依靠独立 iframe document、版本化 postMessage 协议和平台注册组件边界隔离运行态，干净浏览器控制台无 warning/error。
- 干净 `http://127.0.0.1:4319/` 浏览器验证 Source/Config 真实文件树、只读 Monaco、Project Config metadata 和单文件下载反馈，console 无 warning/error。长期运行的旧 `4315` Vite 会话曾出现 Monaco HMR duplicate-extension 警告，干净实例与生产 build 不复现，因此未把开发缓存现象误记为产品缺陷。
- 本任务继续保持 `in_progress`：standalone Flow runtime 仍需完整并发/错误可执行 parity matrix；Preview Session、Workbench Controller/UI Store 拆分等父任务事项尚未完成。
