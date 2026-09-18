# ConfigForm Runtime State Boundaries

## 1. Scope / Trigger

Apply to Headless, ConfigForm preprocessing, Renderer, Designer Host integration, validation, Data lifecycle, component listeners, and generated Source. These are the current pre-release contracts; no alternate state machine or legacy aliases are supported.

## 2. Signatures

```ts
createConfigFormModel(source: Ref<TValues>): ConfigFormModelAdapter<TValues>
ConfigFormModelAdapter = { read: () => TValues; write: (values: TValues) => void }
ConfigFormRenderer({ model, fields })
ConfigForm({ model, fields, runtime? })
createComponentListenerService({ mode })
useRendererDataLifecycle({ props, emit, controller })
```

## 3. Contracts

- The host model port is the sole value source. Renderer read must access Vue reactive state and write must synchronously commit before returning. Renderer must not mirror values or use an asynchronous v-model echo as its store.
- Renderer watches external model replacement synchronously, clearing stale validation and recomputing reactions/meta. A try/finally write guard suppresses only the synchronous watch during its own commit; it never survives a write call.
- Meta owns touched state; validation owns errors, request IDs and value revisions. Late results cannot overwrite newer values.
- Programmatic reaction state enters Headless field-state resolution for validation and submission. State changes and Renderer unmount invalidate pending validation.
- ConfigForm preprocesses plugins/registrations/readonly adapters into Renderer nodes. Removed RecursiveField, FormContext and useForm state/queue services must not return.
- Plugins receive complete nested slots. Resolve the tree once, then attach readonly adapters using the resolved nodes including their slots; projection must not run hooks twice.
- Core owns validateOn normalization and responsive layout. Compiler emits normalized validateOn arrays in CanonicalFieldDescriptor; Vue and Source consume them.
- Component listeners are ordinary host `props.onX` functions. The Renderer composes internal value/blur listeners before configured host listeners and invokes each exactly once. Design mode blocks both groups inside the Renderer; it does not emit or forward a component-event payload.
- ConfigFormRenderer and ConfigForm do not accept action/event-forwarding props and do not publish scheduler result/error/trace notifications. A configured listener failure follows Vue's normal error handling after internal binding work has completed.
- Data Source `prepare/start/refresh/reset/cancelScope/stop` lifecycle belongs to the Data runtime composable and ordinary form lifecycle. It never constructs a synthetic component or Data Source event. Unmount stops Data work, disposes the controller, and suppresses late publication.
- Designer Canvas receives a required runtime/dragVisual host integration. It does not compile Vue plans or render production controls. Inspector renderer is explicitly injected by the host.
- Source defaults come only from Canonical fields. Missing defaults stay absent, bindings do not guess alternate keys, form readonly dominates field state, hidden/disabled fields are filtered, and readonly fields skip validation.
- Source validation checks request ownership, value snapshot, projection revision and page lifetime before publishing errors or a submission.

## 4. Validation & Error Matrix

| Trigger | Required result |
| --- | --- |
| Two setValue calls before a Vue render | Both changes visible in host model immediately |
| External replacement after local writes | New values observed, old errors cleared, reactions/meta refreshed |
| Stale async validation | No stale errors or submit |
| Form readonly | No editable control; skip validation, preserve eligible submission |
| Missing default | No guessed empty string/zero |
| Value/blur trigger with `props.onX` | Commit model/validation bookkeeping first, then call the host listener once |
| Component interaction in design mode | Do not write values or invoke the host listener; do not create a forwarding payload |
| Configured listener throws/rejects | Let Vue handle the error; do not translate it into a scheduler diagnostic |
| Renderer unmounts with Data work pending | Cancel/stop owned Data work and suppress late state publication |
| Old renderer or model mirror import | Dependency/architecture gate fails |

## 5. Good / Base / Bad Cases

Good: a shallowRef connected once through createConfigFormModel.
Base: a Vue reactive store implements read/write directly.
Bad: write emits update:modelValue and assumes the next read sees that event.

Good: an input binding commits the new value before its host `onChange` listener reads the model.
Bad: clone listener arguments into a central event payload or route them through Designer/Preview.

## 6. Tests Required

Run Runtime/Headless unit tests, provider tests, public declaration smoke, Compiler full/incremental tests, and Workbench E2E. `component-listeners.test.ts` proves ordering, exactly-once invocation, design-mode blocking, plain listeners, and Vue error handling. `preview-source-parity.test.ts` compiles the same Project, mounts its Vue backend and generated Page, and compares executed defaults/binding/validation/reaction/data/readonly behavior. String snapshots do not substitute for these tests.

## 7. Wrong vs Correct

Wrong: model.write = values => emit('update:modelValue', values).
Correct: model = createConfigFormModel(valuesRef); notifications use change events after commit.
