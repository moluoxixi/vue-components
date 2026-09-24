# Surface Foundation 实施计划

## 执行原则

- 本任务是跨包硬切，所有目标版本必须在归档前形成一个可构建、可测试的整体。
- 每一步先写或更新 rejection/happy-path 测试，再切实现；不以兼容 alias 消除编译错误。
- 每完成一个阶段运行该阶段的定向 test/typecheck；最后运行全范围质量门禁。
- 若发现需要改变已审阅 wire shape、产品范围或其他子任务所有权，停止实现并回到规划。

## 阶段 1：Model 类型、版本与 Reader

- [x] 将 ProjectDocument 5、PageGraph 3、Registry snapshot 2 常量原子切到目标版本。
- [x] 用 Surface/Dataset/Resource/Theme/Interaction 最终类型替换 Page-only 持久化类型。
- [x] 删除 bindings/conditions/reactions/runtime/optionSource 的持久化类型与 Reader。
- [x] 实现 field/layout/element、Dialog/Drawer presentation、ResponsiveLength 和 Theme v1
  strict Reader。
- [x] 实现 Registry v3 capability 类型、fingerprint 和 strict Reader。
- [x] 实现 Project structure、route、home、order/map、kind 与引用诊断。
- [x] 更新 Model exports、fixtures 和版本 rejection tests。

验证：

```powershell
pnpm --filter @moluoxixi/config-form-model test
pnpm --filter @moluoxixi/config-form-model typecheck
```

回滚点：Model 公共 Reader 尚未被下游消费前，可整体回滚阶段 1；不得保留旧 alias。

## 阶段 2：Registry 基础物料迁移

- [x] 扩展 Designer material domain 与集中 Registry projection 到 v3 capability。
- [x] 为现有 field/layout 基础物料声明 kind、semantic triggers、state properties 与空或
  实际 Dataset/Resource binding capability。
- [x] 同步 Element Plus、Ant Design Vue adapter 的基础条目与 Registry snapshot tests。
- [x] 证明两个 adapter 产生可被 Model v3 Reader 接受的确定性 fingerprint。

验证：

```powershell
pnpm --filter @moluoxixi/config-form-designer test
pnpm --filter @moluoxixi/config-form-designer-element-plus test
pnpm --filter @moluoxixi/config-form-designer-antd-vue test
```

## 阶段 3：事务、引用索引与 history

- [x] 建立唯一 Surface/Dataset/Resource/Interaction 引用 walker。
- [x] 将 project/page/node operations、commands、patch、inverse 与 validation plan 切到
  Surface 身份，并加入 Dataset/Resource metadata operations。
- [x] 实现 add/remove/move/copy/rename/route/presentation/parameter/output/interaction 事务；
  Foundation 同时提供 Dataset `replaceRows/setDefaultProjection` 等通用 Model
  transaction/history/repository primitive，raw ingestion、transfer/conflict、query/projection、
  options 保存编排和 UI 仍归 studio-datasets。
- [x] 阻止删除被引用资产并返回稳定来源上下文。
- [x] 将 history、undo/redo、merge 和 `ProjectChangeSet` 切到新 shape。
- [x] 覆盖事务失败零部分写入、inverse 精确和 change set 确定性测试。

验证：

```powershell
pnpm --filter @moluoxixi/config-form-model test
pnpm --filter @moluoxixi/config-form-model test:performance
```

## 阶段 4：Repository、bytes 与 IndexedDB v4

- [x] 实现 Memory Repository 的 Surface/Dataset/Resource entity revisions。
- [x] 实现 `create.embeddedContents`、`commit.embeddedWrites` 和 `readEmbedded` copy-isolated
  API，以及 metadata/bytes 双射、length/hash 校验。
- [x] 将 IndexedDB manifest/entity/key/checksum codec 切到 v4。
- [x] 将 bytes records 与 manifest/entities 放入同一 `updateItems` transaction。
- [x] 更新 receipts、versions、retention、orphan GC、project delete 和 concurrent commit。
- [x] 将 Recovery Draft 升 v2，原子保存并恢复完整 bytes snapshot。
- [x] 覆盖 draft v1/未来/混合版本、byte 双射/hash/length、损坏 record、fresh copy、
  原子替换/delete/project delete，以及 Repository CAS/replay、storage 失败回滚、历史 hash、
  exact-hash reuse、copy isolation 和 prune reachability。

验证：

```powershell
pnpm --filter @moluoxixi/config-form-model test
pnpm --filter @config-form/workbench test -- project-document-repository project-recovery-draft-store project-persistence-session
```

回滚点：codec v4 writer 与 Reader 必须一起回滚；禁止留下 v4 writer/v3 Reader 组合。

## 阶段 5：Project / Surface transfer 与 import

- [x] 在 Model 实现 Project transfer v1 async writer/Reader：writer strict-validate document，
  按 resourceId 确定性读取并复制 embedded bytes，校验 exact identity/hash/length/预算；无
  Resource 写出 `embeddedContents: []`，Workbench 只编排文件与 Repository。
- [x] 在 Model 实现 Surface transfer v1 flat dependency closure async writer/Reader，Workbench
  只编排文件、remap、目标 Registry/route 检查和 Repository commit。
- [x] 删除裸 ProjectDocument import 与 Page transfer v2 reader/writer。
- [x] 建立全项目 ID allocation plan，结构化重写 Surface/node/field/Dataset/Resource/rule
  引用并在写入前重新校验。
- [x] 将 import metadata 与 embedded bytes 一次提交 Repository。
- [x] 覆盖旧/未来/缺失/mixed version、10 MiB/256 项/50 MiB 预算、base64、hash、
  closure 缺失/额外资产、order/map/key-id、确定性顺序、Registry subset mismatch、route
  collision、fresh byte copies、missing/rejected/thrown/stale read、无 Resource
  write -> JSON -> read 往返、失败无部分 envelope/零写入。

验证：

```powershell
pnpm --filter @config-form/workbench test -- json-import workbench-controller-template-create
```

## 阶段 6：Compiler、IR、Vue backend 与生产 Runtime

- [x] 将 Canonical IR 4/Compiler 5.0.0 切到 IR 5/Compiler 6.0.0。
- [x] 将 Page identity/API/diagnostics/cache key 全部替换为 Surface identity。
- [x] ProjectCompilation 携带 flat Surface table 与 Dataset/Resource/Theme/Interaction 投影。
- [x] coordinator 按 entity change set 精确失效，循环引用不递归编译。
- [x] Vue backend 实现 Surface artifact 与 element renderer，拒绝旧 IR/compiler。
- [x] 生产 Runtime 只同步必要的 Surface plan 命名，保留 Data Source 和 direct listeners。
- [x] 更新所有 barrels、fixtures、performance 与 artifact contract tests。

验证：

```powershell
pnpm --filter @moluoxixi/config-form-compiler test
pnpm --filter @moluoxixi/config-form-compiler typecheck
pnpm --filter @moluoxixi/config-form-vue-backend test
pnpm --filter @moluoxixi/config-form-vue-backend typecheck
pnpm --filter @moluoxixi/config-form test
pnpm --filter @moluoxixi/config-form typecheck
```

## 阶段 7：Prototype Runtime v1

- [x] 创建真实 package、build、exports、types 和多入口，不建立 placeholder。
- [x] 实现 context/session/command Reader、初始化、外部 instanceId 校验、完整 JSON-safe
  command/effect union、纯 reducer 和稳定 diagnostics。
- [x] 将编译后 node owner/value-scope/scoped-field topology 投影进 context；host 用注入 row ID
  factory 生成 runtime address snapshot，所有 activation/change/projection/result/focus 使用
  `{nodeId, scope}`，覆盖 root/parent/current、nested array 与 stale row address。
- [x] 实现唯一 Safe Expression strict Reader/evaluator：`values` selector 省略时为 `current`，
  显式支持 `parent/root`（root 的 parent 仍为 root），其他 reference scope 携带 selector 必须
  拒绝；覆盖 nested value scope，并证明 reducer、Preview/Experience 与生成 Source 语义一致。
- [x] 值事务要求唯一 origin scope，无关 row 变化拆分 command；projection 对每个 live target
  address 使用其 scope-local values，Host focus snapshot 也只使用 scoped address。
- [x] 实现每实例 `PrototypeInstanceProjectionV1`：初始化/open/navigate 只计算 projection；
  user/result value settle 后重算，表达式失败整体回滚，Vue host 只消费 projection effect。
- [x] 覆盖 navigate/back/open/closeCurrent/closeAll、参数、结果事务与失败零状态变化。
- [x] `rowActivate/itemActivate` 从当前 Dataset view fresh-clone 必填 JSON-safe item；其他
  trigger 禁止 item，`onResults` 禁止 item scope，覆盖 item-derived open 参数与 Preview/Source
  parity。
- [x] `SurfaceInstance` 原子保存 parent/scoped-address/interaction opener 三元组；覆盖同节点
  不同行/trigger 的 result mapping，以及 missing/mismatch/closed opener 原 session 不变。
- [x] `/vue` host 在 dispatch interaction 前执行 validation gate，并成为 effects 唯一执行者；
  parent/transport 只观察不含 effects 的 transition snapshot。
- [x] 实现 `/vue` Surface/overlay host、实例状态隔离、dismiss policy 和 focus restore。
- [x] 验证 root/`/session` Node import 不访问 DOM，`/vue` 才依赖 Vue/renderer。
- [x] 更新 root test filter、package architecture、consumer smoke、声明收尾、lockfile、
  peer range 与 Changeset。

验证：

```powershell
pnpm --filter @moluoxixi/config-form-prototype-runtime test
pnpm --filter @moluoxixi/config-form-prototype-runtime typecheck
pnpm --filter @moluoxixi/config-form-prototype-runtime build
node -e "import('@moluoxixi/config-form-prototype-runtime/session')"
```

## 阶段 8：Workbench session/cache 与 Runtime Host v7

- [x] 将 design candidate、projection 和 runtime artifact cache 切到 `surfaceId`。
- [x] 保证 compilation 可共享而 instance state 只按 `instanceId` 保存。
- [x] 一次性实现所有 variant 与 base 交叉的 v7 design/experience message union、精确 payload
  guards、parent writer 与 iframe reader；删除旧 submit/fieldChange/Data RPC transport。
- [x] Experience host 组合 Prototype Runtime，拒绝已关闭 instance 的 late message。
- [x] 删除 Workbench Prototype Preview Data RPC 与 capability，不影响生产 Runtime。
- [x] 更新 Preview/Design frame、runtime host、session 与 protocol tests，覆盖 missing/wrong
  base、unknown key、stale revision、重复/倒退 sequence、instance stateRevision、closed
  instance late message 和 Design/Experience cross-mode payload 拒绝。

验证：

```powershell
pnpm --filter @config-form/workbench test -- runtime-host preview-session projection-coordinator surface-runtime-cache
pnpm --filter @config-form/workbench typecheck
```

回滚点：v7 parent/child/guard 必须一起回滚，不允许协议混用。

## 阶段 9：Workbench 临时 generator 5 与现有 UI 最小适配

- [x] 将现有 generator、config export 和 snapshot 切到 ProjectCompilation v5/Compiler 6。
- [x] 生成 Page routes 与 flat Dialog/Drawer definitions，并依赖共享 Prototype Runtime。
- [x] 删除临时 Source model 中的旧 graph 字段，不实现 SourceFileSet/Viewer 新包能力。
- [x] 将仍存在的 PageManager、template、controller 和 persistence UI 做最小 Surface hard-cut
  适配；不实现完整 Studio 资产树或 Experience UI。
- [x] 更新生成项目 install/typecheck/test/build 和 Preview parity tests。

验证：

```powershell
pnpm --filter @config-form/workbench test -- export-snapshot canonical-config-export preview-source-parity
pnpm --filter @config-form/workbench verify:templates
pnpm --filter @config-form/workbench build
```

## 阶段 10：全范围审查与发布门禁

- [x] 搜索并删除生产代码中的 Page-only public identity、旧版本常量、兼容 Reader、旧 graph
  字段、Host v6、Page transfer v2 和 generator 4.0.0。
- [x] 检查所有受影响 package README 与 `.trellis/spec/` 的 current/target 状态。
- [x] 检查 package exports、Changeset、peer range、lockfile、architecture allowlist 和 root scripts。
- [x] 派发全范围 `trellis-check`，修复 findings 后重跑全部门禁。

最终验证：

```powershell
pnpm --filter @moluoxixi/config-form-model test
pnpm --filter @moluoxixi/config-form-compiler test
pnpm --filter @moluoxixi/config-form-vue-backend test
pnpm --filter @moluoxixi/config-form-prototype-runtime test
pnpm --filter @config-form/workbench test --maxWorkers=2
pnpm test:config-form-packages
pnpm test:package-architecture
pnpm --filter @config-form/workbench typecheck
pnpm --filter @config-form/workbench build
pnpm test:release
pnpm install --lockfile-only --frozen-lockfile
git diff --check
```

已知全仓非 ConfigForm 债务若仍失败，必须记录精确命令和既有路径；ConfigForm 定向门禁
与本任务新增包门禁不得以该理由跳过。

最终验证记录（2026-09-19）：Model、Compiler、Vue backend、Prototype Runtime、
Workbench 定向与全量测试、类型检查、构建、`test:config-form-packages`、
`test:release`、冻结 lockfile 安装和 `git diff --check` 均通过。Workbench 全量为
52 个测试文件、602 个测试。`test:package-architecture` 的 ConfigForm 边界 5/5
通过；全仓命令仅因 `packages/qiankun-router-kit/**` 与
`packages/vite-plugin-style-scope/**` 的 27 条既有非 ConfigForm 诊断退出 1。

## 高风险文件与审查点

- `packages/ConfigForm/model/src/types/contracts.ts`
- `packages/ConfigForm/model/src/schemas/project.ts`
- `packages/ConfigForm/model/src/services/transactions/**`
- `packages/ConfigForm/model/src/services/repository.ts`
- `packages/ConfigForm/compiler/src/types/compiler.ts`
- `packages/ConfigForm/compiler/src/services/compile/**`
- `packages/ConfigForm/workbench/src/project/persistence/**`
- `packages/ConfigForm/workbench/src/project/import/**`
- `packages/ConfigForm/workbench/src/runtime-host/**`
- `packages/ConfigForm/workbench/src/project/export/**`
- `packages/ConfigForm/prototype-runtime/**`

这些区域的任何临时兼容、宽松 cast、message guard 漏同步、非原子 bytes 写入或 instance
state 以 surfaceId 缓存，均为阻断性 finding。
