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
- [ ] 增加 PageCompilation 与 CompileCoordinator，实时路径只编译活动页面/受影响子树；ProjectCompilation 仅在导出等全局场景按需组装。
- [ ] Vue Runtime Backend 从 CanonicalProjectIR 生成 RenderPlan；Source Backend 从同一 IR 生成 standalone Vue AST/file graph。禁止任一 backend 重新解释 ProjectDocument。
- [ ] 建立独立 Incremental Compiler Service，基于结构共享、derived parent/dependency index、subtree hash 与 changed entity set 管理页面/子树缓存和 invalidation；拖拽 candidate 不重新编译或挂载整页。
- [ ] Design/Preview 共用同一 project revision 的 node id、path、slot、component、props 和 layout 解析结果。
- [ ] Design/Preview 分别创建独立 RuntimeHost；viewport、locale、字体和 runtime theme 由 RuntimePresentationSnapshot 控制，`mode` 只控制 editor bridge、事件拦截和生命周期，不改变 RenderPlan 或默认替换组件。
- [ ] RuntimeHost 隔离 IDE CSS、组件库全局样式、Teleport 和副作用；生产 Workbench 优先使用 iframe bootstrap，overlay 通过 node geometry/event bridge 工作。
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
- [ ] 明确纯同步 binding/reaction 与异步/副作用 Flow 的能力边界和冲突诊断。
- [ ] Core 将 FlowGraph 编译为不含 position/revision、包含完整执行元数据的 portable execution plan；Workbench Preview 和 standalone Source 只消费该 plan。
- [ ] 生成 standalone flow runtime，并执行 `latest/queue/ignore`、timeout、abort、error policy、model-order 和 value patch 矩阵。
- [ ] 保证 Design 操作刷新 Preview revision，过期异步结果不能覆盖新页面。
- [ ] Preview 在切换 RenderPlan 时按稳定 node id/字段合同协调兼容状态；删除或合同变化的字段才清理，不做每 revision 全量重置。
- [ ] Workbench 和 standalone Source 使用同版本 portable flow runtime；导出工程内嵌源码，不复制第二套解释器逻辑。

验证：Core flow tests、Preview coordinator tests、generated Source executable tests、导出工程安装/typecheck/build。

回滚点：保留旧 PreviewFlowCoordinator 和 generated flow runtime，按 revision key 切回。

### 7. Readonly Export Service

- [ ] 将纯 `buildExportSnapshot` 与有状态 `ExportSession` 分离；Config、Source、Tree 和 ZIP 统一接入含 project revision、registry fingerprint、generator version 的 immutable ExportSnapshot。
- [ ] Config 生成器只从 ProjectDocument/PageGraph 无损生成 `defineFields<T>()` / `defineField` 源码和 JSON/Tree 投影。
- [ ] Source Backend 只从 CanonicalProjectIR 输出完整 standalone Vue 工程、真实文件树、package.json、页面、路由和 flow runtime。
- [ ] 生成器使用统一安全序列化/AST helper，补齐 HTML-sensitive values、特殊 key、二进制文件和路径校验。
- [ ] 明确 Source/Config 只读，设计修改只标记 snapshot stale，显式刷新才替换快照。

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
