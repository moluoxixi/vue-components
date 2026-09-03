# ConfigForm Runtime 与领域结构治理

## 目标

治理 ConfigForm Model、Compiler、Runtime、Headless、Provider Runtime adapter 与 Playground 示例的内部职责边界，使高风险 transaction/compiler/renderer 状态机和大型场景组件可以按目录直接定位、独立测试和安全演进，同时保持公共 API、文档协议、运行时渲染与交互行为不变。

## 背景

- `model/src/services/transactions.ts` 当前 1362 行，混合 transaction 编排、operation dispatch、graph mutation、payload/registry validation、inverse 与 change normalization。
- `compiler/src/services/compile.ts` 当前 1175 行，混合 canonical compile、incremental page compile、capability/registry diagnostics 与 committed/draft LRU coordinator。
- `runtime/src/renderer/index.vue` 当前 1091 行，混合 controller/meta、Design interaction guard、editor registration、layout/tree/field/component/slot rendering 与 Flow event bridge。
- Playground 的 `AntdConfigForm.vue`/`ElementConfigForm.vue` 分别为 927/1074 行，同时组合 layout、container、linked 与 stress 场景。
- `headless/src/services/controller.ts` 640 行，`runtime/src/composables/use-form/services/validation.ts` 584 行，均已形成可辨识的 P2 混合职责。
- Architecture manifest 对本任务有 5 条精确债务：Antd/Element Runtime wrapper 两条 single-feature、Playground 两条 single-parent，以及 Runtime errors logic barrel 一条。

## 需求

1. 保持 Model、Compiler、Runtime、Headless、Antd、Element 的 package root exports、props/emits/slots/expose、错误文本与 current-contract-only 语义不变；不新增兼容入口或旧路径 forwarding shim。
2. 清零本任务 5 条 architecture debt：Provider Runtime wrapper 归入 `services/components/`，两个 Playground 子示例归入 `examples/ConfigForm/components/`，`runtime/src/errors/index.ts` 只保留 export。
3. 将 Model transaction engine 拆为 apply orchestration、operation families、graph mutation、validation、normalization/change collection 等责任模块；inverse 必须继续与对应 mutation 邻接生成。
4. 将 Compiler 拆为 canonical/page compile、capability/registry diagnostics 和 coordinator/cache；保留 `compileCanonicalProject`、`compileCanonicalPage`、`createCompileCoordinator` 的根 API 与缓存语义。
5. 将 Runtime renderer 的 controller state、Design guard、editor bridge、Flow event policy 与 render pipeline 拆入 composables/services/renderers；geometry 继续由 Workbench runtime-host 拥有。
6. 将两套 Playground 示例按 layout/container/linked/stress 场景拆为父组件私有子组件，纯字段/默认值工厂进入本 feature 的 services/defaults；保持现有 test id、tab、提交和联动行为。
7. 将 Headless controller 和 Runtime validation 的响应式/异步生命周期、queue/snapshot、reaction/meta/reset/submit 职责拆开，不扩大其公共 API。
8. 拆分前补 transaction draft/final validation、change merge/inverse、compiler cache/diagnostics、renderer mode/editor/Flow lifecycle 和 Playground 场景行为回归。
9. 每个高风险状态机单独提交并运行 owning package tests/typecheck/build；最终再运行 ConfigForm package smoke、Playground/Workbench E2E 与全仓门禁。

## 验收标准

- [ ] 5 条目标 architecture debt 全部删除，unknown/stale diagnostics 为零。
- [ ] 目标包不存在 P0/P1 生产热点；P2 controller/validation 文件按真实状态与生命周期职责拆分，不做平均切行。
- [ ] Model transaction 的原子 rollback、inverse 顺序、evolving draft、final validation、Registry lock 与 change-set 语义不变。
- [ ] Compiler canonical/incremental/coordinator 结果、诊断、cache key 与 committed/draft 隔离不变。
- [ ] Runtime renderer 的受控 model、Design inertness、editor registration、slot/path、binding precedence 与 Flow event 顺序不变。
- [ ] Provider wrapper、Playground 场景、Headless controller 和 Runtime validation 的用户可观察行为不变。
- [ ] 所有公开 package exports、声明、README 架构事实与 consumer import 保持一致。
- [ ] 相关包 test/typecheck/build、`pnpm test:config-form-packages`、Playground/Workbench E2E、全仓 lint/typecheck/architecture/path/workflow tests 与 `git diff --check` 通过。
- [ ] 每个实施阶段已独立 commit，不 push，最终工作树干净。

## 范围外

- 不修改 Workbench、Designer、Devtools 的内部架构；只同步必要的私有 fixture 路径并运行 consumer 回归。
- 不改变表单 UI、Provider 主题、响应式阈值、ProjectDocument/PageGraph/Flow/Runtime 协议或持久化格式。
- 不新增跨 Provider 公共示例抽象；结构相似不等于共享语义。
- 不直接维护 `dist/`、coverage、缓存或其他生成产物。

## 关键决策

- 高风险边界按状态所有权与数据流拆分，不按行数平均拆分。
- Model inverse 与 mutation 保持邻接；Runtime geometry 不下沉到 renderer；Compiler coordinator 不反向依赖 Workbench。
- 私有旧路径直接删除，公共符号继续由既有 package root 明确导出。
- 父任务已记录 standing implementation approval；本任务只做保持行为/API/依赖方向不变的内部治理，无需再次请求分批批准。
