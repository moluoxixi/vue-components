# ConfigForm Event Runtime Contract

## 1. Scope / Trigger

Apply when changing event binding, Flow execution, iframe transport, public forms,
preview state, action configuration, or standalone Source generation.

## 2. Signatures

```ts
CONFIG_FORM_FLOW_VERSION = 1
CONFIG_FORM_FLOW_RUNTIME_VERSION = 2
RUNTIME_HOST_PROTOCOL_VERSION = 4

createConfigFormEventRuntime({
  actions, readValues, writeValues, onProjection, onTrace, onDiagnostic,
})
runtime.sync(plans, { reset })
runtime.dispatch({ trigger, event, revision, signal, isCurrent })
runtime.dispose()

ConfigFormFlowEvent = { trigger, args: ConfigFormJsonValue[], field?: string }
ConfigFormFlowActionContext = {
  flow, node, revision, runId, signal, values, outputs, event, form,
}
// form exposes getValue/getValues/setValue/setValues; writes remain run-local.

ConfigFormRenderer({ model, fields, flows?, flowActions? })
// Notifications: runtimeEvent, flowResult, flowError
// Explicit host subscriptions: node.eventNames
```

## 3. Contracts

- Core owns the sole event scheduler and interpreter. Workbench PageFlowEngine
  adapts it to Vue refs and Preview value ports. The old PreviewFlowCoordinator
  implementation is removed.
- Compiler packages actual Core flow/expression/reaction/json TypeScript source
  through getConfigFormRuntimeSources. Source exports those modules under
  src/runtime and generates a per-instance createPageEventRuntime adapter.
  Generated pages have no ConfigForm package dependency. Do not write another
  scheduler, expression evaluator, or reaction reducer into a template string.
- Each mounted form or page owns its own runtime. Never keep action registries,
  queues, projections, or model ports in a generated module singleton.
- ProjectPage.flows remains the persisted page-local authoring graph. Running
  values, outputs, trace and signals never enter ProjectDocument/history.
- Component event names come from Registry metadata. Compiler owns the canonical
  listener projection. Vue backend maps it to node.eventNames; Renderer unions
  those names with subscriptions from its flows prop. No DOM discovery or
  private mx.low-code.flowEvents lookup is allowed.
- Node events containing registered action lists compile to the same Flow plans.
  Authored flows run first in model order, followed by node action plans. They
  must not be executed again by a separate Source event handler.
- One normalized Vue event key owns one listener channel. Design interception
  runs first, then internal value/validation bookkeeping, configured listeners,
  and one canonical runtimeEvent. Configured listener rejection is reported
  through flowError and cannot suppress value updates or subscribed execution.
- iframe events carry nodeId, event, args, optional field, and the synchronous
  values snapshot. The existing origin/source/session/revision/sequence checks
  remain mandatory. Preview installs payload.values before dispatch.
- Native event arguments remain local. snapshotConfigFormEventArgs produces
  JSON data, including selected DOM event fields and primitive target
  value/checked/name. Dates become ISO strings, undefined becomes null.
  Functions, cycles, unsupported objects, unsafe keys, depth > 32 or > 10000
  entries fail with diagnostics. Receiver validates JSON data without rebuilding
  or guessing missing arguments.
- Actions use explicit $field, $event (e.g. args.0), $output or $expression
  references. Expressions can read $event and $outputs. Missing event/output
  references and invalid expressions produce failures, not silent undefined.
- Action values/outputs/event and resolved inputs are defensive copies.
  context.form writes only the current run. Successful/end runs commit a patch
  against latest values, preserving unrelated concurrent user edits.
- Queue inputs read current form values when execution starts, while event args
  remain the captured event snapshot. Commit completes before the next queued
  item starts.
- latest, queue and ignore are scoped by Flow ID. latest settles the superseded
  action even if it ignores its signal; ignore preserves the previous projection.
- sync/clear/dispose abort active and queued work. Changed page resets retained
  projections; same-page sync prunes removed Flow IDs. A stale result cannot
  commit or notify an unmounted Renderer.
- page.mount belongs to mounted session identity, not document revision.
- Conditions have exactly one true and false outlet. Other non-terminal nodes
  require one next outlet; each allowed outlet has at most one edge. Terminals
  have no outgoing edges, triggers no incoming edges. The graph is acyclic and
  every node is reachable.
- Error edges run under the default failure policy. Explicit onError:end commits
  completed work while retaining the diagnostic. Timeout uses an action-local
  AbortController. Validation failure never dispatches form.submit.
- Designer opens from a concrete Inspector/Form event. All accepted edits remain
  Project Commands and use existing undo/redo. Action inputs use Element Plus
  controls; advanced JSON drafts preserve syntax errors across node selection.
  New flows default to failure policy and a 10000ms timeout.

## 4. Validation & Error Matrix

| Condition | Result |
| --- | --- |
| No matching plan | noop, no values/projection mutation |
| Superseded latest | old aborted, new executes |
| Queue | event order, live values at actual start |
| Ignore during active run | ignored, preserve prior projection |
| Runtime sync/dispose | pending work settles stale/aborted, no late commit |
| Missing event/output or invalid expression | failure diagnostic |
| Invalid iframe arguments | reject before dispatch |
| Duplicate graph outlet | FLOW_EXIT_DUPLICATE |
| Illegal outlet/terminal edge | FLOW_EXIT_INVALID |
| Explicit failure terminal | FLOW_TERMINAL_FAILURE |
| Rejected configured Vue listener | FLOW_COMPONENT_LISTENER_ERROR |
| Timeout | timeout or declared error branch |
| Invalid form submit | field errors, no submit Flow |

## 5. Good / Base / Bad

Good: two queued increments observe count 0 then 1 and commit 2, while a newer
unrelated note survives. Base: an unconfigured event allocates no subscription.
Bad: a global trigger counter cancels unrelated flows; Source owns duplicate
execution code; iframe drops event arguments.

## 6. Tests Required

- Core event-runtime and flow tests: event snapshot, form API isolation, queue
  commit ordering, hanging cancellation, latest/ignore, timeout and failure edges.
- Renderer events tests: binding before callback, full multi-argument payload,
  one dispatch when binding and blur share a key, design suppression, rejected
  listener diagnostics, no notification after unmount.
- Workbench engine/preview/protocol tests: value snapshot before dispatch,
  generation cancellation, projection retention, wrong identity and malformed args.
- Generated-runtime-module tests execute the exported source import closure.
  Flow and field-runtime parity tests exercise behavior, not only source strings.
- Both Element Plus and Ant Design Vue standalone projects install, type-check,
  and build. Browser tests cover both binding and non-binding events, form
  submission, undo/redo, responsive controls and axe.

## 7. Wrong vs Correct

Wrong: serialize a DOM Event across iframe, drop args, then run a hand-written
export interpreter.

Correct:

```ts
const trigger = { kind: 'component.event', nodeId, event }
await runtime.dispatch({
  trigger,
  event: { trigger, args: snapshotConfigFormEventArgs(args), field },
  signal: lifetime.signal,
})
```
