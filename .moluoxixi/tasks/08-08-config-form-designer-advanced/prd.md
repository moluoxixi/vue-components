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

## Out of Scope

- A hosted backend, authentication, or persistence service for remote option sources.
- Arbitrary JavaScript execution inside saved documents.
- A full end-user form preview replacing the existing runtime preview.
