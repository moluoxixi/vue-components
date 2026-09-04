# Workbench 结构调研摘要

## Architecture Debt

- `features/templates/components/TemplateCreationWorkspace.vue` -> `src/App/components/`，唯一 parent 为 `src/App.vue`。
- `studio/components/PreviewDrawer.vue`、`StudioLeftPanel.vue` -> `src/app/components/`，唯一 parent 为 `src/app/index.vue`。
- `project/errors/index.ts` 含 `WorkbenchProjectError` 实现，应改为 export-only。

## 热点

- P0：`project/export/services/source.ts` 1591 行。
- P1：`app/services/controller.ts` 1088 行；`FlowWorkspace/index.vue` 932 行；`WorkspaceCodeEditor/index.vue` 851 行。
- P2：IndexedDB repository 793 行；RuntimeHost child app 633 行；app shell 616 行。
- CSS 1024/985/775 与 locale messages 778 为单一规则/数据职责，不做机械拆分。

## Ownership

- FlowWorkspace 仅属于 `features/flow`；PageManager 仅属于 `features/pages`；ProjectFileTree、WorkspaceCodeEditor 仅属于 `features/export`。
- Preview Runtime frame 有 Preview drawer、template preview、JSON import 三个 owner，继续属于 RuntimeHost infrastructure。
- Design Runtime frame 只有 app shell caller，但 protocol/geometry 仍属于 RuntimeHost；先补直接测试再决定组件位置。

## 行为锚点

- Source：canonical Config/Source、portable Flow、validation、responsive layout 和两套生成项目真实 build。
- Controller：template/project/page creation transaction、repository CAS、recovery、Design/Preview/Export session composition。
- Flow：PageFlowEngine 唯一执行 facade、真实 Preview component event exactly once。
- RuntimeHost：identity/session/revision/sequence、atomic runtime state/submit、geometry/pointer scaling。
- Monaco：worker label、in-memory URI、model disposal、readonly、theme、Ctrl/Cmd+S。

## 优先测试缺口

- `DesignRuntimeHostFrame` scale/canvas-height/pointer/revision 没有直接 unit coverage。
- App shell 到 controller/session/dialog 的接线主要靠静态 architecture test。
- Monaco 只有 worker-label helper 测试，缺少 model switching/disposal characterization。
