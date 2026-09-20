# ConfigForm Runtime State Boundaries

## 1. Scope / Trigger

Apply to Headless, ConfigForm preprocessing, Renderer, Studio/Designer host
integration, validation, Runtime Data lifecycle, component listeners, target
Prototype Interaction, Preview, and generated Source.

Production Runtime state and Prototype session state are separate.
Headless/Runtime continue to own form values, meta, validation, reactions, Data
Source, and direct host listeners. Prototype Runtime owns page history,
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

Current persisted interaction channels:

```ts
type PrototypeInteraction =
  | StateProjectionRule
  | ValueChangeRule
  | PrimaryUiActionBinding

reducePrototypeSession(
  session: PrototypeSessionV1,
  command: PrototypeSessionCommand,
  context: PrototypeProjectContextV1,
): PrototypeSessionResult
```

The full target shapes are owned by
[Studio Domain Contracts](./studio-domain-contracts.md).
The context is an immutable, Reader-validated projection of Surface kind,
initial values, parameters, outputs, presentation, and interactions. A host
supplies every new `instanceId`; the reducer never reads time, randomness, DOM,
Vue, Workbench state, or a mutable Registry.

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
- An HTTP result enters value resolution only as `response`: references use
  `kind: 'response'`, context uses `response`, expressions use `$response`, and
  dependency metadata uses `usesResponse`. The removed `event/$event` response
  contract fails closed; normal Vue listener `$event` remains unrelated.
- Unmount stops owned work, disposes the controller, and suppresses late
  publication.
- Target Studio Dataset is static, project-level, and runtime-readonly. It does
  not reuse Data Source requests, cache, cancellation, lifecycle, or references.

### 3.4 Prototype Interaction

- State projection continuously derives `visible`, `disabled`, `readonly`,
  `required`, and Material-allowlisted display props. It runs on initialization
  and after dependency changes and never mutates values.
- A field's persisted `required` / `requiredMessage` is its static validation
  baseline. Dynamic `required` projection overrides that baseline only for the
  current runtime instance. Required is not a RuleSet v2 descriptor, and
  `validateOn` schedules Required and general rules through the same trigger
  lifecycle without merging their stored contracts.
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
- Every overlay instance retains the exact opener interaction ID and scoped
  node address for result routing and focus restoration; one node may have many
  runtime row addresses and different `open` bindings on semantic triggers.
- Page history, overlay instances, parameters/results, and primary actions live
  in Prototype Runtime, not Headless, production Runtime, Designer, or
  iframe event forwarding.

### 3.5 Designer, Source, and validation

- Designer Canvas receives required runtime/dragVisual host integration. It does
  not compile Vue plans or render production controls. Inspector renderer is
  injected by the host.
- Source defaults come only from Canonical fields. Missing defaults remain
  absent, bindings do not guess keys, form readonly dominates field state,
  hidden/disabled fields are filtered, and readonly fields skip validation.
- `generateVueSource` and `generateConfigFormBindings` each run their own
  complete preflight before assembling their own file set. Invalid rules,
  regexes, types, or unresolved named custom validators fail that API with no
  partial file set; they do not erase a successful result from the other API.
- Raw source emits readable project-local validation functions for field-level
  Required/Required message, RuleSet v2, and `validateOn`. It imports no
  ConfigForm, Zod, RuleSet converter, Compiler, or internal Runtime; its only
  `package.json.dependencies` and application runtime bare-package imports are
  Vue, Vue Router, and the selected target UI package. Build-only Vite/TypeScript tooling
  may remain in `devDependencies`.
  Raw executes local field/Surface validation before a primary action.
- RuleSet v2 has no `time` base. Designer, Runtime, and Source run time fields
  with field Required and `validateOn` only; none coerces time into date
  validation. A Select options authoring command settles any invalid default
  and existing enum/literal base before compilation, so Runtime and Source see
  one coherent revision and never repair that relationship locally.
- ConfigForm binding output preserves field-level Required and RuleSet v2 as
  public binding configuration. Its Surface wrappers call the public form
  expose and do not receive a host-injected validation runtime or copy the
  ConfigForm execution core. Nested scoped defaults and field rendering are
  preserved, while interactions that require an unavailable address-scoped
  settlement/projection runtime fail closed rather than flattening values
  across rows.
- Preview uses the Prototype session reducer. Raw generated projects reproduce
  the same observable local behavior in readable application code without
  importing or copying that reducer; ConfigForm bindings export configuration
  only and leave application orchestration to the consuming engineer.

## 4. Validation & Error Matrix

| Trigger | Required result |
| --- | --- |
| Two `setValue` calls before a Vue render | Both changes visible in host model immediately |
| External replacement after local writes | Observe new values; clear stale errors; refresh reactions/meta |
| Stale async validation | Publish no stale errors or submit |
| Form readonly | Render no editable control; skip validation; preserve eligible submission |
| Static Required is false and dynamic projection is true | Validate as required for that instance without mutating the persisted field |
| RuleSet contains `kind: 'required'` or a non-v2 version | Reject at the owning Reader/preflight; do not convert it to the field contract |
| Time field carries a RuleSet/date base | Reject at the Registry-aware boundary; do not execute it as date validation |
| Select options edit invalidates default and enum/literal base | Publish one coherent revision after authoring reconciliation; Runtime performs no follow-up repair |
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
| Raw generation fails while Binding succeeds, or vice versa | Keep the successful file set available and report diagnostics only for the failed mode |
| Raw source imports ConfigForm, Zod, or an internal workspace package | Fail generated-consumer architecture before publication |
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
- Designer/Runtime/Source parity tests prove time fields execute Required and
  `validateOn` without date rules, and Select option edits never expose an
  intermediate revision with stale default or enum/literal validation.
- Prototype Runtime tests cover repeated instances, A -> B -> A, navigate/back,
  closeCurrent/closeAll, parameters, named results, and missing instance no-op.
- Preview/Source parity compiles the same Project, executes its Vue backend and
  generated project, and compares defaults, binding, validation, state/value
  rules, Dataset views, navigation, overlays, and readonly behavior. Behavioral
  parity does not require a shared generated runtime, and string snapshots do
  not substitute for executed tests.
- Source tests independently fail Raw and ConfigForm binding generation, assert
  the sibling result stays usable, and execute Required/Required message,
  RuleSet v2, and `validateOn` in generated consumers for both providers. Raw
  dependency scans and real installs permit only Vue, Vue Router, and the
  selected UI package and use no internal workspace soft links.

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
