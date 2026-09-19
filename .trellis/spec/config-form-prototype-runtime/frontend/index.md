# ConfigForm Prototype Runtime Frontend Guidelines

## Status

`@moluoxixi/config-form-prototype-runtime` is a current public package. Its root
and `/session` entries are DOM-free; `/vue` and `/vue/style` own the Vue
Surface/overlay host. Studio Experience and generated projects must compose
these entries instead of copying the session reducer.

## Guidelines Index

| Guide | Description | Status |
| --- | --- | --- |
| [Repository Directory Structure](../../directory-structure.md) | Responsibility-based package and public-entry boundaries | Ready |
| [ConfigForm Product Boundaries](../../config-form/frontend/product-boundaries.md) | Studio/Runtime ownership, serialization, and forbidden event domain | Ready |
| [Studio Domain Contracts](../../config-form/frontend/studio-domain-contracts.md) | Session v1, Surface instances, parameters/results, UI actions, diagnostics, and reuse | Current foundation contract |
| [Runtime State Boundaries](../../config-form/frontend/runtime-state-boundaries.md) | Form state versus Prototype session state and Preview/Source parity | Current foundation contract |
| [Architecture Documentation](../../config-form-core/frontend/architecture-documentation.md) | Current/target documentation and package activation gate | Ready |

## Pre-Development Checklist

- Confirm the change extends the shared session/host contract rather than
  creating a second reducer in Workbench or generated output.
- Read the Studio domain and Runtime state contracts before defining commands,
  reducers, instance identity, parameters, results, or overlay behavior.
- Keep root and `/session` DOM-free. Put Vue Surface/overlay hosts under `/vue`
  and styles under `/vue/style`.
- Do not import Studio/Workbench, Designer, Source, Core UI adapters, or HTTP.
- Prove Studio Experience and generated projects consume the same reducer.
- Run Node-import, unit, Vue host, package architecture, generated-consumer, and
  Preview/Source parity gates before documenting the package as current.

## Scenario: Contextual Prototype Session Reader

### 1. Scope / Trigger

Apply this contract whenever a Prototype session enters the reducer, Vue host,
Preview state, Runtime Host transport, or another package boundary.

### 2. Signatures

```ts
readPrototypeSession(
  input: unknown,
  context: PrototypeProjectContextV1,
): PrototypeReadResult<PrototypeSessionV1>
```

### 3. Contracts

- The public Reader always requires the current Reader-validated project
  context. A shape-only parser may exist internally under `schemas/`, but it is
  not exported as a weaker public session Reader.
- `pageHistory` is non-empty and, together with `overlayStack`, is an exact
  duplicate-free union with `instancesById`. Page entries reference Page
  Surfaces; overlay entries reference Dialog/Drawer Surfaces and retain a live,
  causally earlier opener.
- For every instance, replay `preparePrototypeRuntime(surface, values, runtime)`
  against current compiled topology, validate the exact parameter key set, and
  recompute `projectPrototypeInstance`. Stored projection must equal the
  canonical address-ordered result.
- An overlay opener must name a live parent address and the exact current
  `open` interaction whose target is the child Surface. Structural JSON success
  alone never authorizes session replacement or command reduction.

### 4. Validation & Error Matrix

| Condition | Required result |
| --- | --- |
| Empty Page history | `prototype_session_invalid`; publish no session |
| Project or Surface identity differs from Context | Reject before host/reducer state mutation |
| Values no longer reproduce runtime row/node/field addresses | Reject as stale runtime topology |
| Stored projection differs from canonical recomputation | Reject the complete session |
| Overlay parent/address/interaction/target is missing or mismatched | Reject the complete session |

### 5. Good / Base / Bad Cases

- Good: a Runtime Host sync projects Context from `ProjectCompilation`, then
  passes both the untrusted session and Context to the Reader.
- Base: one Page instance with exact runtime addresses and empty projection.
- Bad: call `readPrototypeSession(input)` and perform only exact-key checks, or
  patch missing checks independently in Workbench consumers.

### 6. Tests Required

- Reader tests cover empty history, wrong Surface kind/project, stale runtime,
  changed topology, non-canonical projection, and opener mismatch.
- Reducer, Vue host, Preview, and protocol tests use sessions produced by the
  shared initializer/reducer rather than impossible handwritten snapshots.
- Typecheck must fail every production call that omits Context.

### 7. Wrong vs Correct

Wrong:

```ts
const session = readPrototypeSession(message.session)
```

Correct:

```ts
const context = createPrototypeProjectContext(compilation)
if (context.success)
  readPrototypeSession(message.session, context.data)
```

## Scenario: Stable Vue Renderer Bindings

### 1. Scope / Trigger

Apply this contract when `/vue` connects one `SurfaceInstance` to a Studio or
generated renderer through `PrototypeVueSurfaceRendererBindings`.

### 2. Signatures

```ts
rendererBindings(instanceId: SurfaceInstanceId): PrototypeVueSurfaceRendererBindings
PrototypeVueControllerRegistry.subscribe(listener: () => void): () => void
```

### 3. Contracts

- One live `instanceId` owns one stable renderer-bindings object. Host rerenders,
  Registry revisions, value/projection replacement, and controller registration
  must not replace that object or its command-function identities.
- Bindings read current `instance`, `surface`, `values`, and `projection` through
  getters. Value and projection delivery to an already mounted renderer remains
  command-driven through its registered controller.
- Closing an instance deletes its cached bindings. Resetting or disposing the
  host clears every cached binding and Registry subscription.
- Registering or unregistering a controller does not itself change instance,
  value, or projection state and must not publish a render revision. Registry
  notifications for real state changes may rerender the host without recreating
  function props.

### 4. Validation & Error Matrix

| Condition | Required result |
| --- | --- |
| Same instance receives a Registry value/projection update | Preserve bindings identity and expose current values through getters |
| Dialog opens another Dialog/Drawer during component mount/update | Complete one transition without recursive Vue scheduler updates |
| Instance closes | Remove its controller and cached bindings before that ID can be reused |
| Host context/session is replaced | Dispose the old host, clear bindings, and construct a fresh cache |

### 5. Good / Base / Bad Cases

- Good: Page opens Dialog, Dialog opens Drawer, and all three renderers retain
  stable bindings while values and projections update independently.
- Base: a single Page mounts one controller and receives one projection update.
- Bad: `rendererBindings()` returns a new object or new closures on every host
  render, allowing controller registration to feed another parent patch.

### 6. Tests Required

- `/vue` tests assert referential equality for repeated bindings access, current
  getter values after Registry replacement, and cache removal after close/reset.
- An executed generated-project test mounts real generated Surface renderers,
  opens Page -> Dialog -> Drawer, flushes Vue jobs, and reports zero unhandled
  rejections or recursive-update errors.
- Workbench Experience runs the same nested overlay path so the shared-host fix
  cannot regress named-slot consumers.

### 7. Wrong vs Correct

Wrong:

```ts
return { values: registry.get(instanceId)?.values, activate: input => activate(input) }
```

Correct:

```ts
return cache.get(instanceId) ?? cacheBindings(instanceId, {
  get values() { return registry.get(instanceId)?.values ?? instanceById(instanceId).values },
  activate: input => activateFor(instanceId, input),
})
```
