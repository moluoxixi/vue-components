# ConfigForm Runtime State Boundaries

## 1. Scope / Trigger

Apply to Headless, ConfigForm preprocessing, Renderer, Studio/Designer host
integration, validation, Runtime Data lifecycle, component listeners, target
Prototype Interaction, Preview, and generated Source.

Production Runtime state and target Prototype session state are separate.
Headless/Runtime continue to own form values, meta, validation, reactions, Data
Source, and direct host listeners. Planned Prototype Runtime owns page history,
Surface instances, parameters/results, and primary UI actions. Neither is a
compatibility layer for the other.

## 2. Signatures

Current production signatures:

```ts
createConfigFormModel(source: Ref<TValues>): ConfigFormModelAdapter<TValues>
ConfigFormModelAdapter = {
  read: () => TValues
  write: (values: TValues) => void
}
ConfigFormRenderer({ model, fields })
ConfigForm({ model, fields, runtime? })
createComponentListenerService({ mode })
useRendererDataLifecycle({ props, emit, controller })
```

Target persisted interaction channels:

```ts
type PrototypeInteraction =
  | StateProjectionRule
  | ValueChangeRule
  | PrimaryUiActionBinding

reducePrototypeSession(
  session: PrototypeSessionV1,
  command: PrototypeSessionCommand,
): PrototypeSessionResult
```

The full target shapes are owned by
[Studio Domain Contracts](./studio-domain-contracts.md).

## 3. Contracts

### 3.1 Production form state

- The host model port is the sole value source. Renderer read accesses Vue
  reactive state and write synchronously commits before returning. Renderer
  does not mirror values or use an asynchronous v-model echo as its store.
- Renderer watches external model replacement synchronously, clears stale
  validation, and recomputes current reactions/meta. A try/finally write guard
  suppresses only the synchronous watch during its own commit.
- Meta owns touched state; validation owns errors, request IDs, and value
  revisions. Late results cannot overwrite newer values.
- Current programmatic reaction state enters Headless field-state resolution for
  validation and submission. State changes and unmount invalidate pending work.
- ConfigForm preprocesses plugins/registrations/readonly adapters into Renderer
  nodes. Removed RecursiveField, FormContext, and old queue services do not
  return.
- Plugins receive complete nested slots. Resolve the tree once, then attach
  readonly adapters using resolved nodes; projection does not run hooks twice.
- Core owns `validateOn` normalization and responsive layout. Compiler emits
  normalized arrays; Vue and Source consume them.

### 3.2 Direct host listeners

- Component listeners are ordinary in-memory `props.onX` functions. Renderer
  composes internal value/blur listeners before host listeners and invokes each
  exactly once.
- Design mode blocks both groups inside Renderer. It does not emit, serialize,
  or forward a component-event payload.
- ConfigFormRenderer and ConfigForm do not accept event/action-forwarding props
  and do not publish scheduler result/error/trace notifications.
- A listener failure follows Vue error handling after internal binding work.
  It is not translated into a Prototype Interaction diagnostic.

### 3.3 Runtime Data Source

- Data Source `prepare/start/refresh/reset/cancelScope/stop` belongs to the Data
  runtime composable and normal form lifecycle. It never constructs a synthetic
  component or Data Source event.
- Unmount stops owned work, disposes the controller, and suppresses late
  publication.
- Target Studio Dataset is static, project-level, and runtime-readonly. It does
  not reuse Data Source requests, cache, cancellation, lifecycle, or references.

### 3.4 Target Prototype Interaction

- State projection continuously derives `visible`, `disabled`, `readonly`,
  `required`, and Material-allowlisted display props. It runs on initialization
  and after dependency changes and never mutates values.
- A value-change rule contains one `set`, `copy`, or `clear`. Initialization only
  establishes its dependency baseline; the action runs after declared fields
  change through user input or a named-result transaction.
- A value transaction settles affected rules deterministically. A cycle or
  invalid expression aborts the whole transaction; no partial values publish.
- One Material-declared semantic trigger has at most one primary UI action:
  navigate, back, open, closeCurrent, or closeAll. Primary actions run only from
  user semantic activation, never initialization or arbitrary DOM event names.
- A named result maps into caller values atomically, then triggers normal value
  and state reevaluation. Result assignments are not an action chain.
- Page history, overlay instances, parameters/results, and primary actions live
  in planned Prototype Runtime, not Headless, production Runtime, Designer, or
  iframe event forwarding.

### 3.5 Designer, Source, and validation

- Designer Canvas receives required runtime/dragVisual host integration. It does
  not compile Vue plans or render production controls. Inspector renderer is
  injected by the host.
- Source defaults come only from Canonical fields. Missing defaults remain
  absent, bindings do not guess keys, form readonly dominates field state,
  hidden/disabled fields are filtered, and readonly fields skip validation.
- Source validation checks request ownership, value snapshot, projection
  revision, and Surface-instance lifetime before publishing errors/submission.
- Preview and generated projects use the same Prototype session reducer and
  Dataset query service. They do not maintain parallel state machines.

## 4. Validation & Error Matrix

| Trigger | Required result |
| --- | --- |
| Two `setValue` calls before a Vue render | Both changes visible in host model immediately |
| External replacement after local writes | Observe new values; clear stale errors; refresh reactions/meta |
| Stale async validation | Publish no stale errors or submit |
| Form readonly | Render no editable control; skip validation; preserve eligible submission |
| Missing default | Do not guess empty string/zero |
| Value/blur trigger with `props.onX` | Commit model/validation bookkeeping, then call listener once |
| Component interaction in design mode | Do not write or call listener; do not create forwarding payload |
| Configured listener throws/rejects | Let Vue handle it; do not create Studio diagnostic |
| Renderer unmounts with Data work pending | Cancel/stop owned work and suppress late publication |
| Prototype session initializes | Compute state projection only; run no value or UI action |
| User/result changes a declared dependency | Run the one value action in a deterministic transaction |
| Value transaction cycles | Abort all writes with `interaction_cycle` |
| User opens the same Surface twice | Create isolated `instanceId` state for each opening |
| Named result maps several fields | Commit all mappings atomically, then reevaluate |
| Semantic trigger has an action array | Reject; do not execute a chain |
| Old renderer, model mirror, event forwarding, or duplicate reducer import | Dependency/architecture gate fails |

## 5. Good / Base / Bad Cases

- Good: a shallowRef is connected once through `createConfigFormModel`.
- Good: an input commits before its host `onChange` reads the model.
- Good: a Dialog returns `saved`; caller assignments commit together and then
  its value rules settle.
- Base: a Vue reactive store implements read/write directly and the demo has no
  overlays or Dataset.
- Bad: `model.write` emits `update:modelValue` and assumes the next read sees it.
- Bad: clone listener arguments into a central event payload or Preview RPC.
- Bad: reuse current mixed reaction evaluation and execute value effects during
  initialization.
- Bad: copy the Prototype session reducer into a generated template.

## 6. Tests Required

- Runtime/Headless unit tests retain synchronous source-of-truth writes,
  external replacement, validation ownership, Data disposal, direct-listener
  ordering, exactly-once invocation, design-mode blocking, and Vue errors.
- Interaction tests prove initialization projects state without value/UI
  actions; user/result changes execute `set/copy/clear`; cycles roll back.
- Prototype Runtime tests cover repeated instances, A -> B -> A, navigate/back,
  closeCurrent/closeAll, parameters, named results, and missing instance no-op.
- Preview/Source parity compiles the same Project, executes its Vue backend and
  generated project, and compares defaults, binding, validation, state/value
  rules, Dataset views, navigation, overlays, and readonly behavior. String
  snapshots do not substitute for executed tests.

## 7. Wrong vs Correct

Wrong:

```ts
model.write = values => emit('update:modelValue', values)
emit('componentEvent', { name, args })
```

Correct:

```ts
model = createConfigFormModel(valuesRef)
// Notify only after the synchronous model commit.
```
