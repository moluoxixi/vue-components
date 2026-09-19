# Research: Compiler 与 Prototype Runtime 的 Surface 硬切边界

- Query: 审计 Compiler、Canonical IR、Vue backend、生产 Runtime 与 Workbench Runtime Host，明确 Page -> Surface 硬切、Prototype Runtime 包边界、版本与发布影响，以及可原子落地的实现顺序。
- Scope: internal
- Date: 2026-09-18

## Findings

### Files Found

- `packages/ConfigForm/compiler/src/types/compiler.ts`：Canonical Project/Page IR、编译产物、诊断、identity 与 coordinator 公共类型。
- `packages/ConfigForm/compiler/src/services/compile/services/project.ts`：Project Canonical IR 的页面顺序、首页和按 ID 索引构建。
- `packages/ConfigForm/compiler/src/services/compile/coordinator.ts`：committed/draft 缓存、dirty tracking 与变更归因。
- `packages/ConfigForm/vue-backend/src/types/runtime.ts`：Vue runtime 编译输入与 artifact 合同。
- `packages/ConfigForm/vue-backend/src/services/compile.ts`：Canonical Page 到 Vue renderer artifact 的编译入口与版本校验。
- `packages/ConfigForm/vue-backend/src/state/runtime-node-fragments.ts`：按 resolver 与 canonical node 对象复用 node fragment 的缓存。
- `packages/ConfigForm/runtime/src/runtime/types/contracts.ts`：生产 Runtime 的纯数据 plan 与 Data Source 合同。
- `packages/ConfigForm/runtime/src/renderer/types/props.ts`：生产 Renderer 的 props 合同。
- `packages/ConfigForm/runtime/src/renderer/index.vue`：生产 Renderer 的装配入口。
- `packages/ConfigForm/workbench/src/runtime-host/constants/protocol.ts`：Runtime Host 协议版本。
- `packages/ConfigForm/workbench/src/runtime-host/types/protocol.ts`：iframe host 消息、session 与 payload 类型。
- `packages/ConfigForm/workbench/src/runtime-host/schemas/protocol.ts`：Runtime Host 消息边界的运行时校验。
- `packages/ConfigForm/workbench/src/runtime-host/composables/use-runtime-host-protocol.ts`：iframe 内消息鉴权、编译、revision、RPC 与状态镜像流程。
- `packages/ConfigForm/workbench/src/runtime-host/index.vue`：iframe 内单 renderer 挂载点。
- `packages/ConfigForm/workbench/src/components/PreviewRuntimeHostFrame/index.vue`：Workbench 侧 iframe 生命周期和消息发送。
- `scripts/verify-config-form-adapter-packages.mjs`：公开包导入与 consumer smoke 校验。
- `scripts/__tests__/path-conventions.test.mjs`：声明文件收尾器覆盖包清单。
- `scripts/check-workspace-peer-ranges.mjs`：workspace peer range 发布门禁。
- `.changeset/config-form-runtime-first.md`：既有 Runtime changeset，语义不覆盖本次 Surface Foundation breaking change。

### Current Identity Flow

当前编译链路以 Page 为唯一资产身份：

1. `CanonicalProjectIR` 通过 `homePageId`、`pageOrder`、`pagesById` 组织 `CanonicalPageIR`（`packages/ConfigForm/compiler/src/types/compiler.ts:32`、`:49`、`:104`、`:115`、`:129`、`:146`、`:192`；`packages/ConfigForm/compiler/src/services/compile/services/project.ts:20`、`:38`、`:92`）。
2. coordinator 的 committed/draft LRU、dirty set 和 change attribution 均以 `pageId` 为键（`packages/ConfigForm/compiler/src/services/compile/coordinator.ts:23`、`:72`、`:129`、`:193`、`:233`）。
3. Vue backend 仅公开 `compileCanonicalPageRuntime`，输入为 `PageCompilation`，或 `ProjectCompilation + pageId`；输出 `VueRuntimeArtifact` 含 `compilationKey`、`pageId`、`renderer`（`packages/ConfigForm/vue-backend/src/types/runtime.ts:32`、`:77`、`:97`、`:103`；`packages/ConfigForm/vue-backend/src/services/compile.ts:40`、`:379`、`:418`）。
4. Workbench 当前只向一个 iframe 发送一个 `PageCompilation`，iframe 内编译为一个 Vue artifact 并挂载一个 `<ConfigFormRenderer>`（`packages/ConfigForm/workbench/src/runtime-host/index.vue:56`；`packages/ConfigForm/workbench/src/components/PreviewRuntimeHostFrame/index.vue:36`、`:74`）。

目标模型必须把两类身份分开：

- `surfaceId`：项目资产、编译产物、编译缓存、依赖边和诊断归属的稳定身份。
- `instanceId`：一次 Prototype 会话中 values、validation、focus、overlay、返回结果和卸载清理的运行身份。

同一个 Surface 可以同时存在多个运行实例，因此任何运行状态都不能再以 `surfaceId` 为唯一键。Dialog、Drawer 和 Page 都是独立 Surface；打开 Dialog/Drawer 是创建实例，而不是把内容递归内联到当前 Page。

### Compiler And Canonical IR Cut

当前版本为：

- `CANONICAL_PROJECT_IR_VERSION = 4`
- `CONFIG_FORM_COMPILER_VERSION = '5.0.0'`

本次应一次性硬切为：

- Canonical Project IR `4 -> 5`
- Compiler protocol/version `5.0.0 -> 6.0.0`

硬切范围包括所有公共 API、IR 类型、诊断字段、缓存键和测试夹具：

- `CanonicalPageIR` -> `CanonicalSurfaceIR`
- `PageCompilation` -> `SurfaceCompilation`
- `CanonicalPageIdentity` -> `CanonicalSurfaceIdentity`
- `compileCanonicalPage` -> `compileCanonicalSurface`
- Project IR 的 `homePageId/pageOrder/pagesById` 改为能够表达 Project entry Surface 与 Surface graph 的明确字段。
- coordinator 所有 `pageId` key 与 dirty attribution 改为 `surfaceId`。

不应提供 Page/Surface 双读、deprecated wrapper、alias 或旧版本迁移分支。Compiler 只消费 Foundation 阶段定义的新 Model/Registry/SurfaceGraph v1 合同。Surface 之间的跳转、打开 overlay 与 result mapping 只保留 ID 引用，不能递归内联，否则循环引用无法可靠编译，缓存失效范围也会被放大。

### Vue Backend Cut

Vue backend 当前会再次校验 Canonical IR 与 compiler version，并校验 Page shape；其 node fragment cache 是 `resolver -> canonical node object` 的 `WeakMap`，不是按页面或运行实例缓存（`packages/ConfigForm/vue-backend/src/state/runtime-node-fragments.ts:6`）。

建议同一原子变更中：

- `compileCanonicalPageRuntime` -> `compileCanonicalSurfaceRuntime`。
- 输入改为 `SurfaceCompilation`，或 `ProjectCompilation + surfaceId`。
- artifact 的 `pageId` 改为 `surfaceId`，并保留 `compilationKey` 与 renderer 描述。
- 支持 Prototype host 需要的 renderer `element`，但不在 backend 中引入会话栈、overlay 栈或实例状态。
- 只接受新 IR/compiler version，旧产物直接拒绝。

现有 WeakMap node fragment cache 可以保留，因为它以 canonical node 对象身份复用编译片段，与 `instanceId` 无关；Prototype host 必须为每个 `instanceId` 创建独立 Renderer 实例，不能把运行状态放入该缓存。

### Production Runtime Boundary

生产 Runtime 不拥有 Project/Page 资产身份，也不依赖 Studio/Designer；当前生产依赖只有 Core，Headless/Vue/Zod 通过 peer/dev 提供（`packages/ConfigForm/runtime/package.json:55`）。Renderer 接收 `model`、`fields`、`plan`，Page 命名只残留在纯数据计划及其 Data Source 类型（`packages/ConfigForm/runtime/src/runtime/types/contracts.ts:22`、`:28`、`:38`；`packages/ConfigForm/runtime/src/renderer/types/props.ts:24`；`packages/ConfigForm/runtime/src/renderer/index.vue:46`）。

因此本次对生产 Runtime 的改动应限于：

- 将公开纯数据合同中的 Page 命名硬切为 Surface 命名。
- 保持 values/meta/validation、生产 Data Source 与 direct listeners 的现有职责。
- 不引入 Project navigation、Prototype session、overlay stack、模拟交互编排或 Workbench 协议。

依赖方向必须保持单向：Prototype Runtime 可以在 `/vue` 入口消费生产 Renderer/Vue backend；生产 Runtime 不得依赖 Prototype Runtime。

### Prototype Runtime Package Boundary

仓库目前没有 Prototype Runtime 包。建议新增独立包，并至少提供以下入口：

- 根入口：稳定、与框架无关的公共类型和常量。
- `/session`：`PrototypeSessionV1`、Reader、初始化函数、纯 reducer、command、diagnostic 和 effect 描述。
- `/vue`：将 session 中的 Surface instances 映射到生产 Renderer 的 Vue host。
- `/vue/style`：Prototype host 必需样式。

核心 session 只负责 demo 交互：

- Page history。
- Dialog/Drawer overlay stack，允许无限嵌套。
- 以 `instanceId` 隔离每个 Surface instance 的输入、校验、焦点和结果事务。
- open/navigate/close/back 等命令的确定性归约。
- 参数绑定、命名输出与 result mapping 的验证和提交。
- 关闭实例时完整清理该 instance 的状态；焦点恢复等宿主行为通过 effect 描述交给 `/vue` 执行。

它不负责真实接口、动态 Data Source 编排、用户函数执行或生产业务逻辑。设计器产物仍是使用模拟数据的可交互 demo，工程师在导出的工程配置/函数中补齐真实逻辑。

### Runtime Host Protocol Cut

当前 `RUNTIME_HOST_PROTOCOL_VERSION = 6`（`packages/ConfigForm/workbench/src/runtime-host/constants/protocol.ts:1`）。协议以单 `PageCompilation`、单 renderer 和单 `runtimeSessionKey` 为中心；`pageId` 同时参与消息鉴权、revision、Data RPC、submit stale guard 和 state mirror（`packages/ConfigForm/workbench/src/runtime-host/types/protocol.ts:9`、`:44`；`packages/ConfigForm/workbench/src/runtime-host/schemas/protocol.ts:41`、`:54`、`:196`；`packages/ConfigForm/workbench/src/runtime-host/composables/use-runtime-host-protocol.ts:31`、`:80`、`:210`、`:273`）。

因此不能只把 `pageId` 文本替换为 `surfaceId`。建议协议 `6 -> 7`，并明确分开两种 host payload：

- Design host：仍可传单个 `SurfaceCompilation`，用于当前 Surface 的局部设计预览。
- Experience host：传完整 `ProjectCompilation + PrototypeSession`，或一次性构建的 surface artifact table，使导航与 overlay 实例化不依赖后续递归编译。

Experience 消息鉴权至少需要 project/session 级身份；状态镜像、stale guard 与 renderer key 必须使用 `instanceId`。旧 Data RPC 不应移植到 Studio Prototype 会话，因为目标产品边界已删除设计器中的动态 Data Source 作者能力。

### Package, Export And Release Impact

当前包状态：

- compiler `0.1.3`，单根导出，依赖 Core + Model。
- vue-backend `0.1.3`，单根导出，依赖 Runtime + Compiler + Core + `zod3-to-rule`。
- runtime `0.2.5`，导出根入口、`/plugins` 与 styles。
- Workbench 为 private package。
- workspace glob 已覆盖 `packages/ConfigForm/*`，无需为新包增加 workspace glob。

新包需要显式多入口 Vite 输出与 package exports；`sideEffects` 只标记样式文件。发布与仓库门禁还需同步：

- 根 `test:config-form-packages` 增加 vue-backend 和 Prototype Runtime filter。
- `scripts/verify-config-form-adapter-packages.mjs` 增加新包 Node import、每个 subpath 的 consumer smoke，以及导出边界断言。
- `scripts/__tests__/path-conventions.test.mjs` 的 declaration finalizer package list 加入新包。
- 更新 lockfile，并通过 `scripts/check-workspace-peer-ranges.mjs` 的 peer range 校验。
- 新增独立手写 breaking minor changeset；不能复用 `.changeset/config-form-runtime-first.md`，也不能仅依赖自动 patch changeset。

### Test Surface

至少覆盖以下回归面：

- Compiler：Surface graph、循环引用仅保留 ID、Project entry、诊断归属、committed/draft cache 与 dirty attribution。
- Vue backend：新版本拒绝旧 IR、Surface artifact、element renderer、node fragment cache 不携带实例状态。
- Production Runtime：公开 plan 类型硬切后仍保持既有 values/meta/validation 和生产 Data Source 行为。
- Prototype `/session`：初始化、navigate/back、Dialog/Drawer 无限嵌套、多实例隔离、close cleanup、参数校验、命名输出/result mapping 原子性、非法命令 diagnostic、effect 顺序。
- Prototype `/vue`：按 `instanceId` 挂载和卸载 Renderer、Page history 与 overlay 层级、关闭后的焦点恢复、同 Surface 多实例状态隔离。
- Workbench：Design/Experience payload schema、v7 协议拒绝 v6、project/session 鉴权、instance stale guard、iframe teardown。
- Packaging：根入口和 `/session`、`/vue`、`/vue/style` 的 build/import/consumer smoke、声明文件、样式 side effect、peer range 与 changeset。

### Atomic Implementation Order

1. 先完成 Model/Registry/SurfaceGraph v1；Compiler 只读取新合同。
2. Compiler 一次硬切所有 Page 公共 API、IR、缓存键和诊断字段，并同时提升 Canonical IR/Compiler version。
3. Vue backend 同批切到 `compileCanonicalSurfaceRuntime` 与 Surface artifact，支持 `element`，拒绝旧版本。
4. 生产 Runtime 只硬切纯 plan 类型中的 Page 命名，不接收 Prototype session/overlay 职责。
5. 新建 Prototype Runtime `/session`：Reader、初始化、纯 reducer、实例清理、参数/结果事务、diagnostics/effects。
6. 新建 `/vue` host：按 `instanceId` 挂载 Renderer，维护 Page history + overlay stack，关闭时卸载并清理，执行焦点 effect。
7. Runtime Host v7：Design 使用 `SurfaceCompilation`；Experience 使用 `ProjectCompilation + PrototypeSession`，不再以 `surfaceId` 存实例状态。
8. 更新 Workbench session/cache/schema 与对应测试。
9. 更新 package exports、build、public smoke、根脚本、path convention、lockfile 与 Changeset。
10. 依次跑 Compiler、Vue backend、Runtime、Prototype Runtime、Workbench、architecture、pack/release gates，再跑全量门禁。

### Contract Gaps Requiring A Decision

#### 1. Reducer 缺少只读项目上下文

现有目标规范展示 `reducePrototypeSession(session, command)` 两参数形式，但 `PrototypeSessionV1` 只持有 `projectId`、导航/overlay 栈和 instances。它无法独立验证目标 Surface kind、required parameters、named outputs 与 result mappings。

推荐把签名明确为纯三参数形式，例如 `reducePrototypeSession(session, command, context)`，其中 `context` 是不可变的 Surface contract reader。这样 reducer 仍然纯且可测，command 也无需复制可能过期的资产合同。备选方案是让 command 携带已经规范化且可验证的目标合同，但会增加 payload 体积与 stale contract 风险。

该点必须在实现 reducer 前定型；否则参数/结果验证只能被迫散落到 Vue host 或 Workbench，破坏框架无关核心。

#### 2. 纯 Reducer 不能内部生成随机实例 ID

Page/Dialog/Drawer 的创建 command 必须携带由 host 或注入 ID factory 生成的 `instanceId`。Reducer 只校验格式与会话内唯一性，然后确定性地产生 next state、diagnostics 和 effects。若 reducer 内调用 `randomUUID()`，相同输入不会得到相同输出，测试、回放与调试都不可靠。

建议把“生成 ID”定义为 dispatch 前的 adapter 职责，并在 session 公共合同中明确这一点。

## Related Specs

- `.trellis/spec/config-form/`：ConfigForm 产品边界与包职责总规范。
- `.trellis/spec/config-form/studio/`：Studio 设计态、页面/Surface 管理与预览边界。
- `.trellis/spec/config-form/runtime/`：生产 Runtime 数据与渲染职责。
- `.trellis/spec/config-form/compiler/`：Canonical IR、Compiler API、缓存和诊断约束。
- `.trellis/spec/config-form/vue-backend/`：Vue artifact 编译与 renderer adapter 约束。
- `.trellis/spec/config-form/prototype-runtime/`：Prototype session、实例、overlay 和框架 adapter 目标合同。

## Caveats / Not Found

- Prototype Runtime 包尚不存在，因此入口、包名、依赖方向和 API 均为基于已批准产品边界的实现建议，不是现有代码事实。
- 本研究没有发现可安全保留的 Page compatibility layer；保留双读会让 IR、缓存、协议和测试同时长期分叉，与“完全剔除旧事件/页面语义、保持代码纯净”的已定方向冲突。
- `reducePrototypeSession` 的 context 形态和 `instanceId` 生成责任尚未在目标合同中闭合，是 Foundation 实现前唯一需要显式定型的两个 API 问题。
- Runtime Host v7 的最终 payload 选择（原始 `ProjectCompilation` 或预编译 artifact table）可在实现时按 iframe 性能测量确定，但协议必须一次性支持多 Surface、多 instance，并禁止 v6 fallback。
