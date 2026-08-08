# Technical Design

## Boundaries

The designer document remains the source of truth. The core designer owns serializable layout, option-source metadata, condition evaluation, and diagnostics. Adapters own component bindings and option resolution. Runtime packages consume the compiled renderer config and never import designer UI code.

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

## Compatibility and Rollback

Old documents remain valid because all new fields are optional. If a responsive preset or option resolver is unsupported, the numeric/static fallback is used. Each deliverable can be disabled at the designer feature-prop boundary while retaining the old document/compiler path.

## Trade-offs

CSS media variables are preferred for runtime responsive layout because they avoid duplicating layout math in JavaScript. The designer may use an explicit breakpoint switch for deterministic review while emitting the same variables. Resolver execution is adapter-owned to keep the core package browser-safe and transport agnostic.
