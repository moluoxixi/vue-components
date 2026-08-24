# ConfigForm designer advanced capabilities

## Goal

Make the visual form designer behave like a production layout editor: use a stable 24-cell grid, preview responsive layouts, explain invalid defaults before export, and let adapters provide option data without coupling the core designer to a network client.

The standalone designer must also prove that the core is UI-framework independent by supporting equivalent Element Plus and Ant Design Vue adapters. The legacy shadcn adapters are removed because they do not have a stable upstream Vue component contract and cannot meet the same production compatibility bar.

## Background

- The designer already renders real registered components and mirrors the runtime renderer for numeric `columns`, `fieldSpan`, `span`, `inline`, `gap`, and label position.
- The runtime and document defaults use 24 grid columns, while the Playground sample currently hard-codes `form.columns: 2`; this makes the property named “grid width” appear to be a two-cell layout.
- Element Plus choice fields currently use static `props.options`; the registry already owns option editing and field material metadata.
- Field conditions and validation rules are already persisted on designer nodes, but the canvas does not run a representative model through those conditions while editing.

## Requirements

### R1. 24-cell baseline

- Keep the public numeric `form.columns` and `form.fieldSpan` contract backward compatible.
- The default/sample form uses 24 columns. Sample containers explicitly use spans (12/12) when a two-up composition is desired; field span remains expressed in the same 24-cell coordinate system.
- Property controls accept values from 1 through 24 and canvas/runtime clamp node spans to the active column count.

### R2. Responsive column presets

- Add optional desktop/tablet/mobile column presets without changing the meaning of existing numeric documents.
- The designer exposes the active preview breakpoint visually; switching breakpoints updates the canvas grid and span preview without requiring JSON editing.
- Runtime and compiled documents resolve the same preset at the same viewport breakpoint. Inline layout continues to use flex wrapping and ignores grid columns.

### R3. Extensible option data sources

- Preserve static options as the default path.
- Add a serializable option-source contract that can represent a local dictionary or an adapter-provided resolver, plus loading/error/empty states.
- The core designer must not make network requests itself; adapters own fetching and normalize results to the shared option shape.
- Default-value controls consume the normalized options and keep unsupported values out of Element Plus controls.

### R4. Linkage preview

- Provide a visual preview mode with a small editable mock model.
- Field conditions for visible/hidden/disabled/readonly/required are evaluated against that model in the canvas preview.
- Editing the mock model updates affected nodes immediately and never mutates the saved document.

### R5. Default/rule diagnostics

- Diagnose defaults that are not present in current options, violate the field value kind, or conflict with nullable/required rules.
- Diagnostics are shown in the property panel and included in export validation; they do not silently rewrite the document.

### R6. Ant Design Vue adapter parity

- Publish `@moluoxixi/config-form-designer-antd-vue` as an adapter package that depends on the designer contract and Ant Design Vue, never the Element Plus adapter.
- Cover the same field, choice, date/time, layout, readonly, default-value, option-source, diagnostics, and locale capabilities as the Element Plus adapter.
- Render real Ant Design Vue components on the canvas and use the Ant Design Vue `value`/`checked` update contracts.
- The standalone designer exposes a visual Element Plus / Ant Design Vue switch and swaps to an adapter-compatible sample document without requiring JSON editing.

### R7. Remove unstable shadcn adapters

- Remove the public shadcn ConfigForm and runtime-plugin packages, Playground examples, tests, package-verification entries, release references, and lockfile importers.
- Remove shadcn from component aggregation entry points and documentation so no supported path advertises an unavailable adapter.
- Treat the package removal as an explicit breaking change in release notes.

### R8. Single focus-bound selection frame

- Render exactly one dashed selection frame, 5px outside the selected node's real layout cell, with the compact action bar attached to the frame's top-right edge.
- Do not render a second component-sized frame or a separate span footprint. A root 24-span node therefore has one full-row frame while an intrinsic control remains compact inside it.
- Show the frame and action bar only while focus remains inside the node or its action bar. Moving focus to properties, tools, or elsewhere hides the frame without discarding the selected node's property context.
- The frame uses non-layout CSS positioning and requires no component measurement or resize observation.

### R9. Expanded Ant Design Vue materials

- Add production-ready password, search, autocomplete, slider, and rate field materials.
- Every new material provides native Ant Design Vue binding, visual setters, a default-value contract, readonly rendering, zh-CN metadata, and automated coverage.
- Autocomplete reuses the normalized option-source contract and diagnostics instead of introducing an adapter-specific data format.

### R10. Root grid span semantics

- `span` controls only direct children of the root ConfigForm grid; a root `span: 24` node occupies one complete row before following `span: 8` nodes.
- Nested Card and Section content stacks according to the container, while Flex and Grid materials own their child sizing contracts.
- The property panel does not offer an ineffective Span setter for nested nodes. Imported nested `span` values remain round-trip compatible and are not silently deleted.

### R11. Runtime-faithful canvas

- The designer canvas uses the same resolved span, field layout, semantic classes, condition state, readonly state, model value, and adapter Runtime styles as `ConfigFormRenderer`.
- A root `span: 24` field owns the complete grid row even when its real control, such as Switch or Rate, keeps its intrinsic width.
- Selection chrome remains an editor-only projection: one focus-bound frame follows the complete node cell without changing component width or layout.
- Linkage conditions always evaluate against the isolated preview model. The linkage interaction toggle controls whether preview controls accept input; it does not switch condition rendering on or off.

### R12. Production container canvas language

- Keep every layout material rendered by its real adapter component and preserve its runtime slot hierarchy; design chrome must not replace Card, Tabs, Collapse, Flex, Grid, or their child containers with generic wrappers.
- Non-empty container slots add no generic inner border or artificial padding. Section uses a heading-and-divider hierarchy, while Card, Tabs, and Collapse retain their native framework appearance.
- Empty slots expose one quiet, icon-only drop surface. The surface becomes accent-colored only during drag interaction and must not create a second selection frame.
- Flex and Grid empty states communicate their layout structure with subtle guides rather than canvas instructions or permanent labels.
- Element Plus and Ant Design Vue provide the same container semantics, and selecting a container continues to use the single focus-bound node frame.

### R13. ConfigForm-backed property panel

- Project `DesignerPropertySetterDefinition` metadata into one shared `ConfigFormRenderer` instead of maintaining a second handwritten form renderer for ordinary property controls.
- Let registry layers inject text, textarea, number, boolean, and select components plus their native value/update bindings; the core designer must not import Element Plus or Ant Design Vue.
- Render default, options, condition, validation, responsive, and adapter-provided editors as ConfigForm custom fields while preserving their full-width composition.
- Keep every property write on the existing `updateNodePath` / `updateForm` history path so ConfigForm integration cannot bypass undo, redo, diagnostics, or document normalization.
- Simple setters keep a stable left label column; custom fields retain full-width content on desktop and narrow layouts.

### R14. Semantic component registry and extensions

- Headless owns a shared component registration contract that accepts either a Vue component or a registration with default props and value/event bindings.
- Runtime, renderer, Element Plus, Ant Design Vue, and designer registries resolve string aliases such as `component: 'text'` without coupling core packages to a UI library.
- Explicit field bindings override registration defaults; caller registry layers override adapter defaults.
- Field and container nodes may carry serializable `extensions` metadata. It remains available to slot, readonly, designer, adapter, and plugin consumers but is never forwarded to real components or DOM attributes.
- The designer property panel uses semantic aliases backed by the active adapter's registered real controls, while history and document export remain unchanged.

### R15. Serializable field reactions

- Add a UI-library-independent `reactions` contract to `@moluoxixi/config-form-core`, Headless field nodes, and designer documents. Core owns the portable JSON/condition/reaction types, evaluator, and pure stable reducer; it has no Vue, Zod, Headless, Runtime, Designer, or adapter dependency.
- The first release supports deterministic synchronous effects for setting or clearing a top-level field value, deriving field visible/disabled/readonly/required state, deriving component props, and requesting validation for a target field.
- A value change executes reactions as one stable transaction in document order. Chained reactions are supported; no-op writes terminate naturally; cyclic or non-converging writes fail with an explicit error instead of looping.
- Reaction-derived state and props are runtime projections. They do not mutate field definitions, designer documents, history entries, or exported JSON beyond the declared `reactions` configuration.
- The designer provides visual reaction editing using registered ConfigForm controls, validates every field reference, previews effects against the isolated mock model, and compiles the same protocol consumed by Runtime.
- Asynchronous effects, remote calls, arbitrary property paths, array fields, and manual `reloadOptions` are deferred until Runtime and adapter option resolvers share one cancellation/cache/refresh contract.
- Other cross-layer pure contracts may move to Core only when they are independently reusable and do not pull controller, Vue component, schema-validation, or UI-adapter responsibilities into Core.

### R16. Reusable reaction configuration primitives

- Keep reaction execution and reaction configuration as separate Core modules: execution evaluates saved declarations, while configuration helpers create and immutably edit those declarations without Vue, Zod, Designer, Headless, Runtime, or adapter dependencies.
- Core configuration helpers cover deterministic ids, default reaction/effect factories, branch/effect replacement, operand conversion, and non-empty state/prop updates. Designer UI consumes these helpers instead of owning duplicate protocol mutation logic.
- Preserve the serialized reaction shapes and current visual editing behavior. UI-only normalization, locale text, DOM events, field-option selection, document-wide diagnostics, and Zod validation remain in Designer.
- Keep runtime slots in Headless because their public contract contains Vue components, render functions, and VNode-oriented context. Designer container slots remain a separate JSON document tree with material constraints and history paths; they must not be forced into the same Core abstraction.
- Extract other helpers only when at least two real consumers share the same behavior and ownership. Similar names alone are not sufficient when serialization, runtime, or framework semantics differ.
- Move the adapter-neutral option-source types, input reader, option normalizer, cache key, and state snapshot helpers into Designer's shared public layer. Element Plus and Ant Design Vue retain adapter-named aliases and resolver lifecycle code for backward compatibility.

### R17. 基于目录扫描的物料注册

- Core 提供与 Vue、Vite 和具体 UI 库无关的确定性命名模块注册器；Headless 基于它将组件物料模块收敛为现有 `ConfigFormComponentRegistry`，Designer 基于它将设计器物料模块收敛为现有注册层。
- Element Plus 与 Ant Design Vue 的配置化表单默认物料分别放入适配器自己的 `src/materials/<name>.ts`；两个设计器适配器使用相同的命名目录规则保存设计器物料定义和对应本地化信息。
- 适配器聚合入口使用构建期 eager 文件扫描统一注册，不要求业务调用方维护第二份物料数组或对象清单。扫描结果按显式顺序和名称稳定排序，Windows 与 Linux 构建结果一致。
- 文件名、模块声明名和设计器物料 key 的末段必须一致；空名称、危险名称、重复名称或不一致名称在注册阶段抛出稳定、可诊断的错误，禁止依赖对象覆盖或文件系统遍历顺序。
- 保持现有公开常量、物料 key、组件绑定、readonly、setter、locale、用户层优先级和导出 JSON 完全兼容。文件扫描只生成适配器默认层，调用方注册仍可覆盖默认层。
- `import.meta.glob` 只允许出现在适配器源码聚合入口；Core 与 Headless 的公共注册逻辑仅接收普通模块映射，因此不依赖 Vite，也可在 Vitest、Node 和其他构建工具中单独验证。

## Acceptance Criteria

- [x] Playground opens with a 24-column root grid; the sample’s two-up sections are achieved with explicit 12-cell spans.
- [x] Existing numeric documents parse, compile, render, export, and undo/redo unchanged.
- [x] Desktop/tablet/mobile preview switching is visual and produces matching designer/runtime grid styles.
- [x] Static and adapter-provided option sources normalize to one typed option contract with visible loading/error/empty states.
- [x] Linkage preview changes field state from a mock model and leaves the persisted document byte-equivalent.
- [x] Invalid defaults and default/rule conflicts produce actionable diagnostics without data loss.
- [x] Unit, typecheck, build, and standalone designer E2E coverage pass at desktop and narrow viewports.
- [x] Element Plus and Ant Design Vue can be switched visually in the standalone designer and both render real adapter components.
- [x] Ant Design Vue adapter package tests, typecheck, build, export-boundary checks, and browser smoke tests pass.
- [x] No supported package, Playground path, verification script, or lockfile importer references shadcn.
- [x] Selected nodes expose one full-cell dashed frame with a compact action bar at its top-right edge for both adapters and all field/container materials.
- [x] Password, search, autocomplete, slider, and rate are complete Ant Design Vue designer materials with locale and test coverage.
- [x] Runtime and designer regressions prove the root `24 / 8 / 8 / 8` layout, and nested nodes no longer expose an ineffective Span setter.
- [x] Runtime and designer use the same field layout and adapter Runtime namespace; a 24-span Switch occupies a full-row cell while the Switch remains intrinsic-width.
- [x] Selection chrome does not alter geometry and disappears on focus loss while the selected node remains available in the property panel.
- [x] Section, Card, Tabs, Collapse, Flex, and Grid use a production container language with one quiet empty drop surface, no generic nested frame, no canvas instructions, and adapter-parity browser coverage.
- [x] The property panel is rendered by ConfigForm with adapter-native ordinary controls, custom setter support, left labels, unchanged history semantics, and Element Plus/Ant Design Vue desktop/narrow coverage.
- [x] Headless, Runtime, Element Plus, Ant Design Vue, and the designer resolve semantic component aliases with documented override precedence and adapter-correct bindings.
- [x] Serializable `extensions` survive parse, compile, slots, readonly contexts, history, import/export, and never leak to component props or DOM.
- [x] Serializable reactions round-trip through Headless, Runtime, designer parse/compile/history/export and drive stable value, state, props, and validation effects in both Element Plus and Ant Design Vue previews.
- [x] Chained reactions converge in declaration order, cycles fail explicitly, invalid references are diagnosed, and reaction configuration never leaks to component props or DOM.
- [x] Designer reaction editing consumes dependency-free Core configuration helpers with unchanged exported JSON and adapter behavior.
- [x] Slot ownership remains explicit: Headless owns Vue-aware runtime slot contracts, while Designer owns serializable layout slots without a misleading shared Core API.
- [x] Element Plus and Ant Design Vue option resolvers consume one Designer-owned portable option contract without changing their public adapter APIs.
- [x] Element Plus 与 Ant Design Vue 的运行时组件物料由同名文件扫描生成现有默认注册表，不再维护手写聚合对象。
- [x] 两个设计器适配器的物料定义与 locale 按物料名共置，并由同一确定性扫描注册流程生成现有公开物料数组和本地化对象。
- [x] 注册器对名称不一致、危险名称和重复名称提供稳定诊断，并保持用户注册层覆盖适配器默认层的既有优先级。
- [x] Core、Headless、运行时适配器和设计器适配器的单测、类型检查、构建及公开包边界验证通过。

## Out of Scope

- A hosted backend, authentication, or persistence service for remote option sources.
- Arbitrary JavaScript execution inside saved documents.
- A full end-user form preview replacing the existing runtime preview.
