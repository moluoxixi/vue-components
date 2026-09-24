# 验收台账

批准合同 AC1-11 是最终完成标准。以下只记录已核实的阶段事实，不把局部通过当成整体完成。父任务与事件子任务仍为 `in_progress`。

## GPT-6 修复与继续实施

2026-09-13，用户已要求开始修复并继续实现，AC1-11 不缩减。以下为本轮逐项验证快照，后续并行改动仍须重新集成验证。

- 已统一 RuntimeHost 的 `artifact.renderer` 消费合同，并修复过期 fixtures、重建 Vue backend 声明；字段错误/meta 恢复 Vue 响应式订阅。
- Runtime 本轮回归为 16 文件 / 105 测试通过，原 7 项失败已收敛。日志：`gpt6-runtime-repair-test.log`。
- 测试代理使用两个全新隔离浏览器上下文，Element Plus 与 Ant Design Vue 均完成创建项目、画布真实字段、预览填写，1440×900、1280×800、390×844 文档级横向检查通过；12 项通过，page error 为 0。证据：`gpt6-repair-browser.json`、`gpt6-repair-{element,antd}-{1440,1280,390}.png`。尚不替代合同规定的全部视口/业务场景。
- 同一快照的 Workbench typecheck 退出 0；动态拓扑/作用域事务/协议改动合并后必须重跑。
- Core 第一轮修复 149 测试通过；Headless 第一轮 72 测试通过。独立复核仍发现输出复制时机、事务嵌套初值浅拷贝、忽略 Abort 的 lifecycle hook 与 reset/submit 交错窗口，第二轮修复进行中，不能宣称内核验收完成。
- Model 125 / Compiler 46 测试通过，混合移动与内容修改、组件原型键及事务来源认证已修复。性能六轮中两轮仍超原预算，保留失败记录；完整 lint 仍有 9 项，尚未通过最终门禁。
- Source 安全输出改用数据绑定，真实 SFC 执行回归及字段/Flow parity 共 54 项通过。使用带 provenance 的 `sass@1.103.1` 正常升级解决依赖信任阻断，没有关闭信任检查。最后独立工程验证安装通过，但两工程被正在修改的 Runtime 类型错误阻断，结果仍为 0/2，待重新执行。
- 设计器已补齐九个非组件生命周期入口，复用 Core 触发器列表；组件测试 13/13、Designer typecheck 通过。打开入口无文档修改，readonly 与重复流程状态有回归；浏览器完整编辑矩阵待验证。
- 实例 Flow 写回、Preview 自然嵌套值/实例状态/提交身份、动态 valueSchema 同步以及完整 Config 导出仍在实施。正式对象/数组/明细表物料、命名源到动态选项和双 Provider 三业务场景仍开放。

所有日志与临时截图位于当前会话 scratch。未提交、推送、发布、回滚既有工作或清理用户持久化。

## GPT-6 修复前复核

2026-09-13，用户要求改用 GPT-6 并先评估代码可保留性。当前审计统一使用 `custom/gpt-6-astra`，业务实现冻结；详见 [GPT-6 审计](audit-gpt6.md)。

- 当前版本不可交付：两套 Provider 实际创建项目后，设计画布和预览均因 artifact/renderer 合同断裂报错。
- Workbench 当前 625 测试通过 / 20 失败，typecheck 有 5 处诊断；build 退出 0 不代表实际可运行。
- 六个底层包当前合计 435 测试通过 / 7 失败；失败集中在 Runtime，源码入口补验仍失败。部分原 typecheck 读取旧 dist 声明，必须区分验证入口。
- 本轮 `verify:templates` 为 0 通过 / 2 失败：两工程都已生成，安装因 `chokidar@4.0.3` 的 `ERR_PNPM_TRUST_DOWNGRADE` 被拦截，未执行后续 typecheck/build，没有绕过依赖信任检查。
- 另外实测复现超时动作晚写入、重置后提交锁不释放、行排序读错运行快照，以及 Source 页面名称的模板表达式执行。
- 保留 Core/Headless/Model/Compiler 和 Flow/Data 编辑器的有效基础，针对性返工 Runtime 协调与事务写回、Preview 作用域恢复、Config 导出投影；不整体回滚或删除既有工作。
- 原 AC1-11 不变。正式子表单物料、完整事件入口、命名源到动态选项和双 Provider 三业务场景仍未完成。

## 较早阶段快照

以下保留历史推进事实，不再表示最新源码已通过相应验证。独立导出与完整门禁以 GPT-6 审计及其本轮日志为准。

| 条目 | 当前状态 | 证据与未完成内容 |
| --- | --- | --- |
| AC1 产品实测 | 部分完成 | FormCreate 与 VForm 共 32 张正式证据；VForm 三类子表单增删、required 和 SFC 已实测。FormCreate 保存需登录；VForm 表格增删、有效 JSON 往返和可运行导出仍未验证 |
| AC2 可视化事件 | 实施中 | 有序步骤树、结构化来源、Save/Cancel、排序复制删除和分支已实现；稳定引用控件与可定位诊断已补，完整浏览器交互矩阵待跑 |
| AC3 生命周期动作 | 实施中 | Core/Headless/Renderer 已接入生命周期与提交阻断；Workbench 显式提供请求、确认、通知和导航宿主能力；数据源/变量及全部表单动作未闭环 |
| AC4 异步诊断 | 实施中 | Core 取消/并发/策略/trace 已有回归；PreviewSession 改为 iframe 镜像，运行记录 UI 已通过真实提交链路和三视口检查。RPC 完整回归及 row task cancellation 待收敛 |
| AC5 变量数据源 | 实施中 | Core manager 与稳定 ValueInput、Model page.runtime、Compiler IR 已建立；可视化管理界面正在实施，级联/运行状态/Preview/Source 接入未完成 |
| AC6 嵌套明细 | 实施中 | Core rowId store 与 Headless 实例 API 已实现；Headless 44 测试通过。Runtime/两层数组渲染、双 Provider 物料和 Source 尚未完成 |
| AC7 状态语义 | 实施中 | Headless 生命周期、阻断、异步校验、深克隆与实例状态已有测试；根字段局部更新保留 unkeyed rowId 的最后边界仍需确认，真实 UI 明细语义未闭环 |
| AC8 设计器操作 | 未完成 | 既有操作保留，新编排指定视口与双 Provider 完整交互未验收 |
| AC9 运行导出等价 | 部分基础 | 编译 flowPlans 已进入 Vue renderer；Source 自定义动作绑定预检已建立，但 source-page 仍有独立字段/提交状态机，数据源/数组 parity 未完成 |
| AC10 完整质量 | 未通过 | Core 131 测试及 typecheck、Headless 44 测试、Workbench typecheck 与 Preview/动作 12 项定向测试通过；Compiler 38/39，组合拖拽 p95 18.59ms 超 16.7ms，性能代理正在修复。全量递归/build/E2E/生成工程待复验 |
| AC11 文档 | 实施中 | 研究、设计和本台账持续更新；最终架构/API/业务示例必须随完整实现更新 |

## 已执行基线

2026-09-12，Node v24.19.0，pnpm 10.29.3。原始日志位于会话 scratch。

| 命令 | 退出码 | 结果 |
| --- | --- | --- |
| ConfigForm scoped recursive test | 1 | 180 通过 / 1 失败，compiler 架构目录清单缺 runtime-source；余包因首错中止 |
| ConfigForm scoped recursive typecheck | 2 | 7 包无诊断；designer 7 诊断；6 包未完成 |
| Workbench test --maxWorkers=2（旧基线） | 0 | 54 文件 / 590 测试通过，不代表当前源码质量门禁 |
| Workbench typecheck（旧基线） | 0 | 无诊断 |
| Workbench verify:templates（旧基线） | 0 | 2 测试通过，两个生成项目安装/类型/构建通过；新能力尚需复验 |

## 当前验证

2026-09-13，本轮继续使用相同 Node/pnpm 环境。

- Core 稳定引用接入后，主代理复跑 14 文件 / 131 测试通过，typecheck 通过。
- Model/Compiler 代理报告 Model 104 测试通过，包括 2000 节点原有预算。主代理实跑 Compiler 38 通过 / 1 失败，组合事务、snapshot 与 compile 的 p95 为 18.5882ms，预算仍为 16.7ms，未放宽阈值。
- Headless 当前 8 文件 / 44 测试通过，包含 6 项对象/数组 controller 回归；完整 Runtime 消费正在实施。
- Workbench typecheck 通过。控制器返回面改为命名公开合同，解决新增递归模型触发的 TS7056，未更改运行语义。
- PreviewDrawer 9 项、Workbench actions 3 项测试通过。覆盖 trace 200 条上限、4096 字符载荷与错误文本上限、HTML 转义、追加保留 DOM/展开状态/焦点、键盘页签、全屏关闭守卫及显式宿主能力。
- Workbench 全量测试实测 49 文件通过 / 8 文件失败，610 测试通过 / 18 失败。主要失败为第三方 source 入口、contracts 目录归属、两处 9px 字号、旧父窗口引擎断言、Source actions 模块闭包和无效模板夹具。第三方入口修复后的 inspector/event-target 定向 4 项测试已通过；剩余失败尚未完整复验。

## 浏览器证据

真实流程：隔离浏览器创建 Element Plus 资料表单，配置 `form.submit` 结束步骤，显式保存，打开预览、填写并提交，显示 6 条运行记录。1280×800、1440×900、390×844 下结果区横向溢出均为 0，弹窗边界均在视口内，控制台零错误。

证据当前保存在会话 scratch：

- `preview-browser-check.cjs`
- `preview-browser-report.json`
- `preview-trace-1280x800.png`
- `preview-trace-1440x900.png`
- `preview-trace-390x844.png`

这只验证提交与 trace 的当前链路，不代表所有 AC 或两种 Provider 均已通过。

## 实施发现

- Workbench 的 Vite/Vitest 原先读取旧 workspace `dist`，导致浏览器丢失新增 `flowPlans`。曾尝试全局 `source` 条件，但第三方 `scroll-into-view-if-needed` 声明了未发布的 source 路径。当前改为 `scripts/workspace-source-aliases.ts` 只读取本仓库 ConfigForm 包的 `exports["."].source` 并设置精确包根别名，Vitest 为该 namespace 配置 noExternal；第三方依赖保持正常发布入口。
- 长时间开发服务还可能保留引用类型的旧 SFC props/emits 缓存。最终浏览器检查使用新 Vite 实例，不依赖旧缓存。
- 本环境会回收工具命令启动的子服务。真实检查在同一命令内启动临时 4333 服务、执行 Playwright 并关闭。先前 4332 服务未主动终止。
- PreviewSession 不得重新增加父窗口 Flow dispatch。iframe 是表单事务所有者，父窗口只提供可信能力与状态/trace 镜像。
- Source 仍需移除重复字段/校验/提交状态机，完整复用同一 runtime plan。

上述较早阶段的代理使用 `custom/gpt-5.6-sol`；用户最新要求后已改为 `custom/gpt-6-astra`。已有脏改动全部保留；没有 reset、push、publish、清理用户持久化或提交代码。

## 2026-09-14 门禁回归修复

HEAD `e7892ff6` 提交时门禁为红。本轮把工作台测试从 3 文件 / 36 项失败收敛为 1 文件 / 1 项失败。

已修复根因（每条均已实测）：

- `architecture-boundary.test.ts` 的 `misplacedContracts` 原用纯文本正则匹配 `^export (interface|type)`，把 `compiler/src/runtime-source/services/sources.ts` 与 `workbench/src/project/export/services/config-page.ts` 中**生成代码模板字符串**的内容误判为类型声明。改为 `@babel/parser` 顶层声明判定；两处真实违规（`runtime/src/renderer/services/runtime-actions.ts`、`array-rendering.ts`）与两个测试夹子的类型分别由 `renderer/types/`、`renderer/__tests__/types/`、`project/__tests__/types/` 承载。结果 19/19 通过。
- `business-scenarios-parity` 的两类根因：夹具对 required 字段声明 `defaultValue: ''`，被新版本 `diagnoseDefaultRules` 判为 `VUE_RUNTIME_DEFAULT_RULE_INVALID`；生成的 `form.config.ts` 新增 `@moluoxixi/config-form-vue-backend` 值导入，而测试的模块加载器外部依赖白名单未同步。分别修正夹具默认值与加载器 external。
- 同文件两处契约漂移：`PageCompilation.snapshot` 已在 HEAD 更名为 `snapshotIdentity`（断言已按新结构精确化）；`detail-table` / `array-subform` / `object-group` 三个容器物料在两个组件库中的 `source.tag` 误写成物料名，使生成的独立源码渲染 `<div>`，与运行时 `Section` 组件的 `<section>` 不一致，Source 路径的数组增删无法定位。已统一为 `section`。
- 运行时把 `severity: 'warning'` 的创作期诊断（如已注册的宿主动作缺少 authoring descriptor）经 `flowError` 抛出，成功提交也会被判为错误。现仅转发非 warning 诊断；warning 仍保留在 dispatch 结果与 trace 中。
- 设计器物料面板从单列列表改为两列图标磁贴，对齐 FormCreate Pro / VForm 3 Pro 的组件面板；`theme-contract` 的调色板断言随之更新为磁贴契约。1440×900 实测：磁贴 106.5×46、每行 2 个、面板宽 232、无文字溢出、控制台 0 错误。

仍为失败（未在本轮引入，也未修复）：

- 工作台 `config-runtime-parity` 自定义校验器 1 项。实测自定义校验器被以正确值 `'Taken'` 调用且返回 `'Already used'`，但该 issue 未进入控制器错误表（`getErrors()` 与 `getInstanceErrors` 均为空），连续多轮 flush 后仍为空，可排除时序因素；落点应在控制器校验提交与地址键之间。
- headless `controller-model-identity` 2 项（keyed 行替换后身份丢失、`Invalid retained array identity`）与 `controller-scope-refresh` 2 项（祖先 `itemKey` 变更未回收后代身份）。
- `runtime` 的 `nested-materials` 2 项：复制行会连带复制 `itemKey` 业务主键。
- 以上三项同属「行身份 / itemKey」缺陷簇，应作为同一轮修复。
- 本轮未执行：物料面板视觉变更后的 e2e 快照更新、`typecheck`（designer 组仍有 7 处未使用变量诊断）、工作台 build。

临时调试用例已删除；未新增持久化数据，未提交、推送或发布。

## 2026-09-15 功能缺陷簇、UI 对齐与工程收尾

工作台测试从 1 文件 / 1 项失败收敛为 **69 文件 / 761 项全部通过**；剩余唯一门禁阻塞是一个**既有的**未处理错误（见末尾）。包级测试 116 文件全绿。

### 行身份 / itemKey 缺陷簇（HEAD 新增但从未通过）

- `core` 的 `duplicateRow` 会把源行的 `itemKey` 业务主键一起复制，产生重复业务主键。现仅在作用域声明了 `itemKey` 时从副本中剔除该字段，由宿主重新分配。
- `headless` 的模型观察器 `prepare` 无法在「宿主整体替换了值对象」时保留身份：声明了业务主键的方案无法据此证明可协调，未声明主键的数组又没有任何参照。现按三条规则协调：引用相同 → 按行引用；主键匹配 → 按 itemKey；仅路径匹配且**方案里存在主键声明** → 未声明主键的数组按行位置保留（已声明主键的数组仍按 itemKey，避免重排时错配）。空数组不再上报保留条目（Core 明确拒绝空 `rowIds`，该拒绝本身有测试保护）。
- 观察器改为不再进入「宿主有、但 store 并不拥有」的行：用伪造的父作用域下钻会触发 `CONFIG_FORM_SCOPE_ANCESTOR_MISMATCH`，这条路径在 schema 刷新裁剪行之后必然出现。

### 校验结果被静默丢弃

- 现象：自定义校验器被以正确值调用并返回消息，但错误表始终为空。追踪发现 blur 校验期间「配置的 blur 流程事件」会提交一次作用域写入（`finalizeScopedMutation`），它无条件调用 `validation.invalidate()`，把刚产出结果的在途校验连同结果一起丢弃，且 `catch` 分支在 abort 时静默返回。
- 现仅在提交确实改变了值时失效；无关路径保持原行为（`getValidating()` 为假时不做深比较，避免每次提交的全量深比较开销）。

### UI 对齐成熟产品

- 左侧物料面板从单列列表改为两列图标磁贴（`designer-palette.scss` + `StudioLeftPanel/style/index.scss`）。
- 工具栏改为「图标 + 文字」：文字标签原在 900px 以下才显示、桌面端反而隐藏；现桌面端（>900px）显示 Save / Export / Preview / New page 文字，641–900px 仍保留 Save / Export 文字（e2e 已固定该行为），Preview 文字不进入紧凑区间，≤640px 全部收起为图标。

### 工程收尾

- `pnpm typecheck`（turbo 聚合）**在本仓库无法运行**：`@moluoxixi/config-form-vue-backend ↔ designer ↔ config-form ↔ designer-element-plus` 存在**既有的循环依赖**，turbo 直接报错退出。已改为逐包验证，12 个包全部通过。
- runtime 包 `build` 原本**失败**（`DesignerPropertyPanel/index.vue` 的 `propertyPanelRef` 触发 TS6133），导致 `runtime/dist` 类型长期停留在旧版本，进而让 workbench 的 `getVariables` / `getOptionState` / `getDataSourceState` 报「属性不存在」共 10 处。已修复并重建 dist（88 个 d.ts）。
- 顺带修掉 workbench 的既有类型错误：`flow-actions.ts` 缺少 `WorkbenchFlowActionHooks` 导入；`scoped-reference-parity.test.ts` 从错误的包导入 `ConfigFormValues`；两个夹具函数补显式返回类型（`composite` 声明产出下的 TS7056，契约类型来自 Compiler/Runtime，展开后超出可序列化上限）。
- designer 既有 7 处未使用变量诊断已清除。

### 未完成

- **门禁退出码**：vitest 报告 `Errors 1 error`——`runtime-host-instances.test.ts` 中 `readValues → getValues → replaceValues → normalizeValues` 抛出 `DataCloneError`（宿主值含不可克隆内容）的浮空异常，出现在用例结束之后。**基线运行时（本会话最早的 verify1）同样是 `Errors 1 error`**，即既有问题，本轮未修。769→761 项断言全部通过但进程退出码仍为 1。
- **e2e 无法在本机环境完成**：`--update-snapshots` 跑完 121 项后大量失败，追查发现所有失败都汇聚到 `createProject()` 等待画布节点，而设计画布 iframe（`/runtime-host.html`）的模块请求全部 `net::ERR_ABORTED`，子框架从未初始化（iframe 高度停留在 1px，因为几何消息依赖子框架）。空白模板与资料表单模板表现一致，说明与本次 UI 改动无关。仅 4 个「创建页」快照（900/390）被新写入且其断言通过；1440 设计器视觉基线**尚未重算**。
- 交付限制同上一节：未提交、未推送、未发布。

## 2026-09-15（续）设计画布空白的根因修复

**症状**：设计器创建项目后画布一片空白，任何字段节点都不渲染；e2e 全部失败（都堵在 `createProject()` 等 `[data-config-node-id^="profile-name-"]`）。

**根因（已实测确认）**：协议不匹配。运行时宿主的入站守卫 `isParentToRuntimeHostMessage` 通过 `isRuntimeHostRuntimeState` 要求 `runtimeState.fields` 必须是数组（`schemas/protocol.ts:142`，类型定义 `RuntimeHostRuntimeStatePayload` 也标注该字段「仅来自 `Renderer.listFieldInstances()`」），而 `DesignRuntimeHostFrame` 发送的 `sync` / `state` 载荷里**没有 `fields`** → 子框架把每一条 sync 都判为非法并静默忽略 → `active` 始终为空 → 画布只有 1px 高的空 iframe。

证据链：

1. 画布 iframe 高度恒为 1px（内联样式 `height:1px`），子框架 `data-mode` 始终是 `preview`、`data-runtime-session` 为空。
2. 子框架确实收到了 sync（父级每条 `postMessage` 都被记录），但从不回 `ready`/`mounted`/`geometry`。
3. 在子框架内动态 import 协议守卫并喂入真实载荷：`isParentToRuntimeHostMessage(payload) === false`，而 `isRuntimeHostRuntimeState(payload.runtimeState) === false`。
4. 用极小载荷逐项替换（含合成 compilation）仍为 false —— 因为所有候选都缺 `fields`；补上 `fields: []` 后守卫立刻返回 true。

**修复**：`DesignRuntimeHostFrame` 新增 `designRuntimeState(): RuntimeHostRuntimeStatePayload` 构造器，显式返回 `fields: []`（设计态由 frame 内渲染器驱动，父级没有实例列表可镜像，因此为空数组——与 `isolated-preview.ts`、各测试的写法一致），并把两处载荷改用它。**返回类型标注是关键**：原先载荷是字面量直接传给 `postMessage(Record<string, unknown>)`，缺字段不会被类型检查发现。

**顺带修复的握手健壮性**：父级原先只在 `handleLoad` 与响应式变更时发送 sync，一旦消息落在子文档监听器挂载之前（子框架重载、模块图仍在求值）就永久丢失，没有任何重试。现改为：收到子框架 `mounted`/`ready`/`runtimeState`/`geometry` 视为确认；未确认前每 400ms 重发（上限 25 次），`handleLoad` 与 revision 变更都会重置确认状态，卸载时清理定时器。

**验证**：画布渲染出 Name / Role / Active 三个节点（frame 内 `nodeCount: 3`），iframe 高度从 1px 恢复到 74px，`data-mode="design"`、会话键已建立；工作台 69/69 测试文件通过、typecheck 通过。

**仍未修**：workbench 测试以 `Errors 1 error` 结束（`runtime-host-instances.test.ts` 结束后浮空的 `DataCloneError`），断言 761/761 通过但进程退出码为 1；此问题在本会话最早的基线运行时同样存在。

### 物料面板：与既有 e2e 契约对齐

`e2e/interaction.spec.ts` 的 `expectAllPaletteItems` 把物料行高钉死在 **32–36px**；我先前把面板改成两列图标磁贴时用了 46px，违反该契约。现已改为 **34px 定高**（两列保留、图标+名称同一行、名称单行省略），实测行高恒为 34、每行 2 个、每个物料 1 个图标 + 非空名称 + 有效 summary、无 preview 元素。

### e2e 现状（画布修复后重跑）

- 从「几乎全部失败」变为 **73 通过 / 48 失败**；画布相关的 `createProject()` 阻塞已消失。
- 剩余 48 项为**既有契约漂移**，与本次改动无关，例如第一个失败：`expectAllPaletteItems` 断言左侧导航页签数为 4，实际渲染 5 个 —— 该 helper 与左栏页签定义均非本次改动范围。
- 16 个此前缺失的 win32 视觉基线已由 `--update-snapshots` 生成（既有基线文件 0 个被改写）。

## 2026-09-15（续）e2e 对齐全量基准

命令：`pnpm --filter @config-form/workbench test:e2e`（playwright，desktop-chromium，本机 dev server 4331），耗时 13 分 24 秒。

| 指标 | 上一轮（14:28） | 本轮（19:06） |
| --- | --- | --- |
| 通过 | 73 | **111** |
| 失败 | 48 | **10** |
| 合计 | 121 | 121 |

本轮验证已对齐 38 项：物料面板计数（element 17→20、antd 22→25，与 `designer-*/src/materials/*.ts` 实际材料数一致）、lifecycle 全 36 项、Flow 键盘与数值控件（:882）、lifecycle element 1440 form.initialize。断言范围外未做任何放宽。

### 剩余 10 项与根因

| # | 用例 | 数量 | 判定 |
| --- | --- | --- | --- |
| 1 | `runs a registered non-binding {element,antd} event exactly once`（:1445） | 2 | **产品侧缺口** |
| 2 | `runs a {element,antd} component event flow from the real Preview Runtime node`（:1195） | 2 | 待定（步骤标题未落库） |
| 3 | `lifecycle {element,antd} nested branches ...`（:1826） | 2 | 待实测（条件右操作数默认值矛盾） |
| 4 | `lifecycle {element,antd} import and design ...`（:1788） | 2 | **产品侧缺口** |
| 5 | `provides real Monaco completion and hover for Vue and Config source`（:1638） | 1 | **测试契约漂移，需重写** |
| 6 | `lifecycle element 1440x900 form.valuesChange`（:1691） | 1 | flaky（同轮定向跑曾通过） |

- **#1**：流程确实触发（Preview 的 Run history 递增），但消息不显示。页面快照中可见产品诊断 `Flow action builtin.ui.message can execute, but has no authoring descriptor.`（core `analyzeConfigFormFlowActionDescriptor` 产出 `FLOW_ACTION_DESCRIPTOR_MISSING`，severity=warning）。即「工作台能执行该动作，但编译/创作侧没有对应 descriptor」，属 AC3 未闭环范围。antd 变体在 16:44 的定向跑中曾通过，存在 flaky 成分。
- **#2**：`addFlowAction(page, 'Show message', 'Bound field')` 填充 Step label 之后，检查器中的 Step label 仍为空、步骤树上仍显示 "Show message"；因此 Action output 下拉只有 `Show message result` 与 `Show message · Message`，测试期望的 `/Bound field.*Message/` 不存在。`updateTitle` → `patchSelectedStep` 静态链路正确，需实测 ElInput 的 `change` 是否在 `fill()` + `Tab` 后被提交。
- **#3**：快照显示 compare 条件右操作数为 `Value source = Fixed value`、`Value type = Boolean` + 已勾选 switch，没有 textbox，故 `operands.nth(1).getByRole('textbox').fill('blocked')` 必然超时。但源码默认值（`use-flow-workspace.ts:614-628` 与 `ConditionEditor/index.vue:35-44`）都是 `right: { kind: 'literal', value: '' }`（`staticKind` 应为 `text`）。源码与运行时表现矛盾，需实测区分默认值漂移 / 构建缓存 / 其他覆写路径。
- **#4**：点 `Create imported project` 后 `designRuntime(page)` 内找不到 `Name` textbox；element 变体的页面快照只剩 `- main`（应用整体未渲染）。antd 变体另叠加 axe `aria-required-attr` 违规：预览 iframe 内 `#v-0-fields-1-control` 的 `aria-owns` / `aria-activedescendant` 指向被 teleport 到父文档的下拉，在 iframe 文档内无效。
- **#5**：两侧锚点均已过期 —— `appSource()`（`project/export/services/source-page.ts`）现产出 `const model = createConfigFormModel(values)`，且已无 `import { onBeforeUnmount`；`form.config.ts`（`config-page.ts`）以 `import type { ConfigFormPageRuntimePlan } from '@moluoxixi/config-form'` 开头，已无 `import { defineFields }`。更关键：`typescript-language-features.ts` 只对 `vue` 语言注册了 hover provider，**`.ts` 编辑器没有 hover**，因此该用例的 config-hover 断言在当前实现下不可能通过 —— 需按当前编辑器能力重写，不是改字符串。

### 方法论沉淀

- Playwright 会在 `dist/test-results/config-form-workbench/<slug>/error-context.md` 写入 **YAML 版 ARIA 快照**（完整可访问性树 + 失败断言 + 源码行）。对齐选择器时先读它，比读源码猜 DOM 快得多；**该目录每次运行会被清空，拿到后先备份**。
- 对齐时用 `--grep "<用例名片段>"` 单跑（20–60 秒）做反馈循环，不要每轮跑 13 分钟全量。
- 本机 `PowerShell` 工具的 stdout 不回传、`Bash` 工具不可用；所有观察都要「写文件 → 读取」。后台命令用 `Add-Content` 写日志会在运行期间独占锁文件，须等结束后再读。

本轮未提交、未推送、未发布；未新增持久化数据。设计画布空白的根因修复与上文 111 项通过同属当前工作区状态。
