# GPT-6 代码可保留性审计

日期：2026-09-13。状态：本轮代码可保留性评估完成，原生产重建任务仍为 `in_progress`；本文不是生产验收通过声明。

## 授权与原目标

用户要求停止继续使用 5.6，改用 GPT-6，确认原始目标没有偏移，并先评估当前代码是否还能保留。本轮后续委派统一使用 `custom/gpt-6-astra`；会话任务列表已无旧代理可取消。业务实现冻结，审计代理只读，未执行回滚、提交、清理持久化或功能扩展。

原批准 [目标合同](../../../.pi/goal/基于成熟产品实测重建事件编排并完善-configform-核心能力-20260912-2011.md) 未变：依据 FormCreate Pro 和 VForm 3 Pro 的真实产品实测，完成生产级事件编排、变量/命名数据源/级联、对象及两层数组和明细表格、校验/提交/重置/只读、设计器操作，并保持两套 Provider 与直接 Runtime、工作台 iframe、独立 Vue 工程的语义一致。AC1-11、三种业务场景及原质量门禁全部保留。

**目标文本没有漂移；实施偏重内核合同和局部测试，跨包集成与用户可完成的业务闭环没有同步收敛。不能用已存在的接口或部分测试通过代替交付。**

## 总体结论

**当前代码不可交付，但没有依据整体废弃。保留已验证的基础，修复明确缺陷，重做少数协调与投影模块。**

当前工作区有 168 个已跟踪修改、5 个删除、177 个未跟踪文件；其中包含任务文档和研究证据，不能全部归因于某一个模型或当作可统一删除的源码。既有约 79 项脏改动同样必须保留。

## 新鲜验证基线

以下均为本轮重新执行，不沿用历史代理的通过结论。

| 范围 | 结果 | 限制 |
| --- | --- | --- |
| Core | 15 文件，136 测试通过；原 typecheck 通过 | 额外行为探针发现节点超时后晚写入缺陷，现有测试不能覆盖它 |
| Headless | 8 文件，45 测试通过；原 typecheck 通过 | 显式源码入口补验仍通过；探针发现不响应 Abort 的校验可永久占用提交锁 |
| Model | 7 文件，106 测试通过；原 typecheck 通过 | 已知可信快路径与注册表问题仍存在，属于测试缺口 |
| Compiler | 4 文件，40 测试通过；原 typecheck 通过 | 原性能阈值本轮通过，但组合重排与内容修改的增量一致性缺口仍存在 |
| Runtime | 13 文件通过、3 文件失败；98 测试通过、7 失败；原 typecheck 通过 | 显式统一源码入口后相同失败，不能归为旧 dist 问题 |
| Vue backend | 2 文件、10 测试通过；原 typecheck 通过 | source typecheck 暴露其 tsconfig 缺 `DOM.Iterable`；补相同命令行 lib 后通过，未改文件 |
| Workbench test | 60 文件中 55 通过、5 失败；625 测试通过、20 失败 | Source、parity 和架构门禁仍失败 |
| Workbench typecheck | 退出码 2，5 处诊断 | 2 处新增 Data mock 返回类型、1 处 Source 签名、2 处 Canonical 夹具 |
| Workbench build | 退出码 0 | 构建成功不能证明实际渲染成功 |
| 两 Provider 浏览器最短主流程 | 创建项目外壳成功；设计字段和预览字段均失败 | 两者均抛出 `Cannot read properties of undefined (reading 'renderer')` |
| Flow/Data 定向测试 | 4 文件、37 测试通过 | 证明草稿编辑基础可保留，不证明业务运行闭环 |
| 独立导出 `verify:templates` | 退出码 1，0 通过 / 2 失败；两工程已生成，均在安装阶段被信任检查拦截 | `sass@1.99.0` 的 `chokidar@4.0.3` 依赖触发 `ERR_PNPM_TRUST_DOWNGRADE`；typecheck/build 未执行，没有绕过检查 |

六包原单测合计 435 通过、7 失败、0 跳过。测试和构建未放宽断言、预算或跳过关键用例。部分原 typecheck 仍读取跨包 dist 声明，因此另外核验了 source 入口。性能测试在存在其他 Node 进程的环境下通过，不视为独占环境的稳定性能认证。完整 E2E/无障碍/双 Provider 三场景没有完成；主流程已失败，不标记其通过。

独立工程失败与已证明的代码故障分开归因：这是依赖发布信任校验阻断，不是网络超时，也不能据此断言生成源码的类型检查已经失败或通过。测试自身清理了临时工程；代理在运行期间将生成文件留存在 scratch 的 `gpt6-audit-templates-artifacts`，未手工清理用户数据。

## 已确认的阻断与高风险

### 1. 跨包 artifact 合同断裂，导致画布与预览崩溃

- `vue-backend/src/services/compile.ts:421` 实际返回 `{ compilationKey, pageId, renderer }`。
- `workbench/src/runtime-host/index.vue:77` 仍读取 `active.artifact.plan.renderer`。
- `vue-backend/dist/src/types/runtime.d.ts:56` 仍声明旧 `plan`，`runtime-host-app.test.ts:60` 也 mock 旧结构。
- 主代理在两个全新 Playwright browser context 中分别创建 Element Plus、Ant Design Vue 资料模板，设计与预览均实测失败，并取得相同异常。
- 处置：局部统一 producer/consumer/类型声明/契约测试；不需要推倒 RuntimeHost。

### 2. Source 页面名称被编译成 Vue 表达式

- `workbench/src/project/export/services/source-page.ts:75` 将 `escapeHtml(page.name)` 直接拼进模板 `<h1>`。
- `source-serialization.ts:19` 的 HTML 转义不处理 Vue 插值。
- 主代理使用实际生成器提取标题模板，通过 Vue 编译器执行仅设置进程内标记的无网络探针，确认配置文本会执行表达式。
- 处置：标题等配置文本必须通过数据绑定输出，审查所有模板文本插入点；修复前不能宣称导出符合禁止任意配置代码执行的安全边界。

### 3. Flow 节点超时后仍有写权限

- `core/src/flow/services/interpreter.ts` 为动作提供的表单 API 仍受整次 run 信号控制，而非该节点已经失效的信号。
- 实测 A 动作 5ms 超时并设置继续执行，25ms 后仍写入；后续 B 等待 70ms，最终结果为 `committed` 且包含 A 的晚到值。
- 处置：节点级表单写权限必须在超时/取消/结束时失效，并补异常继续场景回归；Core 调度器主体保留。

### 4. 重置无法释放挂起校验占用的提交锁

- `headless/src/services/controller-validation.ts:205` 等待所有 validator Promise；取消只发 Abort，不使等待本身收敛。
- 实测不响应 Abort 的首个 validator 在 reset 后保持 pending，第二次 submit 直接 false 且不再调用 validator。
- 处置：校验等待必须可取消并保证 submit finally 解锁；不能假设可信宿主 validator 一定正确响应 Abort。

### 5. 行身份与运行内快照索引不一致

- `runtime/src/renderer/services/flow-value-context.ts:34` 从最新 Controller 获取实例路径，却在 `:41` 读取旧 run-local values。
- 实测两行值 10、20：第一行运行中被移到第二位，原流程引用从 10 变成 20。
- `use-renderer-events.ts:85` 的整表 `setValues(values, true)` 还会重建未声明 itemKey 的行身份。
- 处置：重做 Flow 到 Controller 的实例事务适配，冻结运行内身份/路径映射并以稳定实例地址提交差异；不能仅注册几个动作就算完成。

### 6. Runtime 存在用户可见回归

- 错误渲染改为普通 `getInstanceErrors()` 后，没有读取更新的 reactive errors ref，校验后错误 DOM/ARIA 不刷新，3 项测试失败。
- 响应式 plan 进入 `structuredClone(plan.trigger)` 时产生 `DataCloneError`，3 项事件测试失败，动作尚未执行。
- 无 fields 的 Controller 元数据丢失，1 项 expose 测试失败。
- 处置：局部修复响应式依赖、JSON 计划快照边界与元数据合同，不删原断言。

## 静态审查确认的进一步缺口

这些项目有代码链路证据，但本轮未逐项建立独立运行探针。

- Renderer 仍未接通已新增的内置表单动作工厂、变量状态和数据源运行器；plan 携带能力不等于能力执行。
- Controller 创建时固定 value schema；同实例更新 plan 后新增字段、数组或改名仍可能使用旧拓扑。
- 普通组件事件未共享 reset 取消边界，旧异步结果可能覆盖重置后的值；scoped readonly 覆盖还可能违反全表 readonly 优先级。
- Preview reconciliation 仍使用平面字段名，结构修改后的值恢复可丢失自然对象/数组，并把不同作用域同名字段合并；需要局部重做。
- Config export 仍输出旧扁平 fields/raw flows，缺完整 runtime plan、valueScope、optionSource 和有效校验投影；该运行投影需要重做。
- Compiler 同节点内容修改和同槽重排被合并为 move 后过滤，增量 IR 可能落后于完整编译。
- Model 公开 transaction-to-draft 快路径信任可变无品牌对象；注册表未知组件判断还会命中 Object 原型属性。
- iframe 自然 Enter 提交不走父 submit 请求时，父镜像可能收不到结果；提交桥接和每次请求身份需补齐。
- Source 聚合入口存在重名类型星号导出风险，必须由真实生成工程构建验证。

## 产品覆盖与保留决策

| 模块 | 决策 |
| --- | --- |
| Core 安全引用、数据源、值作用域、Flow 调度 | 保留基础；补节点失效写权限等针对性修复 |
| Headless 校验、meta、提交和稳定行 store | 保留基础；修取消收敛、readonly、动态 schema 合同 |
| Model / Compiler / ProjectCommand / History | 保留；修快路径可信性和增量编译一致性，不放宽性能预算 |
| Runtime 字段渲染和绑定 | 保留；修响应式错误展示和 Proxy 计划边界 |
| Runtime 页级协调与实例事务写回 | 按一个完整合同重新完成，移除未接通的半成品连接方式 |
| FlowWorkspace 草稿、步骤树、Save/Cancel、复制排序 | 保留；补整流程复制、完整引用体验与真实 E2E |
| DataWorkspace 草稿与显式测试 | 保留；已存在 App 入口和单次 page.runtime 保存，不能误判为空壳 |
| Preview 作用域恢复、Config 运行配置导出 | 局部重做投影算法，保留公共框架和状态所有权 |
| Source 薄 Vue 适配、源码闭包、自定义动作绑定预检 | 保留方向；修配置注入、聚合导出和真实工程 parity |
| 双 Provider 对象/数组/明细物料 | 尚未完成产品设计与实现，不能算已交付代码 |

当前属性面板只有挂载和提交两个生命周期入口；命名数据源与两套字段选项 setter 没有连接；条件编辑器缺变量和作用域的完整可发现选择；旧 Flow E2E 仍操作已删除的 JSON/即时保存界面。以上是原 AC 内的必做项，不允许降为路线图。

## 恢复实施顺序

1. 先恢复可运行基线：统一 artifact/plan 消费合同和源码/声明检查入口，修 Runtime 已有 7 项回归、Source 安全和构建错误；要求两 Provider 的创建、设计、预览及原有效测试通过。
2. 再冻结完整页级运行合同：实例寻址事务、variables/dataSources、reset/unmount/timeout 取消边界、提交所有权。先把本次探针转成自动化回归，再改协调层；单一集成所有者负责跨包合同，不继续多线并发修改同一合同。
3. 补齐产品闭环：正式子表单物料、全部生命周期、统一引用编辑、命名源到字段选项；按两 Provider 的资料/订单/异步提交三场景推进。
4. 最后完成保存导入导出 parity、规定视口和无障碍、所有质量门禁及 AC11 文档。任何局部通过都不修改原最终验收标准。

本审计没有授权整体丢弃代码，也没有将修复到能启动等同于生产目标完成。

## 证据

临时证据根目录：`C:\Users\wl\.pi-desktop\scratch\29601d76-b06a-4d57-acd7-2334025716b2`。

- `gpt6-audit-workbench-typecheck.log`、`gpt6-audit-workbench-test.log`、`gpt6-audit-workbench-build.log`
- `configform-six-package-baseline.json`、`baseline-runtime.test.log`、`source-runtime.test.log`、`baseline-resolution.json`
- `gpt6-audit-browser.cjs`、`gpt6-audit-browser.json`、`gpt6-audit-element-browser.png`、`gpt6-audit-antd-browser.png`
- `gpt6-audit-behavior-probes.cjs`、`gpt6-audit-behavior-probes.json`
- `gpt6-audit-source-injection.cjs`、`gpt6-audit-source-injection.json`
- `gpt6-audit-templates.log`、`gpt6-audit-templates-artifacts/`（本轮两套 Provider 的生成文件）

GPT-6 分工：`524049dd` 负责六包当前基线；`61bffb39` 负责 Runtime/Core/Headless 边界；`fb5bdecf` 负责预览/导出与快路径；`4947e6d3` 负责产品完成度；`d1af0d4a` 负责真实独立工程。主代理负责 Workbench 全量命令、双 Provider 浏览器和四项行为/安全探针。
