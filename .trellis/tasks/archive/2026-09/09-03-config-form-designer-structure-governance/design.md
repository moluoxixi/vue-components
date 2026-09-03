# ConfigForm Designer 结构治理技术设计

## 1. 总体边界

本任务治理三个包：Designer core、Designer Element Plus adapter、Designer Ant Design Vue adapter。Public facade、Project Command、Runtime projection 和 Registry contract 不变；重构只重新分配内部状态、生命周期、视觉区域与 material helper 所有权。

```text
types / pure services / utils
  -> composables (Vue state + lifecycle)
  -> private visual components (props/emits only)
  -> package feature entry (composition)
  -> DesignSurface / Workbench consumer
```

禁止子组件反向 import `DesignerCanvas/index.vue` 或 `DesignSurface`，禁止 composable 创建第二套 Project/selection/history 状态。

## 2. DesignerCanvas

### Composables

- `use-designer-canvas-camera.ts`：scale/fit/measure/pan、viewport pointer capture、Space/Shift+0/1/+/-、watch/mount teardown。
- `use-designer-canvas-runtime.ts`：surface model、Runtime node registration、local/external geometry、camera re-anchor、editor bridge 和 runtime slot scope。
- `use-designer-canvas-drop-targets.ts`：candidate command/projection、keyboard targets、DOM hit resolution、collapsed/sticky/sibling priority 和 auto-scroll。
- `use-designer-canvas-selection.ts`：pointer target interpretation、primary/multi selection、modifier semantics 与 overlay selection projection。
- `use-designer-canvas-node-drag.ts`：pointer capture、drag start/move/up/cancel、offset fallback 与 controller teardown。
- `use-designer-canvas-resize.ts`：resize eligibility、window pointer lifecycle、span commit/cancel 和 Runtime host pointer callback 协调。
- `use-designer-canvas-menu.ts`：toolbar/menu roving focus、Escape focus restore、outside-close 与 action dispatch。

Pure calculations remain in services/utils. A composable may depend on typed readonly capabilities from another composable, but cycles are forbidden; Runtime geometry is the shared read boundary for selection/drop/resize.

### Private components

- `DesignerCanvasRuntime.vue`：默认 `ConfigFormRenderer` 与 runtime slot。
- `DesignerCanvasOverlay.vue`：selection、policy、collapsed indicator 和 resize handle。
- `DesignerCanvasNodeToolbar.vue`：node actions、drag handle、menu trigger/menu。
- `DesignerCanvasDragVisual.vue`：candidate Runtime visual 与 pointer-following clone host。

Private components receive stable dimensions and callbacks through typed props/emits. They do not own Project commands or inject the Design session directly unless the lifecycle is exclusively theirs.

### Facade

`DesignerCanvas/index.vue` retains public props/emits, session lookup, composable composition, overlay-mode precedence and the top-level viewport template. Existing public types and style entry stay at their current paths.

## 3. Surface、PropertyPanel 与 Palette

- `DesignSurface/composables/use-design-surface-workspace.ts` owns responsive mode, panel visibility, focus migration, tab ARIA and `ResizeObserver` cleanup.
- `DesignSurface/composables/use-design-surface-commands.ts` adapts move/resize/path/form/remove, selection, undo/redo and global edit shortcuts to the existing controller.
- Surface remains the locale/session provider and preserves `DesignSurfaceProps/Emits/Slots/Expose`, especially Workbench's `selectWorkspaceView`、`select`、`performNodeAction` calls.
- `DesignerPropertyPanel/composables/use-property-panel-entries.ts` owns selection/material projection, stale-config actions, setter reads and command payloads.
- `DesignerPropertyPanel/composables/use-property-panel-tabs.ts` owns active tab restoration, scroll and roving keyboard focus.
- `DesignerPalette/composables/use-designer-palette-drag.ts` owns pointer/keyboard drag lifecycle. Search/group presentation and the existing content slot scope remain in the facade because Palette has both Surface and Workbench consumers.

## 4. Adapter Materials

For each provider:

```text
materials/
  constants/               # Antd-only binding constants
  defaults/
    index.ts                # barrel only
    options.ts
  services/
    index.ts                # barrel only
    property-setters.ts
    source.ts
  components/              # material-private Runtime、setter 与 option-state components
  shared/
    index.ts                # aggregate only
```

- Remove obsolete `bindings/`、`setters/`、`source/` directories instead of leaving forwarding shims.
- Defaults retains a meaningful responsibility barrel; implementation moves to `options.ts`.
- Antd and Element keep provider-specific binding, plugin, stylesheet and setter component identities. Similar control flow alone is not enough to create a cross-adapter abstraction.
- Move every material-only Runtime/setter/OptionState component below `materials/components/`; move Antd choice readonly content below `readonly/components/`. Static ownership showed no adapter component with two independent Feature consumers, so the package-level components barrel is deleted.
- `import.meta.glob('./*.ts')` material discovery and package root exports remain unchanged.

## 5. Behavior Anchors

Before or alongside extraction, tests cover:

- Camera clamping/fit/center zoom and keyboard mapping.
- Space pan pointer capture and listener cleanup.
- Runtime register/unregister generation safety and external geometry re-anchor.
- Drop priority and candidate identity reuse.
- Selection modifiers and overlay mode suppression.
- Menu roving keys, Escape focus restoration and outside close.
- Resize begin/move/commit/cancel/readonly/unmount.
- Surface breakpoint focus migration, PropertyPanel tab state and Palette keyboard retry.
- Adapter defaults cloning, source metadata, binding constants, setter component identity and registry discovery.

## 6. Compatibility And Rollback

Each responsibility is extracted with its existing tests green before the next one. Public exports, paths, props/emits/slots/expose and CSS selectors remain fixed. A failed extraction is rolled back at that responsibility boundary; no old-path shim or alternate state store is introduced.

## 7. 验证构建的声明边界

Workbench 与组件 Playground 的自动组件/自动导入声明属于开发态生成输入。Vite `serve` 继续更新已跟踪的 `src/*.d.ts`，production build 将 `dts` 设为 `false`，只消费已提交声明，不在多入口 transform 期间并发覆写源码。Workbench bundle verifier 继续精确比较 Element Plus SFC 标签与声明集合；全仓 typecheck 验证提交声明可用。
