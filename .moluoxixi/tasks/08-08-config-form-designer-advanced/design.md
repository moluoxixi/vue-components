# Technical Design

## Boundaries

The designer document remains the source of truth. The core designer owns serializable layout, option-source metadata, condition evaluation, and diagnostics. Adapters own component bindings and option resolution. Runtime packages consume the compiled renderer config and never import designer UI code. Element Plus and Ant Design Vue are sibling adapter layers; neither adapter imports the other, and the core never imports either concrete UI library.

## Contracts

- `form.columns` and `form.fieldSpan` remain numeric and default to 24.
- A new optional responsive preset is additive and resolves to one numeric column count for a given breakpoint. Numeric documents take precedence over absent presets.
- Option resolvers return normalized `{ label, value, disabled? }` records and an explicit `{ status: 'idle' | 'loading' | 'ready' | 'error', options, error? }` state. The core only calls an adapter-supplied resolver; it does not know transport details.
- Linkage preview uses a cloned mock model held in designer-local state. Condition evaluation is pure and receives `(model, node)`, returning derived field state.
- Diagnostics are derived projections with node id/path/code/severity/message. They are recomputed after document or option state changes and are never persisted as mutations.

## Data Flow

`document -> parse/normalize -> designer breakpoint resolver -> canvas/runtime renderer`

`material option source -> adapter resolver -> normalized option state -> property/default setters and diagnostics`

`mock model + node conditions -> pure evaluator -> preview node props/classes`

`node defaultValue + props.options + validation -> diagnostics projection -> property panel/export result`

`framework switch -> adapter registry + adapter sample document -> unchanged designer core`

## Adapter Packaging

- `@moluoxixi/config-form-designer-element-plus` remains the Element Plus implementation.
- `@moluoxixi/config-form-designer-antd-vue` mirrors the public adapter capabilities using Ant Design Vue 4 components and their native `value`/`checked` event contracts.
- Option resolver contexts remain adapter-owned so consumers can install either package independently.
- Material keys are namespaced (`element.*` and `antd.*`). Switching adapters therefore creates an equivalent adapter-specific sample document instead of rewriting arbitrary user documents.
- Shared designer documents can still be imported when their material keys are registered by the active consumer.

## shadcn Removal

The prior shadcn packages are removed rather than marked experimental. They modeled local primitive components rather than a stable upstream Vue library, which made their public compatibility surface application-specific. Keeping them would imply a support contract that cannot be verified across consumers. Removal includes package importers, aggregate exports, demos, tests, verification scripts, documentation, changesets, and lockfile entries.

## Compatibility and Rollback

Old documents remain valid because all new fields are optional. If a responsive preset or option resolver is unsupported, the numeric/static fallback is used. Each deliverable can be disabled at the designer feature-prop boundary while retaining the old document/compiler path.

## Trade-offs

CSS media variables are preferred for runtime responsive layout because they avoid duplicating layout math in JavaScript. The designer may use an explicit breakpoint switch for deterministic review while emitting the same variables. Resolver execution is adapter-owned to keep the core package browser-safe and transport agnostic. Duplicating the small adapter-specific view glue is accepted to preserve package independence; reusable semantic contracts stay in the core designer rather than creating cross-framework imports.

## Selection Geometry

The selectable document node remains the interaction owner and the only selection boundary. Its `position: relative` layout cell owns a dashed `::after` frame at `inset: -5px`; the action bar is an absolutely positioned direct child aligned to the frame's top-right edge. The frame exists only under `:focus-within`, so moving into the property panel hides editor chrome without clearing the controller selection. This removes component measurement, resize observers, and competing component/span outlines while keeping the frame outside normal layout.

## Additional Ant Design Vue Materials

Password and search extend the existing input contract. Slider and rate reuse the numeric default and raw readonly contracts. Autocomplete reuses the adapter's normalized option resolver, option-source setter, default choice setter, and diagnostics. Hierarchical choices and range values remain deferred until the shared document/default-value contract can model them without lossy editor controls.

## Span Ownership

The Runtime and designer apply `node.span` only while wrapping direct root nodes in the ConfigForm grid. Container slot children are rendered without a root grid cell: Card and Section use their natural flow, Flex uses item width, and Grid uses its local column contract. The property panel derives the selected node location and exposes Span only when the node has no parent. Parsing and exporting keep existing nested span values unchanged for backward compatibility.

## Runtime-faithful Canvas

Runtime owns the canonical node-span and field-layout projections. The designer imports those projections, emits the active adapter's Runtime namespace, and loads both supported Runtime style entries in the standalone page. This keeps label placement, control width, readonly rendering, conditions, and root-cell geometry aligned without importing a concrete UI library into the designer core.

The single node-cell frame makes the root span visible while compact controls remain visually honest inside the cell. The frame and action bar use absolute positioning and never influence grid sizing or component width. Conditions always derive from the isolated preview model; interaction mode only gates emitted value changes.

## Container Canvas Language

The recursive node list projects its parent material key as designer-only DOM metadata. Core CSS owns the shared empty-slot and dragging states; adapter CSS owns the visual treatment for custom Section, Flex, and Grid runtimes. Native Card, Tabs, TabPane, Collapse, and CollapseItem components keep their framework DOM and styling.

Non-empty recursive lists contribute layout flow only: no generic padding, background, or border. Empty lists render one icon-only surface, while Grid and Flex may inherit adapter layout variables to draw non-semantic structural guides. No material-name label or instructional copy is added to the canvas. Selection remains the existing node-cell pseudo-element, so container styling cannot introduce a competing selection boundary.

## Property Panel Layout

The property panel projects core `DesignerPropertySetterDefinition` metadata into a single `ConfigFormRenderer`. Simple setter definitions become ordinary ConfigForm fields. Structured and custom setters become custom fields whose component is the existing `DesignerSetter`, so default, options, conditions, validation, adapter editors, and responsive controls retain their specialized composition.

`DesignerRegistryLayer.propertyControls` is the UI-framework boundary. A layer may provide a component, value prop, update trigger, blur trigger, static props, and event normalizer for each simple setter kind. First-layer precedence matches material and validator overrides. Element Plus and Ant Design Vue publish complete control maps, while the core falls back to `DesignerSetter` for missing mappings and never imports either framework.

ConfigForm `fieldChange` is mapped back to the originating setter and then to the existing `updatePath` or `updateForm` event. Empty text and number values are normalized at that boundary, but document writes, history, diagnostics, and schema finalization remain unchanged. Direct fields use a stable label track and flexible control track; custom fields have no ConfigForm label and keep their own full-width label/editor structure.

## Semantic Components and Extensions

`@moluoxixi/config-form-headless` owns the generic component registration shape. Renderer and legacy Runtime narrow its component type for their own render contracts instead of importing each other's internal modules. A registration normalizes to a real component plus optional props, value prop, change trigger, blur trigger, and event-value extractor. Merge order is built-in defaults, registration defaults, then explicit field configuration.

Element Plus and Ant Design Vue publish semantic alias maps. Their ConfigForm wrappers merge adapter defaults before caller registrations, while designer registry layers use the existing first-layer-wins policy. The property-control schema references aliases (`text`, `textarea`, `number`, `boolean`, `segmented`) and passes the active registry to the shared ConfigFormRenderer.

`extensions` is a node-level metadata object, separate from render `props`. Designer documents restrict it to JSON data, history clones it with the rest of the document, and compilation projects it onto headless renderer nodes. Renderer slot and readonly contexts therefore retain access, while component and DOM prop construction reads only registration props and node props.
