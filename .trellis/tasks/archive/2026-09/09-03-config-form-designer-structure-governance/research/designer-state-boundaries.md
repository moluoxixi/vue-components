# Designer 状态边界摘录

来源：`.trellis/spec/config-form-designer/frontend/state-management.md`、`quality-guidelines.md` 与 `overlay-interaction-regression.md`。本文件只提炼当前结构治理直接依赖的合同，原 spec 仍是权威来源。

## 单一状态源

- `DesignSurface` 是受控 `PageGraph` 编辑器，所有编辑继续通过 `DesignerCommandControl` 和 `ProjectCommand`；不得在 Canvas composable 或子组件中创建第二个 reducer、history 或 document snapshot。
- Drag candidate 使用 `ProjectDraftSnapshot` 和既有 semantic compiler，不进入 history、repository 或 committed store。
- Pointer 坐标、selection、overlay、resize 和 menu 都是瞬态 editor state，不得写入 ProjectDocument。

## Runtime 与 Geometry

- Design Runtime 保持 `inert` 与 `aria-hidden`；selection、drop、resize、node actions 全由 editor overlay 持有。
- Runtime node registration 的稳定 identity 是 `nodeId`。旧 cleanup callback 不得删除同一 node 的新 registration。
- Local/external geometry 必须通过同一 camera anchor 重投影；selection/drop/resize 共享只读 geometry 能力，不各自维护坐标副本。
- Pointer 在同一 drop target 内移动只能更新 visual position，不得重新编译结构 candidate。

## Overlay Mode

- Editor chrome 只有 `idle | selected | keyboard-dragging | pointer-dragging | resizing` 五种模式。
- Pointer dragging 隐藏旧 selection/policy overlay；resize 只保留 active selection 和 resize handle。
- Policy diagnostic 只属于 primary selected node；selection chrome 与 Runtime 控件之间保留明确视觉间隔。

## 生命周期与焦点

- Pointer capture、window listener、ResizeObserver、keyboard listener 和 Runtime registration 必须在 commit、cancel、readonly 切换及 unmount 时清理。
- Menu Escape 恢复 trigger focus；roving focus 保持 Arrow/Home/End 语义。
- Workspace breakpoint focus migration 与 `DesignSurfaceExpose.selectWorkspaceView` 保持现有 Workbench 合同。

## 测试证据要求

- Camera：fit/scale clamp、center zoom、Space pan、快捷键和 cleanup。
- Runtime：register/unregister generation safety、external geometry re-anchor、inertness。
- Drag/drop：candidate identity、target priority、pointer cancel/capture、auto-scroll。
- Selection/menu/resize：modifier、overlay suppression、Escape focus、commit/cancel/readonly/unmount。
- 交互 chrome 变化需要浏览器回归验证 overlay 数量、geometry、focus 与 Runtime 不可交互；只断言 CSS class 不足以证明行为。
