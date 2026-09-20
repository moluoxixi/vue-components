# Research: Surface / Dataset / Prototype Interaction 跨包影响

- Query: 将现有 Page-only ConfigForm 体系硬切为 Demo Studio 所需的 Surface、Dataset 与本地交互合同时，哪些包、版本边界和运行路径必须原子调整？
- Scope: internal
- Date: 2026-09-18

> 状态更新：后续 `config-form-studio-contracts/design.md` 已固定 Prototype Runtime 包名、入口和目标版本表。本文中的待定 caveat 是研究时点信息，实施以合同设计为准。

## Findings

### 结论

这不是 `Page -> Surface` 的机械改名。当前 Page 身份同时承担持久化资产、编译单元、缓存键、Preview 协议身份和源码生成入口；SurfaceInstance 又是新增的运行身份。若只改 Model，会立刻造成旧 Reader 接受半新半旧文档、缓存串用、Runtime Host 拒收或源码生成读取错误。因此基础子任务必须按同一合同原子切换 Model、Repository、Compiler、Canonical IR、Vue backend、Workbench persistence/import/session/runtime-host，以及仍留在 Workbench 内的现有 Source generator；后续再做 UI 扩展和 Source 包物理抽离。

当前版本基线为：`ProjectDocument v5`、`PageGraph v3`、Canonical IR `v4`、Compiler `5.0.0`、IndexedDB manifest/entity codec `v3`、Page transfer `v2`、Runtime Host protocol `v6`、Export generator `4.0.0`。这些是待升版的旧基线，不是新合同应继续使用的目标版本。新版本号应由“产品与合同”子任务统一确定，所有 Reader 只接受精确新版本。

### 现有耦合证据

1. **Model 仍是 Page-only 聚合。** `ProjectDocument` 直接保存 `homePageId/pageOrder/pagesById/resources`，没有 Surface kind、Dataset 或 theme（`packages/ConfigForm/model/src/types/contracts.ts:198`、`:202`、`:203`、`:204`、`:207`）。Zod schema 用 literal version 和 strict object 固化同一形状（`packages/ConfigForm/model/src/schemas/project.ts:300`、`:301`、`:304`、`:305`、`:306`、`:317`、`:318`），引用完整性又要求 home 存在并检查 Page route 唯一（同文件 `:1190`、`:1203`、`:1207`）。因此必须一次性替换为 `homeSurfaceId/surfaceOrder/surfacesById/datasetOrder/datasetsById/resources/theme`，并断言 home 指向 `kind: 'page'`。

2. **Repository 和事务不是通用资产层。** 内存 Repository 只拆分 Page 与 Resource 实体（`packages/ConfigForm/model/src/services/repository.ts:85`、`:86`、`:93`、`:121`、`:131`），revision 也只有 manifest/pages/resources（`:151`-`:154`）。Page commands 对 add/remove/move/rename/route/home 都直接操作 `pageOrder/pagesById/homePageId`（`packages/ConfigForm/model/src/services/transactions/services/project-page-operation.ts:27`、`:56`、`:64`、`:68`、`:80`、`:113`）。Surface foundation 需要通用 Surface 操作、kind 不可变约束、Dataset/Resource 独立 revision，以及以 `surfaceIds/datasetIds/resourceIds` 表达的 change set；不能在旧 Page 操作旁再维护一套影子模型。

3. **编译身份和增量缓存均以 Page 为中心。** Canonical IR 保存 `homePageId/pageOrder/pagesById`，`CanonicalPageIdentity` 和 `PageCompilation` 都携带 `pageId`（`packages/ConfigForm/compiler/src/types/compiler.ts:49`、`:52`、`:115`、`:119`-`:121`、`:146`-`:157`）。Project compiler 按 pageOrder 编译并输出同一结构（`packages/ConfigForm/compiler/src/services/compile/services/project.ts:38`-`:45`、`:63`-`:65`）；coordinator 又以 pageId 维护 dirty set、committed cache 和 cache key（`packages/ConfigForm/compiler/src/services/compile/services/coordinator.ts:53`、`:89`-`:93`、`:144`-`:167`、`:193`）。目标应为每个 SurfaceAsset 编译一次、引用只保留 ID、缓存键使用 `surfaceId + surface revision/semantic identity`，避免循环引用触发递归编译。

4. **Vue backend 也暴露 PageCompilation。** Runtime input 是 `PageCompilation` 或 `ProjectCompilation + pageId`，artifact 返回 pageId（`packages/ConfigForm/vue-backend/src/types/runtime.ts:98`-`:105`）；编译器从 `ir.pagesById[pageId]` 取页面（`packages/ConfigForm/vue-backend/src/services/compile.ts:419`、`:429`、`:440`、`:467`）。它需要改为 Surface compilation/runtime artifact，同时保留 Page/Dialog/Drawer presentation 所需的明确投影，不能让 overlay presentation 藏入任意 graph props。

5. **IndexedDB codec 只有 Page/Resource 两种实体。** 当前 manifest/entity codec 均为 v3（`packages/ConfigForm/workbench/src/project/persistence/adapters/indexed-db-project-codec.ts:24`-`:25`），stored snapshot 只有 pages/resources（`:224`-`:258`），元数据仍写 `homePageId/pageOrder`（`:261`、`:267`-`:272`），恢复时也重建 `pagesById/resources`（`:328`-`:365`）。新 codec 必须显式拆分 Surface、Dataset、Resource 并同步 recovery draft、retention、checksum、entity revision 和 key reachability；旧 v3 数据按已确认策略直接 fail closed，不迁移。

6. **Runtime Host、Preview 和缓存把 pageId 当运行身份。** Runtime Host v6 的 message base 强制 `pageId/projectId/revision`，load payload 是 `PageCompilation`（`packages/ConfigForm/workbench/src/runtime-host/constants/protocol.ts:2`；`packages/ConfigForm/workbench/src/runtime-host/types/protocol.ts:11`-`:18`、`:49`）。schema 还交叉校验 message pageId、snapshot identity 和 compilation key（`packages/ConfigForm/workbench/src/runtime-host/schemas/protocol.ts:54`-`:64`、`:212`-`:214`）。Workbench runtime cache 同样以 pageId 为 Map key（`packages/ConfigForm/workbench/src/session/services/page-runtime-cache.ts:13`、`:19`-`:23`、`:38`-`:47`）。新协议必须区分 `surfaceId`（定义）、`instanceId`（一次打开）和 `parentInstanceId/openerNodeId`（调用关系）；重复打开同一 Surface 时，表单值、校验、参数和焦点状态不能因缓存或 host identity 共用。

7. **Page transfer 与导入重映射无法直接承载跨 Surface 依赖。** 现有单页 envelope 为 v2（`packages/ConfigForm/workbench/src/project/import/constants/version.ts:1`；`packages/ConfigForm/workbench/src/project/import/services/transfer.ts:8`、`:23`），只从 `pagesById` 取一个 Page。更关键的是，identity remap 会改结构化 field operand，却明确保持 expression source 原文（`packages/ConfigForm/workbench/src/project/services/identity-remap.ts:26`-`:31`、`:49`-`:52`），完整项目导入又逐 Page 分别重映射（`packages/ConfigForm/workbench/src/project/import/services/identity.ts:19`-`:32`）。一旦表达式引用字段 ID，导入后可能静默指向不存在字段。新导入必须先建立项目级 Surface/field/node/dataset ID 映射，再以安全 AST 重写表达式引用并重新校验；不能用字符串替换。单 Surface 传输必须携带依赖闭包，或要求用户显式重绑定外部 Surface/Dataset/Resource 引用。

8. **Source generator 当前直接遍历 Canonical Page。** generator v4.0.0（`packages/ConfigForm/workbench/src/project/export/services/snapshot.ts:20`）从 compilation 的 `pageOrder/pagesById/homePageId` 构建项目（`packages/ConfigForm/workbench/src/project/export/services/source.ts:43`-`:52`）。Surface foundation 至少要让现有 generator 读懂新 IR，保证仓库可构建；独立 Source 包子任务再搬迁 generator/viewer，并以新的 generator 版本生成 Page 路由、Dialog/Drawer host、Dataset 和 prototype-runtime，而不是在模板中复制一套会话逻辑。

### 交互合同的关键缺口

现有 `ConfigFormReaction` 把 `setValue/clearValue`、`setState/setProps` 和 `validate` 放在同一个 effect union（`packages/ConfigForm/core/src/reaction/types/contracts.ts:31`-`:49`）。求值器会先反复执行所有 value effect 直到收敛，再投影状态与 props（`packages/ConfigForm/core/src/reaction/services/evaluate.ts:63`-`:95`、`:114`-`:129`）。Headless Controller 创建时立即调用该求值器，并可能把 reaction 产生的值写回 model（`packages/ConfigForm/headless/src/services/controller.ts:112`-`:128`）。这与已确认的“值动作只在依赖字段变化后执行，初始化时不执行”直接冲突。

不要用一个 `initializing` 布尔补丁继续复用混合 reaction。新合同应拆成三个执行通道：

- 持续纯投影：`visible/disabled/readonly/required` 与 Material 白名单展示属性，可在初始化和每次依赖变化后计算。
- 变化触发值动作：`set/copy/clear`，记录已建立的 baseline，只有声明依赖发生用户/结果事务变化后执行；同一事务统一求稳并检测循环。
- 单一主要 UI 动作：`navigate/back/open/closeCurrent/closeAll`，仅由 Prototype Runtime 在语义激活时执行，绝不进入 Runtime 的 DOM 事件转发或 handler registry。

状态投影和值动作可以复用现有安全表达式分析、克隆、循环检测等纯能力，但需要独立的类型和入口。这样既能恢复 Demo 联动，又不违反“无事件域、无 Flow、无任意函数”的产品边界。

### 推荐依赖顺序

1. **先更新长期合同。** 将 Studio/Designer/Prototype Runtime/Source 定位、三栏 Inspector、Surface/Dataset/Interaction 术语、错误矩阵和新版本表写入 spec 与架构 README。当前 `product-boundaries.md` 仍规定 Designer 只有 properties/validation 两栏，且 reactions 只读；它与本任务已确认决策冲突，未更新前不应启动实现子任务。
2. **原子完成领域基础。** Model schema/types/commands/reference index/change set、Registry snapshot v3 类型/Reader 与现有基础物料条目、Memory Repository、IndexedDB codec/recovery、Compiler/IR/coordinator、Vue backend、Workbench import/session/runtime-host 和现有 Source 读取路径同时切换，所有旧/未来/缺失/混合版本 fail closed。
3. **建立 Prototype Runtime 的纯会话核心。** 研究时点尚未确认的包名后续已定型为 `@moluoxixi/config-form-prototype-runtime`；其核心 reducer 管理 page history、overlay instance stack、参数/结果事务和主要 UI 动作，不依赖 Studio/Designer/UI adapter。Workbench Preview 与未来生成项目消费同一实现。
4. **再做 Studio 资产 UI。** 资产树、Page/Dialog/Drawer 编辑壳、调用路径和独立 Design 工作流只消费公开 Model API，不在资产任务提前建设 Experience 切换或复制领域 reducer。
5. **再接 Dataset、物料与交互作者 UI。** Dataset 是项目级只读对象数组；组件只存稳定 datasetId + projection。Materials 扩充 Registry v3 物料条目、编辑 UI 与 adapter 映射，但不再次升版或发明能力合同；Interaction Inspector 写入新的封闭合同，并拥有 Design/Experience 切换，不恢复 DOM 事件元数据。
6. **最后物理抽离 Source 包。** 无 DOM generator 和异步 Viewer 分层；Studio 弹窗只负责编排复制/下载/通知。用同一 compilation + prototype-runtime 做 Preview/生成项目 parity。

### 最小验证矩阵

- Model：新合同 happy path；旧/未来/缺失/混合 version 全拒绝；home 非 Page、kind 原地变更、悬空 Surface/Dataset 引用均拒绝。
- Repository/IndexedDB：Surface/Dataset/Resource 独立 revision；并发 commit、recovery、retention、checksum、孤儿实体清理；v3 codec fail closed。
- Compiler/Vue backend：三种 Surface 每个只编译一次；循环引用不递归；增量缓存只失效受影响 Surface/Dataset；旧 IR/compiler key 拒绝。
- Interaction：初始化只计算状态、不执行值动作；字段变化后 set/copy/clear 恰好一次事务；循环/非法表达式阻止体验与导出。
- Prototype Runtime：同一 Surface 重复打开实例隔离；A -> B -> A；back/closeCurrent/closeAll；参数只读；结果映射原子提交并随后运行联动。
- Import/export：表达式字段引用随 ID 安全重映射；单 Surface 依赖闭包/重绑定；旧 Page transfer 拒绝；项目 JSON 往返语义稳定。
- Preview/Source：Runtime Host 混合版本拒绝；Preview 与生成项目执行同一导航、浮层、Dataset 和联动场景；生成项目 install/typecheck/test/build 通过。
- 全仓门禁：`pnpm test:config-form-packages`、`pnpm test:package-architecture`、Model/Compiler/Workbench tests、Workbench typecheck/build/E2E、`pnpm test:release` 和 frozen lockfile 检查。

### Files Found

- `packages/ConfigForm/model/src/types/contracts.ts` — 当前 ProjectDocument/PageGraph/ProjectChangeSet 公共形状。
- `packages/ConfigForm/model/src/schemas/project.ts` — current-contract-only Zod Reader 与引用完整性。
- `packages/ConfigForm/model/src/services/repository.ts` — Page/Resource 实体拆分与 revision 聚合。
- `packages/ConfigForm/model/src/services/transactions/services/project-page-operation.ts` — Page 专用资产命令。
- `packages/ConfigForm/compiler/src/types/compiler.ts` — Canonical Page IR、PageCompilation 与身份合同。
- `packages/ConfigForm/compiler/src/services/compile/services/project.ts` — 项目到 Page IR 的全量编译。
- `packages/ConfigForm/compiler/src/services/compile/services/coordinator.ts` — pageId 增量缓存与 dirty tracking。
- `packages/ConfigForm/vue-backend/src/types/runtime.ts` — Page compilation 到 Vue artifact 的公开入口。
- `packages/ConfigForm/vue-backend/src/services/compile.ts` — IR/compiler version gate 与 Page lookup。
- `packages/ConfigForm/core/src/reaction/types/contracts.ts` — 当前混合 reaction effect 合同。
- `packages/ConfigForm/core/src/reaction/services/evaluate.ts` — 值求稳和状态投影混合执行。
- `packages/ConfigForm/headless/src/services/controller.ts` — 初始化即执行 reaction 并写值的证据。
- `packages/ConfigForm/workbench/src/project/persistence/adapters/indexed-db-project-codec.ts` — v3 Page/Resource IndexedDB codec。
- `packages/ConfigForm/workbench/src/project/services/identity-remap.ts` — Page 身份重映射及表达式不重写限制。
- `packages/ConfigForm/workbench/src/project/import/services/identity.ts` — 项目导入逐 Page 重映射。
- `packages/ConfigForm/workbench/src/project/import/services/transfer.ts` — 单 Page transfer envelope。
- `packages/ConfigForm/workbench/src/runtime-host/types/protocol.ts` — v6 pageId/PageCompilation 消息合同。
- `packages/ConfigForm/workbench/src/runtime-host/schemas/protocol.ts` — Host identity/version fail-closed 校验。
- `packages/ConfigForm/workbench/src/session/services/page-runtime-cache.ts` — pageId keyed Vue runtime cache。
- `packages/ConfigForm/workbench/src/project/export/services/source.ts` — Canonical Page 源码生成入口。
- `packages/ConfigForm/workbench/src/project/export/services/snapshot.ts` — Export generator 版本与快照封装。

### External References

无。本研究只依据仓库当前代码、任务 PRD/设计和 Trellis specs；未引入第三方协议或版本假设。

### Related Specs

- `.trellis/spec/config-form/frontend/product-boundaries.md` — current-contract-only、禁止事件域和包依赖方向；其中 Designer Lite 两栏约束需要由合同子任务更新。
- `.trellis/spec/config-form/frontend/runtime-state-boundaries.md` — Headless/Runtime 值、reaction、listener 和 Source parity 边界。
- `.trellis/spec/config-form-core/frontend/architecture-documentation.md` — ConfigForm README、包边界和跨包变更同步要求。
- `.trellis/spec/config-form-workbench/frontend/quality-guidelines.md` — Source 服务拆分、Preview/Source parity、持久化异步所有权和 E2E 门禁。
- `.trellis/spec/guides/cross-layer-thinking-guide.md` — 多层合同、平行 Runtime 和生成代码的共同验证要求。
- `.trellis/tasks/09-18-config-form-demo-studio/prd.md` — 已确认产品范围与 AC1-AC12。
- `.trellis/tasks/09-18-config-form-demo-studio/design.md` — Surface/Instance/Dataset/Interaction 技术合同。
- `.trellis/tasks/09-18-config-form-demo-studio/implement.md` — 子任务顺序与停止条件。

## Caveats / Not Found

- 研究时点尚未确定的新版本数值、Prototype Runtime 包名和公开入口，已由后续 `config-form-studio-contracts/design.md` 统一定型；各实现包不得自行改选。
- 本研究聚焦跨包基础合同，没有穷举两套 Designer adapter 的每个物料、setter 和 UI 文件；这些应在 materials/interactions 子任务分别审计，但不能改变这里的依赖方向。
- 现有安全表达式以 source 形式保存，仓库没有可直接证明“跨 ID 重写后再序列化”的现成公共 API；若解析器不能无损完成该工作，导入应 fail closed，而不是保留可能悬空的表达式。
- 现有 Runtime 的 host `props.onX` 函数仍是工程师代码态能力，不应因 Studio prototype interaction 而删除或序列化；两者必须保持不同合同。
- 由于已确认不迁移旧 ProjectDocument，测试夹具、内置模板和本地 IndexedDB 旧数据都会失效，这是预期破坏性变化，需要明确的清库/错误提示，而不是兼容 Reader。
