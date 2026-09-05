# ConfigForm Runtime State Boundaries

## 1. Scope / Trigger

This contract applies when changing the Headless controller, Runtime renderer,
`useForm` validation, Provider wrappers, or a consumer that depends on their
event order. It also applies when splitting any of these state machines.

The public APIs remain owned by the existing package and feature barrels.
Internal state services are implementation boundaries, not new public entry
points.

## 2. Signatures

The stable public entry points are:

```ts
createConfigFormController(options): ConfigFormController
useForm(options): UseFormResult
ConfigFormRenderer: ConfigFormRendererComponent
```

`ConfigFormRenderer` continues to expose the existing props, emits, default
slot, and methods. `VALIDATION_THROTTLE_MS` remains available through the
existing `use-form` barrel. `useFormValidation` is the private validation
orchestrator used by `useForm`; private controller, renderer, queue, snapshot,
result, and policy services are not re-exported from package roots.

## 3. Contracts

### Renderer

- The facade owns props/emits/model, form attrs, the default slot, expose, and
  service assembly. Vue lifecycle and watchers live in composables; pure VNode
  factories live in services.
- Design guard mode changes use a post-flush watcher. Native tabindex values are
  captured once, forced to `-1`, and restored only for connected elements.
- Editor replacement cleans every registration from the old bridge before the
  new bridge registers nodes. A VNode ref receiving `null` is an unregister
  signal.
- Component events execute in this order:

```text
Design intercept -> configured listener -> renderer listener -> Preview runtimeEvent
```

- A `runtimeEvent` is emitted only in Preview and only for canonical Flow
  subscriptions. Slot recursion preserves path, slot name, key, visibility,
  and ancestor-cycle checks.
- Legacy `ConfigForm` recursion keeps dispatch ownership in `RecursiveField`.
  The component provides its own renderer identity to descendant `FormNode`
  instances; `FormNode` consumes it only for configured node slots and must not
  statically import `RecursiveField` back into the node renderer.

### Headless Controller

- The model adapter is the value source of truth. The controller does not keep
  a second model copy.
- Meta owns touched state and notification deduplication. Validation owns
  errors, request ids, value revision, latest-field ownership, and validating
  counters.
- A field result commits only when request id, value revision, and the current
  model snapshot still match. Overlapping requests keep validating true until
  every active request settles.
- Reset clears touched state before committing reset values. Submit touches
  eligible fields, validates one snapshot, rejects stale results, filters
  hidden/disabled fields, applies transforms, and only then invokes `onSubmit`.

### Runtime Validation

- The per-field queue exclusively owns pending requests, timers, merge policy,
  the active request, and disposal.
- Only adjacent non-submit requests with the same trigger and no submit
  visibility snapshot may merge. Different triggers remain FIFO and keep their
  own queued value snapshots.
- The snapshot service exclusively owns value-change retention reference
  counts. It releases a request before execution and clears retention on
  dispose.
- The result service exclusively owns request ids used to commit UI errors.
  Invalidating a field prevents older validation or submit results from
  overwriting newer UI state.
- Disposing is idempotent, rejects pending and active listeners with
  `CONFIG_FORM_VALIDATION_DISPOSED`, clears timers/result ownership/retention,
  and ignores eventual validator completion.

## 4. Validation & Error Matrix

| Condition | Required result |
| --- | --- |
| Design mode without an editor decision | Intercept control events by default |
| Editor bridge changes | Clean old registrations before registering with the replacement |
| Canonical Flow event in Design | Never emit `runtimeEvent` |
| Canonical Flow event in Preview | Run configured/model listener before `runtimeEvent` |
| Field value, config, or revision changes during validation | Treat the active result as stale and do not write errors |
| A later request owns the same field | Older field or submit result cannot commit UI errors |
| Same-trigger interaction requests share a throttle window | Merge listeners and execute the latest snapshot once |
| Different triggers target one running field | Execute FIFO with independent snapshots |
| Validation is disposed before completion | Reject with `CONFIG_FORM_VALIDATION_DISPOSED` and clear retained state |

## 5. Good / Base / Bad Cases

- Good: queue, snapshots, result ownership, and field policy each have one state
  owner and are assembled by a small validation facade.
- Good: renderer recursion uses injected callbacks so slot rendering does not
  create an import cycle back to node rendering.
- Base: a synchronous validator still travels through the same ownership and
  commit checks as an asynchronous validator.
- Bad: cache `runtimeEvents`, component props, or node metadata across renders.
- Bad: emit Flow before the bound model listener, merge submit and interaction
  snapshots, or clear a timer without rejecting its listeners.
- Bad: move Runtime geometry or hit testing from the Workbench runtime host into
  the renderer.

## 6. Tests Required

- Renderer mode tests cover mounted mode transitions, tabindex restoration,
  editor replacement cleanup, VNode registration cleanup, Design interception,
  Preview-only Flow events, and listener normalization.
- Renderer integration tests cover attrs precedence, layout, keys, nested slot
  paths, binding precedence, reactions, readonly rendering, and public expose.
- Legacy Runtime tests cover RecursiveField dispatch, configured nested slots,
  direct FormNode mounts without injection warnings, and the package-local
  module-cycle architecture gate.
- Headless tests cover overlapping validating counters, latest-result ownership,
  reaction refresh invalidation, reset/meta order, stale submit snapshots, and
  hidden/disabled submission filters.
- Runtime validation tests cover same-trigger coalescing, different-trigger
  FIFO snapshots, journal retention transfer/release, active and pending
  disposal, stale values/configs, and submit/field result ownership.
- Run Runtime and Headless test/typecheck/build, ConfigForm public package smoke,
  Playground/Workbench consumers, and Workbench E2E after changing these
  boundaries.

## 7. Wrong vs Correct

Wrong:

```ts
async function handleChange() {
  emit('runtimeEvent', event)
  updateModel(event)
}
```

Correct:

```ts
async function handleChange() {
  updateModel(event)
  emit('runtimeEvent', event)
}
```

Wrong:

```ts
const pending = requests.at(-1)
if (pending)
  merge(pending, nextRequest)
```

Correct:

```ts
const pending = requests.at(-1)
if (pending && sameInteractionTrigger(pending, nextRequest))
  merge(pending, nextRequest)
else
  enqueue(nextRequest)
```
