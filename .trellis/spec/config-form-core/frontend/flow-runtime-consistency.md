# ConfigForm Flow Runtime Consistency

## 1. Scope / Trigger

Apply this contract whenever a change touches the Flow IR, Core interpreter,
Workbench Preview scheduling, generated Source runtime, cancellation, value
commit, or reaction projection behavior.

The same JSON Flow model has two runtime implementations:

```text
LowCodePageModel.flows
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

- `LowCodePageModel.flows` is persistent. Active runs, queues, signals,
  outputs, projections, and traces are transient runtime state.
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
- Generated `flows.ts` executable tests: import transpiled generated code and
  run the same concurrency/error/order matrix. String containment alone is
  insufficient.
- Generated project integration: install, type-check, and build Element Plus
  and Ant Design Vue complete exports and pure Source exports.
- Browser verification: observe `page.mount`, `field.change`, and
  `form.submit` updates through the real Renderer; filter console warnings and
  errors from an operation timestamp.

## 7. Wrong vs Correct

### Wrong

```ts
const revision = ++globalTriggerRevision
const result = await runFlow(flow, snapshot)
if (revision !== globalTriggerRevision)
  return
model.value = result.values
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
```

The coordinator delegates concurrency to the Flow-ID scheduler and returns
only Flow-owned changes.
