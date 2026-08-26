# ConfigForm Serializable Reaction Contracts

## Scenario: Adding reusable serializable behavior across ConfigForm packages

### 1. Scope / Trigger

Apply this contract when a ConfigForm feature introduces executable configuration shared by Headless, Runtime, Designer, or UI-library adapters. Shared pure contracts belong in `@moluoxixi/config-form-core` only when they are independently reusable and add no Vue, Zod, controller, renderer, designer, or adapter dependency.

### 2. Signatures

```ts
type ConfigFormReactionEffect
  = | { kind: 'setValue', target: string, value: ConfigFormReactionOperand }
    | { kind: 'clearValue', target: string }
    | { kind: 'setState', target: string, state: Partial<Record<'visible' | 'disabled' | 'readonly' | 'required', boolean>> }
    | { kind: 'setProps', target: string, props: Record<string, ConfigFormReactionOperand> }
    | { kind: 'validate', target: string }

interface ConfigFormReaction {
  id: string
  enabled?: boolean
  when: ConfigFormReactionCondition
  then: ConfigFormReactionEffect[]
  else?: ConfigFormReactionEffect[]
}

function evaluateConfigFormReactionCondition(
  condition: ConfigFormReactionCondition,
  values: Record<string, unknown>,
): boolean

function applyConfigFormReactionList<TValues extends object>(
  reactions: ConfigFormReaction[],
  inputValues: TValues,
): ConfigFormReactionProjection<TValues>

const CONFIG_FORM_REACTION_MAX_DEPTH = 64
```

Stable runtime errors:

```ts
'CONFIG_FORM_REACTION_CYCLE'
'CONFIG_FORM_REACTION_DEPTH_EXCEEDED'
```

### 3. Contracts

- Dependency direction is `Core -> Headless -> Runtime/Designer/adapters`. No downstream package may be imported by Core.
- Reactions contain JSON literals, top-level field references, a closed condition AST, and a closed effect union. Functions, arbitrary JavaScript strings, URLs, component instances, nested field paths, and async effects are forbidden.
- A value change runs one synchronous transaction in declaration order. Chained value writes continue until the pass-start and pass-end models are deeply equal.
- Repeated pass-end values or the convergence ceiling fail with `CONFIG_FORM_REACTION_CYCLE`; execution must never loop indefinitely.
- Condition trees and cloned/compared values are bounded by `CONFIG_FORM_REACTION_MAX_DEPTH`. Exceeding it fails with `CONFIG_FORM_REACTION_DEPTH_EXCEEDED`, not a native stack overflow.
- State and props are controller-owned projections. They never mutate field definitions, Designer documents, history snapshots, or exported JSON.
- Later matching reactions override earlier reaction state/prop keys. Validation targets are de-duplicated while preserving first declaration order.
- Renderer merge order is registration props, field props, reaction props, then binding and ARIA safety props. The `reactions` declaration itself is never forwarded to components or DOM.
- Reaction visibility overrides only node-local visibility. It cannot expose a child beneath a hidden ancestor.
- Controller notifications, metadata revisions, external model replacement, and change validation observe the final stable model, not intermediate writes.
- Designer Zod schemas validate the portable Core shape and every source/target field reference. Compilation deep-clones reactions; history and export preserve only the declaration.
- The visual editor uses registered ConfigForm controls and previews the shared reducer against an isolated mock model. Preview state must not enter the saved document.
- Element Plus and Ant Design Vue must execute the same compiled protocol through `ConfigFormRenderer`. Adapter code may supply components and native bindings but must not implement a second reducer.
- The legacy root `ConfigForm/useForm` runtime is a separate state engine. Do not claim reaction support for it until it is migrated or explicitly deprecated in a breaking release.
- Workspace package `exports.types` may resolve built declarations. Build Core before Headless, Runtime, Designer, and Playground verification so stale `dist` files cannot hide source-contract drift.

### 4. Validation & Error Matrix

| Input/state | Required behavior | Error/diagnostic |
| --- | --- | --- |
| No-op value write | Converge without another observable transaction | None |
| A writes B, B writes C | Resolve final B and C in declaration order | None |
| Alternating or non-converging writes | Stop deterministically | `CONFIG_FORM_REACTION_CYCLE` |
| Condition/value depth exceeds the public limit | Stop before host stack exhaustion | `CONFIG_FORM_REACTION_DEPTH_EXCEEDED` |
| Unknown source or target field in Designer JSON | Preserve editable document but block valid export | Node-scoped `DESIGNER_REACTION_FIELD_UNKNOWN` |
| Duplicate reaction id | Diagnose the later declaration | `DESIGNER_REACTION_ID_DUPLICATE` |
| Parent container is hidden, child reaction sets visible true | Keep child hidden | None |
| `setProps` targets `__proto__`, `constructor`, or `prototype` | Preserve own cloned data properties without prototype mutation | None |
| Reaction requests validation | Validate the stable target state/model once | Normal field validation result |
| Export after preview | Include declared `reactions`; exclude derived values/state/props | None |

### 5. Good / Base / Bad Cases

```ts
// Base: a portable, deterministic value chain.
const reactions: ConfigFormReaction[] = [{
  id: 'copy-name',
  when: { kind: 'literal', value: true },
  then: [{ kind: 'setValue', target: 'displayName', value: { kind: 'field', field: 'name' } }],
}]

// Good: every consumer imports the same reducer and AST from Core.
const projection = applyConfigFormReactionList(reactions, model)

// Bad: adapter-specific linkage logic or executable strings.
const reaction = { when: 'window.user.isAdmin', run: () => fetch('/options') }
```

### 6. Tests Required

- Core unit tests: every AST branch, then/else, disabled reactions, declaration-order overwrite, chain convergence, cycle errors, depth errors, validation de-duplication, cloning, and prototype-like keys.
- Headless tests: final-model notifications, field metadata, validation timing, parent visibility, dynamic field-tree refresh, no field-definition mutation, and external model replacement.
- Renderer tests: value/state/props effects, merge precedence, hidden/disabled/readonly/required behavior, and no reaction declaration leakage to component props or DOM.
- Designer tests: strict schema, duplicate ids, all source/target diagnostics, compiler deep cloning, history undo/redo, isolated preview, visual add/edit/remove, and export purity.
- Adapter tests: real Element Plus and Ant Design Vue controls receive the same value/state/prop results through native bindings.
- Browser tests: visually add a reaction for both adapters, verify a real target control changes, verify export purity, and verify the reaction editor at 390px has no horizontal document overflow.
- Package checks: build in dependency order, run public package-boundary verification, then run full lint, typecheck, test, build, and Playground E2E.

### 7. Wrong vs Correct

#### Wrong

```ts
// Mutates the source schema and creates adapter-specific behavior.
field.disabled = evaluateLocalExpression(field.reaction, model)
elementProps.reactions = field.reactions
```

#### Correct

```ts
const projection = applyConfigFormReactionList(field.reactions ?? [], model)
const effectiveDisabled = projection.states[field.field]?.disabled ?? field.disabled
const componentProps = { ...registrationProps, ...field.props, ...projection.props[field.field] }
```

The correct form keeps execution reusable, serializable, deterministic, and independent from the renderer and active UI library.
