# ConfigForm Flow Runtime Consistency

## 1. Scope / Trigger

Apply this contract whenever a change touches the Flow IR, Core interpreter,
Workbench Preview scheduling, generated Source runtime, cancellation, value
commit, or reaction projection behavior.

The same JSON Flow model has two runtime implementations:

```text
ProjectDocument.pagesById[pageId].flows
  -> ConfigFormFlowInterpreter -> PreviewFlowCoordinator -> Workbench Preview
  -> generated flows.ts -> generated Vue page
```

The generated runtime remains self-contained, but it must implement the same
observable state machine as Core. Similar source text is not evidence of
equivalent behavior.

## 2. Signatures

```ts
ConfigFormFlowInterpreter.run(
  flow: ConfigFormFlow,
  options?: ConfigFormFlowRunOptions,
): Promise<ConfigFormFlowRunResult>

PreviewFlowCoordinator.dispatch(
  input: PreviewFlowDispatchInput,
): Promise<PreviewFlowDispatchResult>

runFlows(
  trigger: FlowTrigger,
  input?: FlowValues,
  signal?: AbortSignal,
): Promise<FlowDispatchResult>

applyFlowValuePatch(
  target: FlowValues,
  before: FlowValues,
  after: FlowValues,
): void
```

Core execution statuses are `success`, `end`, `ignored`, `aborted`,
`failure`, and `timeout`. Preview/generated dispatch may additionally return
`committed` and `noop`.

## 3. Contracts

- `ProjectPage.flows` is persistent and page-local. Its trigger field references,
  model order, and Flow ID uniqueness are resolved within that owning page.
  `PageGraph` owns only visual nodes and placement; it must not own Flow state.
  `LowCodePageModel.flows` is only a legacy ingress/export projection. Active runs, queues, signals,
  outputs, projections, and traces are transient runtime state.
- Workbench event execution is owned by one page-scoped Flow Engine, not by the
  shell/controller. The engine owns the injected action Registry, active
  execution plans, scheduler, projection retention, trace/error boundary, and
  a stale generation. Preview values remain Preview-session state and cross
  the engine through explicit read/write ports so a Flow-owned patch is
  applied to the latest values.
- Workbench component-event authoring has one normal entry: the Inspector lists
  events from the selected node's Registry contract and opens the Flow dialog
  with that exact `{ nodeId, event }` trigger. If a matching Flow exists it is
  selected; otherwise creation starts from that event source. The legacy
  comma-separated `node.events` action editor is compatibility-only and must
  not be exposed beside Flow in the Workbench.
- Replacing the owning project/page clears all retained Flow projections and
  invalidates pending work. Updating the same page prunes projections for
  removed Flow IDs while retaining the last successful projection of active
  Flows. A late run from an earlier engine generation must settle stale and
  cannot write values or projections.
- A `ConfigFormFlow` must not also be stored at ProjectDocument root. Future
  cross-page automation uses a distinct Project Workflow contract so page
  triggers and field references do not acquire ambiguous scope.
- Concurrency is owned by Flow ID. Never add a global trigger revision that
  converts every Flow into `latest` behavior.
- `latest` aborts only the previous run with the same Flow ID. A run must settle
  as `aborted` even when an action ignores its `AbortSignal`.
- `queue` executes in trigger order. An externally aborted queued item settles
  immediately and is removed before the active item completes.
- `ignore` preserves the active run. The ignored trigger publishes no values,
  empty projection, or error.
- A page/model/lifecycle signal invalidates active and queued work. Listener,
  timer, and child-controller cleanup occurs on every terminal path.
- `page.mount` belongs to a mounted Runtime session, not to a document revision.
  Updating the RenderPlan for the same project, adapter, and page may abort stale
  asynchronous work, but must not remount the Runtime or dispatch `page.mount`
  again. Reopening Preview, switching page/project/adapter, or recovering the
  first successful Runtime mount starts a new session and dispatches it once.
- Canonical Flow plans own the Runtime listener set for `component.event`.
  The Vue backend attaches the referenced registered `nodeId + event` pairs to
  the Runtime plan; RuntimeSurface listens on the real component and emits the
  canonical Registry event name. A value-binding event and a Flow listener that
  resolve to the same Vue handler key must be installed once and emitted once.
- Runtime and generated Source install the union of a node's explicit action
  events and Canonical `flowEvents`, not every event exposed by its component
  Registry. An unreferenced registered event must not allocate a listener or
  publish a Runtime event.
- The Vue backend consumes `CanonicalNodeIR.flowEvents`; it must not walk Flow
  plans and independently rebuild the listener projection. The semantic
  compiler is the single owner of that projection.
- Action timeout uses an action-local controller. Timing out one action must
  not mark the whole Flow lifecycle signal as externally aborted.
- Matching Flows execute in model order and pass successful values to the next
  Flow in that dispatch.
- Values commit as a patch from dispatch input to dispatch result. Applying the
  patch to current UI state must preserve unrelated values changed after the
  dispatch began.
- Projection state is keyed by Flow ID. Only `success` or `end` replaces that
  Flow's last successful projection.

## 4. Validation & Error Matrix

| Condition | Execution result | Value commit | Projection commit |
| --- | --- | --- | --- |
| No Flow matches | `noop` | none | none |
| `latest` supersedes active | old `aborted`, new executes | new success only | new success only |
| `queue` trigger | executes after active | each success in order | each success in order |
| `ignore` while active | `ignored` | none | preserve previous |
| Revision/lifecycle abort | `aborted` or stale dispatch | none | none |
| Same-page RenderPlan revision | abort stale work; no new `page.mount` | preserve compatible values | preserve compatible Flow projections |
| Registered `component.event` | exact `nodeId + event` plans run | binding update happens before dispatch | successful Flow only |
| Unregistered component event | compiler diagnostic before Runtime | none | none |
| Action timeout | `timeout`, or failure edge policy | none unless terminal policy succeeds | none unless terminal policy succeeds |
| Ordinary error + `onError: end` | `end` with diagnostic | commit successful prior changes | commit Flow projection |
| Ordinary error + `onError: failure` | follow error edge or `failure` | commit only if Flow reaches success/end | same |

Invalid Flow IR must fail analysis before scheduling. Unknown action refs and
node execution failures return diagnostics; they must not leave active or
queued entries behind.

## 5. Good / Base / Bad Cases

- Good: two overlapping `latest` triggers where the first action never
  resolves; the first call still settles `aborted` and the second commits.
- Good: two matching Flows where Flow B reads Flow A's output, while an
  unrelated user edit made during execution survives the final patch.
- Base: no matching Flow returns `noop` and preserves object identity at the
  UI patch boundary.
- Bad: a global trigger counter discards an earlier `queue` result because a
  later unrelated trigger incremented the counter.
- Bad: an ignored trigger stores an empty projection and clears the active
  Flow's last successful UI state.

## 6. Tests Required

- Core unit tests: hanging action cancellation, queued abort, listener cleanup,
  timeout, `latest` / `queue` / `ignore`, and both error policies.
- Preview coordinator tests: model-order value passing, Flow-owned value patch,
  projection retention, stale revision, and no-op object identity.
- Workbench page Flow Engine tests: exact component-event dispatch, action
  Registry ownership, projection merge/prune, page-change invalidation, and
  proof that late work cannot commit through the Preview value port.
- Generated `flows.ts` executable tests: import transpiled generated code and
  run the same concurrency/error/order matrix. String containment alone is
  insufficient.
- Generated project integration: install, type-check, and build Element Plus
  and Ant Design Vue complete exports and pure Source exports.
- Browser verification: observe `page.mount`, `field.change`, and
  `form.submit` updates through the real Renderer; filter console warnings and
  errors from an operation timestamp.
- Preview lifecycle tests: a same-page revision keeps one Runtime instance and
  does not emit a second mount; closing/reopening or switching page emits one.
- Component-event tests: cover a non-binding event such as `click`, a binding
  trigger such as `update:modelValue`, handler-name normalization, and a hard
  assertion that one component emit produces one Flow dispatch.
- Provider browser tests: exercise both Element Plus and Ant Design Vue binding
  triggers plus one real non-binding event from each provider.
- Canonical Source tests: assert a referenced event is emitted into the Vue SFC
  while an unreferenced event from another registered node is absent.

## 7. Wrong vs Correct

### Wrong

```ts
const revision = ++globalTriggerRevision
const result = await runFlow(flow, snapshot)
if (revision !== globalTriggerRevision)
  return
model.value = result.values

// Also wrong: coupling Runtime identity to every edit revision.
<RuntimeSurface :key="editVersion" />
runTrigger({ kind: 'page.mount' })
```

This overrides per-Flow concurrency and replaces unrelated newer UI values.

### Correct

```ts
const result = await coordinator.dispatch({
  flows,
  trigger,
  values: snapshot,
  signal: lifecycle.signal,
  revision: modelRevision,
})

if (result.status === 'committed')
  model.value = applyPreviewFlowValuePatch(model.value, result.valuePatch)

// Runtime identity follows the mounted page session; revision stays a stale-work key.
<RuntimeSurface :key="runtimeSessionKey" />
onRuntimeMounted(() => runTrigger({ kind: 'page.mount' }))
```

The coordinator delegates concurrency to the Flow-ID scheduler and returns
only Flow-owned changes.
