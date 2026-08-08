# ConfigForm designer advanced capabilities

## Goal

Make the visual form designer behave like a production layout editor: use a stable 24-cell grid, preview responsive layouts, explain invalid defaults before export, and let adapters provide option data without coupling the core designer to a network client.

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

## Acceptance Criteria

- [x] Playground opens with a 24-column root grid; the sample’s two-up sections are achieved with explicit 12-cell spans.
- [x] Existing numeric documents parse, compile, render, export, and undo/redo unchanged.
- [x] Desktop/tablet/mobile preview switching is visual and produces matching designer/runtime grid styles.
- [x] Static and adapter-provided option sources normalize to one typed option contract with visible loading/error/empty states.
- [x] Linkage preview changes field state from a mock model and leaves the persisted document byte-equivalent.
- [x] Invalid defaults and default/rule conflicts produce actionable diagnostics without data loss.
- [x] Unit, typecheck, build, and standalone designer E2E coverage pass at desktop and narrow viewports.

## Out of Scope

- A hosted backend, authentication, or persistence service for remote option sources.
- Arbitrary JavaScript execution inside saved documents.
- A full end-user form preview replacing the existing runtime preview.
