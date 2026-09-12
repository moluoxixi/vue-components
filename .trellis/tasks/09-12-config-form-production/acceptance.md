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
