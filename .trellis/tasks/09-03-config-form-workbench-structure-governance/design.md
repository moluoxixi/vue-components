# ConfigForm Workbench 结构治理技术设计

## 1. 总体边界

Workbench 继续作为私有应用，数据流保持：

```text
Repository/Template -> Workbench Controller -> Design/Preview/Export Sessions
ProjectSnapshot -> Compiler -> RuntimeHost protocol -> Renderer
ProjectDocument Flow -> PageFlowEngine -> Preview coordinator / generated runtime
```

Feature `index.vue` 只负责 dialog/workspace composition；Vue state、watcher、DOM lifecycle 进入 composables，确定性生成/解析/映射进入 services，类型只进入 types。

## 2. Component Ownership 与 Debt

- `src/App/components/TemplateCreationWorkspace/`：`App.vue` 唯一子组件；其内部仍通过 templates feature barrel 消费 catalog/import services。
- `src/app/components/{PreviewDrawer,StudioLeftPanel}/`：`app/index.vue` 的单父 shell 子组件。
- `features/flow/components/FlowWorkspace/`、`features/pages/components/PageManager/`、`features/export/components/{ProjectFileTree,WorkspaceCodeEditor}/`：单 feature UI。
- `project/errors/workbench-project-error.ts` 持有错误类，`errors/index.ts` 只 export。

移动后删除旧路径和全局错误 re-export，不提供兼容 shim；测试随真实 owner 归位。

## 3. Source Export

`project/export/services/source.ts` 保留 `createCanonicalProjectSourceExport` facade，生成实现拆为：

```text
project/export/services/source/
  index.ts
  canonical.ts
  portable-flow.ts
  portable-validation.ts
  vue-page.ts
  project-files.ts
  templates.ts
```

拆分按最终生成产物，不创建共享 string helper 大桶。每个模块接受显式 snapshot/registry/options，返回文件内容或 typed fragments；facade 保持文件插入顺序和错误文案。旧 `source.ts` 删除，`services/index.ts` 从 `./source` 导出。

## 4. App Controller

`createWorkbenchController` 继续是唯一 facade，返回类型和 provider context 不变。内部按以下责任拆分：

- project/session binding：加载、激活、编译 publication、Design/Preview/Export session 同步；
- creation/import：template project/page 与 JSON import transaction；
- page commands：create/select/rename/remove；
- persistence/version recovery：save、fork、reload、history、draft recovery；
- lifecycle composable：window/storage listener、initial load、unmount cleanup。

每个 service 通过明确 ports 访问 repository/session/UI notification；不创建第二份 current project 或 busy/error state。

## 5. Flow 与 Monaco

- FlowWorkspace 保留 VueFlow projection、selection 和模板；command builder、trigger/node/edge persistence 与 validation 进入 owner feature services/composables。
- PageFlowEngine 继续是 Workbench Flow 执行 facade。若移动 `preview` 内仅属于 Flow 的 coordinator/action registry，调用方统一改走 `flow` barrel，并删除旧路径。
- WorkspaceCodeEditor 保留 editor DOM/model lifecycle；worker routing、Vue/TS mirror/providers 进入 services，内嵌 declarations 进入 constants。每个 Monaco registration/model 由一个 disposer owner 管理。

## 6. Persistence 与 RuntimeHost

- IndexedDB adapter 保留 transaction/CRUD facade；current schema parsing、entity serialization、checksum/snapshot、retention policy 进入纯 services。storage version、store/index names 和 CAS diagnostics 不变。
- RuntimeHost child app 保留 props-free template/lifecycle facade；sync state、geometry/design registration、protocol dispatch 和 runtime form events进入 composables/services。
- `DesignRuntimeHostFrame` 保留 parent iframe lifecycle；先用 unit test锁定 scale 坐标、canvas height、revision/session/sequence 丢弃。

## 7. Compatibility 与测试锚点

- Workbench 是 private app，但 Project/RuntimeHost/Flow/template 数据协议视为稳定 current contract。
- Source generator 必须通过 byte-level snapshot/semantic parity 和两套真实生成项目 build。
- Controller 使用既有 repository/session tests，加 App shell mount 接线 characterization。
- Monaco/RuntimeHost 先补 lifecycle/geometry characterization，随后才提取闭包。
- CSS 和 locale data 不进入本任务，避免与视觉精修并行任务冲突。

## 8. 回滚与提交

按 ownership/debt、Source export、controller、Flow、Monaco、persistence、RuntimeHost 七个稳定批次提交。每批通过 owning tests/typecheck/build；任一协议/生成输出回归只回滚该边界。最终运行 Workbench unit/templates/E2E 与全仓门禁，不 push。
