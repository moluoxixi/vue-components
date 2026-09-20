# ConfigForm Product Boundaries

## 1. Scope / Trigger

This contract applies to every package and application under
`packages/ConfigForm/`. Read it before changing public props/emits, persisted
Model shapes, Registry contracts, Canonical IR, generated Source, Preview
transport, Designer sections, Studio assets, or package dependencies.

The target product is ConfigForm Studio: a local-first authoring application for
high-fidelity business-interface demos with no real API calls. Runtime remains
the production form foundation. Studio owns UI, layout, validation, mock data,
and deterministic local interaction; engineers own HTTP, authentication,
asynchronous side effects, and business functions in exported or host
Vue/TypeScript code.

Status must always be explicit. The Studio authoring chain is current:
ProjectDocument, Compiler, persistence, Runtime Host, and Source use
Page/Dialog/Drawer Surface assets; `@moluoxixi/config-form-prototype-runtime`
and `@moluoxixi/config-form-source` are importable; Studio manages projects,
Datasets, Resources, theme, Design/Experience, and export. Designer exposes
Properties, Validation, and Interactions sections, including current
Dataset/Resource bindings and closed Prototype Interaction authoring.

The exact target domain shapes, versions, diagnostics, and tests are owned by
[Studio Domain Contracts](./studio-domain-contracts.md).

## 2. Signatures

Runtime component listeners remain ordinary Vue props on an in-memory config:

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

The target dependency direction is:

```text
Core <- Headless <- Runtime <- UI adapters

Model -> Compiler -> Canonical IR -> Vue Backend -> Runtime
  ^                                      |
  |                                      v
Designer                         Prototype Runtime
  ^                                      ^
  |                                      |
Studio ----------------------------------+
  |
  +---- provider/resource adapters ----> Source generator / viewer
```

## 3. Contracts

### 3.1 Two delivery paths

- Runtime is the production execution foundation. Engineers may construct
  in-memory configs directly and attach typed Vue functions.
- Studio is the demo-authoring product. Its persisted output is JSON-safe and
  demonstrates local UI behavior without HTTP or host functions.
- Source is a one-way handoff from Studio to runnable Vue/TypeScript. Edited
  source is not imported back into Designer.
- The default handoff is `RawSourceFileSetV1`: readable Vue, Vue Router, and
  target UI-library source with no ConfigForm dependency. The optional
  `ConfigBindingFileSetV1` contains public ConfigForm binding configuration only.
- Designer edits one current Surface in the target architecture. Studio owns
  project assets, persistence, Design/Experience switching, and host commands.

### 3.2 Runtime and host functions

- `props.onX` functions exist only in the host's in-memory Runtime config. The
  Renderer passes them directly to the resolved Vue component.
- For a field value or blur trigger, Runtime completes binding, model write,
  and validation bookkeeping before invoking the configured listener once.
- Design mode blocks component interaction inside the Renderer before internal
  binding work or the host listener runs. It does not create an event payload.
- Listener failures follow normal Vue error handling. Runtime does not translate
  them into Studio diagnostics or an action result.
- `props.onX` is never serialized, converted into Prototype Interaction, or
  forwarded through Preview RPC. Form emits/expose remain host APIs.

### 3.3 Forbidden event domain

- Production code must not define event editing, raw event forwarding, event
  orchestration, an action or handler registry, a component event bus, an
  action chain, a Flow scheduler, or a renamed equivalent.
- Public contracts must not expose `runtimeEvent`, `componentEvent`,
  `forwardEvents`, `onRuntimeEvent`, `eventNames`, `flowActions`, `flowResult`,
  `flowError`, `flowTrace`, `ConfigFormRuntimeEventContext`, or
  `ConfigFormFlow*`.
- Model nodes do not store action-oriented `events`; projects do not store
  `flows`; Registry components and Designer materials do not declare arbitrary
  DOM event metadata. Runtime `trigger`, `blurTrigger`, and
  `getValueFromEvent` remain value-binding fields, not authoring triggers.
- Prototype Interaction is not an event-domain alias. It is a closed union of
  state projection, one change-triggered value action, and one primary UI
  action per material-declared semantic trigger.
- Do not retain compatibility aliases, deprecated exports, hidden feature
  flags, empty packages, dormant adapters, migration readers, or dual shapes.

### 3.4 Studio target boundary

- Project assets are Page, Dialog, Drawer, Dataset, and static Resource.
  Page/Dialog/Drawer are `SurfaceAsset`; each Experience opening creates an
  isolated `SurfaceInstance`. Material and Surface identities never overlap.
- Studio supports responsive Grid/Flex, controlled visual properties,
  field-level `required` / `requiredMessage`, RuleSet v2 general validation,
  static Dataset views, and safe expressions. Dynamic `required` projection
  overrides the static field baseline for the current instance; Required is not
  a general RuleSet kind.
- RuleSet v2 has no time base. Time Materials expose field Required and
  `validateOn` but no general RuleSet editor; they are never treated as dates.
  When inline Select options change, an existing enum/literal base and any
  invalid default are reconciled in the same command and Undo step; an
  unrepresentable base clears the complete validation.
- Studio does not support arbitrary CSS, arbitrary JavaScript, absolute-position
  free canvas, HTTP, authentication, delays, retries, parallel actions, or
  business-function authoring.
- User actions may create any finite overlay depth and may open A -> B -> A.
  Automatic opening during session/project initialization is forbidden.
- Dataset is a project-level, runtime-readonly JSON-object array. Runtime Data
  Source remains an engineer-authored production capability and is removed
  from the target Studio authoring experience. Their types are not reused.

### 3.5 Serialization, Preview, and Source

- ProjectDocument, SurfaceGraph, Project/Dataset/Resource envelopes, Registry
  snapshots, JSON import/export, IndexedDB, Canonical IR, Preview transport,
  Prototype session, and Source generation accept only JSON-safe current-
  contract data. ProjectDocument stores Resource metadata; Project transfer
  carries embedded bytes so full project JSON is lossless.
- Preview consumes Prototype Runtime. Raw generated projects preserve the same
  observable local navigation, overlay, Dataset, validation, and accepted
  interaction behavior as readable application code; source inputs that require
  an unavailable address-scoped runtime fail closed instead of flattening
  row-local state. They do not import or copy the Prototype Runtime, a session
  reducer, or a generic execution core.
- Source does not emit HTTP placeholders, handler stubs, string action refs,
  event metadata, or Flow plans. It preserves complete local demo behavior for
  accepted Source inputs.
- Neither file-set kind contains a copied session/reducer/overlay execution
  core. ConfigForm bindings contain public configuration and thin Surface
  wrappers, not an embedded ConfigForm implementation.
- Raw Vue `package.json.dependencies` and application runtime bare-package
  imports are limited to Vue, Vue Router, and the selected target UI package. They contain
  no ConfigForm, Zod,
  `@moluoxixi/*`, `@config-form/*`, Compiler, RuleSet converter, or internal
  Runtime; build-only Vite/TypeScript tooling may remain in `devDependencies`.
  Required and RuleSet v2 compile to readable project-local validation.
- The Source package owns three separate input responsibilities: the
  provider-neutral component resolver, the ConfigForm-only binding resolver,
  and the async embedded-resource reader. Studio reads adapter metadata and
  Repository content and injects all three implementations at its composition
  root. Raw receives no binding resolver. URL Resources do not invoke the
  reader or a network fetch.
- Raw Vue and ConfigForm binding generation run and fail independently against
  one pinned compilation. Workbench represents each mode as `ready | failed`;
  one mode's diagnostics disable only that mode's file/copy/download commands
  and never discard the sibling mode's successful file set.
- The Source Viewer owns file-tree/code presentation only. Studio owns dialogs,
  regeneration, clipboard, downloads, ZIP, notifications, and persistence.

### 3.6 Package ownership

- Core, Headless, and production Runtime never depend on Designer, Studio,
  Workbench, Prototype Runtime, or Source.
- Designer does not depend on Studio, Workbench, Source, or a concrete runtime
  adapter, and does not own business side effects.
- `@moluoxixi/config-form-prototype-runtime` exposes DOM-free root and
  `/session` entries; Vue Surface/overlay ownership is isolated in `/vue` and
  `/vue/style`. Studio Experience consumes it; generated output neither imports
  nor copies it.
- Source generator does not import Designer, Workbench, concrete provider UI,
  Repository, Monaco, Vue DOM, or browser globals. Viewer dependencies stay
  under `/viewer`.
- Studio/Workbench is the private composition root and may depend on public
  authoring, compilation, runtime, Prototype Runtime, and Source packages.

### 3.7 Current-contract-only versioning

- Writers and readers switch atomically to the target versions assigned in the
  Studio domain contract. A Reader accepts exactly one current shape.
- Lower, higher, missing, malformed, or mixed versions fail closed. Do not
  migrate, repair, infer, or silently strip fields.
- Removing `pagesById/pageOrder`, old event shapes, or old export entries does
  not permit a compatibility reader, alias, deprecated wrapper, or union peer
  range.
- Explicit Dataset raw-row ingestion is a create command that accepts a JSON
  object array. It is not a version-reader fallback; the versioned Dataset
  envelope reader must reject that same unversioned array.
- A pre-1.0 package that removes public API receives a minor Changeset. All
  dependent packages ship together and require the new peer minor.

## 4. Validation & Error Matrix

| Condition | Required result |
| --- | --- |
| Runtime field contains `props.onClick` | Pass the function directly to the resolved component and invoke it once outside design mode |
| Value/blur trigger also has a host listener | Complete model/validation bookkeeping first, then invoke the listener once |
| Component interaction occurs in design mode | Block internally; do not call the listener or forward an event payload |
| Function reaches a serialized boundary | Reject as non-JSON data; never replace it with a token |
| Studio author requests HTTP or an arbitrary function | Keep it in exported/host code; do not add a placeholder action |
| Material declares an arbitrary DOM event trigger | Reject registration; semantic triggers are allowlisted capabilities |
| A semantic trigger has two primary UI actions | Reject the binding; do not execute a chain |
| Preview lacks a host-only listener | Run the JSON-safe demo without inventing iframe forwarding |
| RuleSet v1 or `kind: 'required'` reaches a current Reader | Reject it; do not migrate Required into the field contract |
| Time Material requests a RuleSet/date base | Reject or omit the general validation capability; preserve Required and `validateOn` |
| Select options invalidate a default and enum/literal base | Reconcile options, default, and validation in one command/history item; one Undo restores all |
| Raw generation fails while ConfigForm binding succeeds, or vice versa | Preserve the successful mode and report failure only for the affected mode |
| Raw runtime dependency/import exceeds the Vue/Vue Router/target-UI whitelist | Fail generation or generated-consumer architecture; do not install an internal package; allow build-only devDependencies |
| Dataset envelope reader receives raw rows | Reject as missing version; raw ingestion must be called explicitly |
| Runtime/Core/Headless imports an outward package | Fail the architecture gate |
| Planned package has no implementation | Document it as target only; do not create a manifest or import example |

## 5. Good / Base / Bad Cases

- Good: Studio opens a Dialog Surface with parameters, closes it with a named
  result, atomically maps the result into the caller, then reevaluates value and
  state rules.
- Good: generated static config is augmented by typed `props.onX` functions in
  host code and passed to production Runtime.
- Good: a field stores static Required separately from RuleSet v2, Raw emits a
  local validator, and a dynamic Required projection overrides the baseline in
  Experience without rewriting the field.
- Good: an options component reads a shared Dataset projection while its
  selection remains component/form state.
- Good: a Select options edit updates its enum/literal base and invalid default
  atomically; a time field offers Required without pretending to be a date.
- Base: a JSON-safe Page demo has no overlays or host listeners and behaves the
  same in Experience and generated source.
- Bad: serialize listener names and forward component arguments to an action
  registry in Preview.
- Bad: rename Flow to “interaction pipeline” while retaining an action array.
- Bad: accept `DatasetRow[]` in the versioned envelope Reader for convenience.
- Bad: publish options and repair validation/default in later watcher commands,
  or map time to the date base to reuse its rules.
- Bad: merge component and ConfigForm binding resolution again, import Zod into
  Raw, or make one export mode's failure suppress both modes.
- Bad: document any unimplemented package or public entry as currently
  installable.

## 6. Tests Required

- Runtime tests retain binding/validation-before-listener ordering,
  exactly-once invocation, design-mode blocking, and Vue error behavior.
- Model/Compiler/transport tests accept only current JSON-safe contracts and
  reject old, future, missing, malformed, and mixed versions, including RuleSet
  v1 and `kind: 'required'`.
- Studio contract tests reject arbitrary event metadata, functions, action
  arrays, Flow shapes, HTTP actions, and automatic initialization opens.
- Preview/generated-project parity tests execute the same Surface navigation,
  overlay, Dataset, validation, and interaction scenarios and compare observable
  behavior. String snapshots are not behavioral evidence.
- Architecture tests enforce inward dependencies, DOM-free generator/session
  imports, Viewer-only Monaco, split component/binding/resource responsibilities,
  the Raw dependency whitelist, and absence of wrappers or compatibility paths.
- Generated-consumer tests execute field Required/Required message, RuleSet v2,
  and `validateOn` for both providers from real generated files with no internal
  workspace soft links; Workbench tests cover both one-mode-failed directions.
- Designer/Model tests prove time has no RuleSet base and Select options,
  enum/literal validation, and invalid defaults share one atomic history item
  with exact one-Undo restoration.
- Package tests, typechecks, builds, generated-consumer tests, release checks,
  and handwritten Changeset gates run for the complete affected package family.

## 7. Wrong vs Correct

Wrong:

```ts
emit('runtimeEvent', { nodeId, name: 'click', args })
dispatchActions(['validate', 'save', 'navigate'])
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
if (input.version < CURRENT_VERSION)
  return migrateOrGuess(input)
```

Correct:

```ts
if (input.version !== CURRENT_VERSION)
  return unsupportedVersion(input.version)
```
