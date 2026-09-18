# ConfigForm Product Boundaries

## 1. Scope / Trigger

This contract applies to every package and application under `packages/ConfigForm/`.
Read it before changing public props/emits, persisted Model shapes, Registry
contracts, Canonical IR, generated Source, Preview transport, Designer sections,
or package dependencies.

ConfigForm is Runtime-first. Runtime is the product, Designer is an optional
lightweight Schema editor, and Workbench is an internal Preview/Source integration
application. Complex business logic belongs to host Vue/TypeScript code.

## 2. Signatures

Runtime component listeners are ordinary Vue props on an in-memory config:

```ts
defineField({
  id: 'save',
  component: 'ElButton',
  props: {
    onClick: () => saveDraft(),
  },
})
```

The stable form-level host surface remains explicit:

```ts
type ConfigFormHostEmit =
  | 'change'
  | 'fieldChange'
  | 'metaChange'
  | 'errorsChange'
  | 'error'
  | 'submit'
  | 'variablesChange'
  | 'dataSourceStateChange'

interface ConfigFormHostExpose {
  getValues(): ConfigFormValues
  setValue(field: string, value: unknown): void
  setValues(values: ConfigFormValues): void
  validate(): Promise<ConfigFormValidationResult>
  resetFields(): void
  submit(): Promise<ConfigFormSubmitResult>
}
```

Designer has exactly two default Inspector sections:

```ts
type DesignerInspectorSection = 'properties' | 'validation'
```

The package dependency direction is:

```text
Model -> Compiler -> Canonical IR -> Vue Backend -> Runtime
  ^                                                  ^
  |                                                  |
Designer                                      host Vue/TypeScript

Core <- Headless <- Runtime <- UI adapters
                    ^
                    |
             Designer / Workbench composition
```

## 3. Contracts

### 3.1 Runtime and host code

- `props.onX` functions exist only in the host's in-memory Runtime config. The
  Renderer passes them directly to the resolved Vue component.
- For a field value or blur trigger, Runtime completes binding, model write, and
  validation bookkeeping before invoking the configured `props.onX` listener.
- Design mode blocks component interaction inside the Renderer before either
  internal binding work or the host listener runs. It does not create an event
  payload for Designer.
- Listener errors follow normal Vue error handling. Runtime does not translate
  them into scheduler diagnostics or an event-domain result type.
- Form emits/expose and Headless controller lifecycle are host APIs, not an
  event-authoring model.

### 3.2 Forbidden event domain

- Production code must not define event editing, event forwarding, event
  orchestration, an action registry, a handler registry, a component event bus,
  a Flow scheduler, or a renamed equivalent.
- Public contracts must not expose `runtimeEvent`, `componentEvent`,
  `forwardEvents`, `onRuntimeEvent`, `eventNames`, `flowActions`, `flowResult`,
  `flowError`, `flowTrace`, `ConfigFormRuntimeEventContext`, or
  `ConfigFormFlow*`.
- Model nodes do not store action-oriented `events`; project pages do not store
  `flows`; Registry component contracts and Designer materials do not declare
  event-authoring metadata. Runtime value bindings retain `trigger`,
  `blurTrigger`, and `getValueFromEvent` because those fields implement model
  binding rather than event orchestration.
- Do not retain compatibility aliases, deprecated exports, hidden feature flags,
  empty packages, dormant adapters, migration readers, or dual-shape unions for
  the removed event domain.

### 3.3 Serialization and compilation

- ProjectDocument, PageGraph, Registry snapshots, JSON import/export, IndexedDB,
  Canonical IR, Preview transport, and Source generation accept only JSON-safe
  current-contract data. They never store, clone, compare, or transmit functions.
- Compiler and Vue backend compile structure, bindings, validation, reactions,
  data, and layout. They do not collect component event names or emit Flow plans.
- Source output contains static configuration only. It does not generate handler
  stubs, string action references, callback registries, or event metadata.
- Preview cannot reproduce host listeners that were not injected by host code.
  This is a deliberate boundary and must not be bypassed with iframe RPC.

### 3.4 Designer Lite

- The default Inspector exposes only `properties` and `validation`.
- `properties` may edit field identity/label, static component props, default
  value, static options, span, and form layout. `validation` may create only
  synchronous deterministic base rules and `validateOn`.
- Default material setters use one Registry-owned path allowlist. They must not
  write `events`, `bindings`, `conditions`, `reactions`, `optionSource`,
  `valueScope`, or `extensions`.
- Programmatic advanced validation, conditions, reactions, Data Source,
  optionSource, valueScope, and bindings remain Runtime inputs. Designer may
  project them read-only and must preserve them during ordinary edits, but it
  does not provide authoring UI for them.
- A custom property control is still limited to its declared local property path;
  it is not an arbitrary ProjectDocument mutation escape hatch.

### 3.5 Package ownership and future extension

- Core, Headless, and Runtime never depend on Designer or Workbench. Designer
  never depends on Workbench or owns business side effects. Workbench is a
  private composition root.
- Data Source HTTP contracts, clone helpers, value context, lifecycle, and
  cancellation use Data/value-reference names and ownership. They must not live
  behind Flow paths or construct synthetic component/data-source events.
- A future Rules, Data, or Automation authoring product requires a new approved
  task, an independent package, explicit input/output/error/cancellation and
  lifecycle contracts, zero cost when absent, and independent tests. No placeholder
  abstraction is added before those conditions are met.

### 3.6 Current-contract-only versioning

- Writers and readers switch atomically to the current PageGraph,
  ProjectDocument, Registry snapshot, Canonical IR, Compiler, entity/transfer,
  Runtime Host, and Source generator versions.
- Lower, higher, missing, malformed, or mixed versions fail closed. Do not
  migrate, repair, infer, or silently strip removed fields.
- A published pre-1.0 package that removes public API receives a minor Changeset.
  Dependent adapters/plugins/devtools ship in the same release and require the
  new peer minor; old/new union peer ranges are forbidden.

## 4. Validation & Error Matrix

| Condition | Required result |
| --- | --- |
| Runtime field contains `props.onClick` | Pass the function directly to the resolved component and invoke it once outside design mode |
| Value/blur trigger also has a host listener | Complete model/validation bookkeeping first, then invoke the listener once |
| Component interaction occurs in design mode | Block internally; do not call the listener or emit/forward an event payload |
| Function reaches a serialized boundary | Reject as non-JSON data; do not stringify, clone, or replace it with a token |
| Current document contains removed `events`/`flows` shape | Reject the document as non-current; do not migrate or ignore the fields |
| Material setter targets a non-allowlisted root | Reject material registration or setter compilation before editing |
| Basic validation edit sees advanced rules | Preserve the opaque advanced rules and edit only the supported base subset |
| Preview lacks a host-only listener | Render the static config without inventing a forwarding RPC |
| Runtime/Core/Headless imports Designer/Workbench | Fail the architecture gate |
| New Automation proposal has no independent contract/package | Keep the logic in host code and do not add a placeholder |

## 5. Good / Base / Bad Cases

- Good: a generated static config is imported by a host module, augmented with
  typed `props.onX` functions, and passed to Runtime.
- Good: Designer edits a label while preserving code-authored reactions and
  advanced validation it does not expose.
- Base: a fully serializable form uses no host component listeners and previews
  identically in Workbench and the consuming application.
- Bad: Preview serializes listener names and forwards component arguments to a
  parent action registry.
- Bad: rename `runtimeEvent` to `hostEvent` while preserving the same central bus.
- Bad: leave deleted Flow exports as deprecated aliases for a future package.

## 6. Tests Required

- Runtime tests prove binding/validation-before-listener ordering, exactly-once
  invocation, design-mode blocking, and normal Vue error behavior.
- Model/Registry tests accept only the current no-events/no-flows shapes and
  reject old, future, missing, malformed, and mixed versions.
- Compiler/Vue backend tests prove Canonical and Runtime plans contain no event
  collection or Flow plan while bindings, reactions, validation, data, and layout
  remain intact.
- Designer and both provider-adapter tests prove exactly two Inspector sections,
  setter allowlist enforcement, base validation authoring, static options, and
  preservation of opaque advanced configuration.
- Workbench tests prove Preview and generated Source still execute static Runtime
  behavior and Data Source integration without event RPC, action RPC, Flow UI, or
  handler generation.
- Architecture searches reject removed symbols/paths and `@vue-flow/core`.
  Package tests, typechecks, builds, template verification, release checks, and
  the hand-written Changeset gate must pass for the complete package family.

## 7. Wrong vs Correct

Wrong:

```ts
emit('runtimeEvent', { nodeId, name: 'click', args })
dispatchRegisteredAction('save')
```

Correct:

```ts
defineField({
  id: 'save',
  component: 'ElButton',
  props: { onClick: saveDraft },
})
```

Wrong:

```ts
if (document.version < CURRENT_VERSION)
  return migrateAndDropFlows(document)
```

Correct:

```ts
if (document.version !== CURRENT_VERSION)
  return unsupportedVersion(document.version)
```
