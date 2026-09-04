# ConfigForm Workbench 结构治理

## 目标

治理 ConfigForm Workbench 的应用编排、Source export、Flow、Monaco、RuntimeHost、IndexedDB persistence 与私有组件所有权，使核心文件可以按职责定位和独立测试，同时保持用户行为、ProjectDocument/RuntimeHost/Flow 协议、生成项目内容和视觉结果不变。

## 背景

- Architecture manifest 有 4 条本任务精确债务：`TemplateCreationWorkspace.vue`、`PreviewDrawer.vue`、`StudioLeftPanel.vue` 的 single-parent location，以及 `project/errors/index.ts` 的 logic barrel。
- `project/export/services/source.ts` 1591 行，混合 canonical mapping、portable Flow/validation runtime、Vue page、router/Vite/package 文件生成。
- `app/services/controller.ts` 1088 行，混合 session 装配、项目加载/创建/导入、页面命令、保存/版本、恢复草稿和 DOM lifecycle。
- `components/FlowWorkspace/index.vue` 932 行、`components/WorkspaceCodeEditor/index.vue` 851 行，且都只有一个 feature owner。
- `project/persistence/adapters/indexed-db-repository.ts` 793 行与 `runtime-host/index.vue` 633 行具有可辨识的 serialization/retention/CRUD 与 sync/geometry/protocol 分发职责。
- `styles/*.css` 与 `locale/constants/messages.ts` 虽为行数热点，但分别是单一视觉规则和单一数据表职责；不做纯行数拆分。

## 需求

1. 清零 4 条精确 architecture debt；旧私有路径直接删除，不保留 forwarding shim。
2. 把只属于 Flow、Pages、Export 的 `FlowWorkspace`、`PageManager`、`ProjectFileTree`、`WorkspaceCodeEditor` 迁入各自 feature `components/`，删除 package-level shared component barrel 中的错误公开路径。
3. 将 Source generator 按 canonical mapping、portable Flow runtime、validation runtime、Vue page、project files 与 facade 拆分；保持生成字节、文件顺序、路径、dependencies 和 diagnostics 不变。
4. 将 Workbench controller 按 session/project binding、template/JSON creation、page commands、persistence/version recovery 与 lifecycle 拆分；`createWorkbenchController` 保留稳定返回契约和 callback 顺序。
5. 将 FlowWorkspace 的 command/graph persistence 与 VueFlow projection 分开；保持 Flow 是组件事件的唯一正常编辑与执行路径。
6. 将 WorkspaceCodeEditor 的 worker/language/provider、内嵌 TypeScript declarations 与 editor model lifecycle 分开；保持 readonly、主题、model URI、save shortcut 和 disposal 行为。
7. 将 IndexedDB repository 的 manifest/entity parsing、checksum/snapshot/retention 与 CRUD transaction orchestration 分开，不改变 storage contract、CAS 或 retention。
8. 将 RuntimeHost child app 的 sync/runtime state、geometry/design bridge 与 message dispatch 分开；geometry 继续属于 RuntimeHost，不下沉 Runtime renderer。
9. 拆分前补 `DesignRuntimeHostFrame` 坐标缩放/revision、App shell 接线和 Monaco model lifecycle 的 characterization；复用现有 Source/Flow/persistence/protocol/template/E2E 覆盖。
10. 移除已核实的 type-only barrel 环，保持跨 feature value import 单向；不改变 package exports 或跨包依赖方向。
11. 每个高风险边界独立提交并运行 Workbench unit/typecheck/build；最终运行 templates、ConfigForm package smoke、Playground/Workbench E2E 和全仓门禁。

## 验收标准

- [ ] 4 条目标 debt 删除，architecture unknown/stale 为零。
- [ ] Workbench 不存在 P0/P1 混合职责生产热点；P2 RuntimeHost/IndexedDB 按真实生命周期拆分。
- [ ] 单父/单 feature 组件全部位于真实 owner 的 `components/`，全局 component barrel 只保留至少两个 feature 使用者。
- [ ] Source export 的文件集合与内容、portable Flow parity、validation runtime 和模板真实构建结果不变。
- [ ] App controller 的项目切换、创建/导入、页面命令、保存/版本/恢复与 session callback 顺序不变。
- [ ] Flow、Monaco、RuntimeHost、IndexedDB 的用户可观察行为、协议、geometry 和持久化语义不变。
- [ ] package exports、README/spec、类型声明和 consumer import 无漂移，无错误 deep import 或 value cycle。
- [ ] Workbench 440+ unit、typecheck、build、templates 2/2、E2E 72/72、ConfigForm package smoke、全仓 lint/typecheck/architecture/path/workflow 和 `git diff --check` 通过。
- [ ] 每批独立 commit，不 push；任务归档时工作树干净。

## 范围外

- 不改变 Workbench 主题、配色、边框、组件库选择、响应式断点或其他 UI 精修结果。
- 不拆单一职责的 CSS 大文件和 locale message 数据表。
- 不改变 ProjectDocument、PageGraph、RuntimeHost、Flow、persistence 或 template contract 版本。
- 不重写 Source generator 的输出格式，不引入第二套 portable runtime。
- 不新增跨 feature 的通用组件抽象，不移动 Runtime renderer geometry ownership。

## 关键决策

- 按 state owner、生成产物和生命周期拆分，不按行数平均切割。
- RuntimeHost 是跨 feature infrastructure；parent frames 与 child app 协议继续共用其 types/schemas。
- Flow runtime ownership是否从 `preview/` 归入 `flow/` 只在能保持依赖单向且不改变执行协议时处理；不为目录整洁复制 coordinator。
- 父任务已记录 standing approval；本任务内部重构不再重复请求批准。
