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
