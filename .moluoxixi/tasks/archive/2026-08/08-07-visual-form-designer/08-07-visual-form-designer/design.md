# 配置化表单可视化设计器 - Technical Design

## Status

Draft. Product scope is confirmed; technology choices remain subject to user review.

## Design Principles

1. The designer edits a serialization-safe authoring document, not Vue runtime objects.
2. `ConfigFormNode[]` remains the runtime contract and `ConfigFormRenderer` remains the only preview/rendering path.
3. The authoring document stays close to existing ConfigForm semantics; this is not a page-level low-code DSL.
4. Every state transition has one owner, one command path, and structured diagnostics.
5. New packages are additive and opt-in. Existing handwritten forms and public runtime entries remain valid.

## Architecture

```text
Host application
  |
  | v-model:document / registry / change events
  v
ConfigFormDesigner
  |-- palette + canvas + property panel
  |-- document command reducer + bounded history
  |-- document validator + semantic analyzer
  |
  v
compileDesignerDocument(document, registry)
  |-- material key -> Vue component
  |-- condition AST -> predicate
  |-- validation rules -> Zod schema
  |-- extension key -> registered runtime function
  v
ConfigFormNode[] + diagnostics
  |
  v
ConfigFormRenderer
```

The host owns persistence, permissions and publication. The designer owns only the controlled document, edit operations, validation, compilation and preview.

## Package Boundaries

### `@moluoxixi/zod3-to-rule`

Proposed location: `packages/zod3-to-rule`.

This is a standalone, publishable rules package. It has no Vue or designer UI dependency and owns the validation descriptor contract:

- JSON-safe `RuleSet` types and a strict parser/normalizer;
- `rulesToZod(ruleSet)` as the canonical deterministic compiler;
- `zodToRules(schema)` as a best-effort exporter for the supported Zod 3 subset;
- `RuleDiagnostic` values for unsupported Zod nodes, invalid parameters and lossy conversions;
- a versioned rules format and pure JSON migrations.

The package may contain an isolated Zod-3-specific adapter for exporter support, but private Zod internals must never leak into its public types or JSON format. The exporter must report unsupported `refine`, `superRefine`, `transform`, `preprocess`, async validators and custom closures instead of silently dropping them.

### `@moluoxixi/config-form-designer`

Proposed location: `packages/ConfigForm/designer`.

Responsibilities:

- versioned `DesignerDocument` types and document entry schema;
- document migration, normalization and semantic diagnostics;
- material/setter/extension registry contracts;
- pure document command reducer and bounded undo/redo history;
- runtime compiler;
- adapter-neutral Vue designer shell and controlled public API;
- native keyboard commands and accessible drag alternatives.

The designer consumes `@moluoxixi/zod3-to-rule` for validation setters and Zod compilation. Peers should match the current workspace contracts: Vue 3, Zod 3 and the existing ConfigForm runtime/headless packages. SortableJS is the only proposed new direct runtime dependency of this package, but it already exists in the workspace catalog and lockfile.

### `@moluoxixi/config-form-designer-element-plus`

Proposed location: `packages/ConfigForm/designer-element-plus`.

Responsibilities:

- Element Plus field and container material definitions;
- component binding metadata;
- default node factories;
- property setter definitions and option sources;
- Element Plus preview registry composition.

Element Plus and Vue remain peer dependencies and build externals, following the existing ConfigForm plugin/adapter package pattern.

### `packages/ConfigForm/playground`

The playground is the integration and E2E host. It demonstrates the designer as a controlled component, JSON round-trip and real renderer preview. It is not the source of designer domain logic.

## Authoring Contract

The exact TypeScript contract will be finalized before implementation, but the ownership and shape are:

```ts
interface DesignerDocument {
  version: 1
  form: DesignerFormSettings
  nodes: DesignerNode[]
}

type DesignerNode = DesignerFieldNode | DesignerContainerNode

interface DesignerNodeBase {
  id: string
  material: string
  props?: JsonObject
  span?: number
  conditions?: Partial<Record<DesignerConditionTarget, ConditionExpression>>
}

interface DesignerFieldNode extends DesignerNodeBase {
  kind: 'field'
  field: string
  label?: string
  defaultValue?: JsonValue
  validation?: ValidationDescriptor
}

interface DesignerContainerNode extends DesignerNodeBase {
  kind: 'container'
  slots: Record<string, DesignerNode[]>
}
```

Key rules:

- `id` is immutable designer identity. Moving a node preserves it; copying creates new IDs for the complete copied subtree.
- `field` is the business model key and must be unique among field nodes. It never identifies a canvas node.
- `material` is a registry key such as `element.input`; no Vue component object enters JSON.
- `props`, defaults and registry parameters accept JSON values only.
- finite container materials declare named drop zones; arbitrary render-function slots are not authorable in MVP.
- top-level `version` is mandatory. Migrations are adjacent pure JSON transforms executed before current-version validation.

## Conditions And Validation

### Condition AST

MVP uses a whitelist AST rather than JavaScript strings:

- literal boolean;
- field reference and JSON literal;
- `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in`, `contains`;
- `and`, `or`, `not`.

Condition targets are limited to current runtime semantics: `visible`, `hidden`, `required`, `disabled` and `readonly`. Compilation produces the predicates already accepted by `ConfigFormNode`.

### Validation Descriptor

MVP covers string, number, boolean, date and enum values plus:

- required and custom messages;
- string length, regex, email and URL;
- numeric range and integer;
- enum membership;
- basic cross-field comparison;
- `custom` registry references with JSON parameters.

The document does not store `ZodType` instances. The compiler creates Zod schemas that continue through the existing required -> Zod -> custom validator runtime path. Arbitrary refine/superRefine, preprocess, async validation and transforms use explicit registry keys; no source strings or `eval` are allowed.

## Registry Contracts

The core registry has three explicit responsibilities:

```ts
interface DesignerMaterialDefinition {
  key: string
  version: number
  kind: 'field' | 'container'
  title: string
  category: string
  icon?: Component
  createNode(context: CreateNodeContext): DesignerNode
  runtime: RuntimeMaterialBinding
  setters: PropertySetterDefinition[]
  slots?: MaterialSlotDefinition[]
}
```

- Material registry: palette metadata, default node factory, legal slots/drop rules, runtime component and binding mapping.
- Setter registry: standard boolean/text/number/select/options/condition/validation editors plus custom Vue setter components.
- Extension registry: named validators, transforms and other deliberate runtime escape hatches.

Precedence is local designer registration -> app-level registration -> adapter defaults. Duplicate keys at the same level are errors. Unknown keys produce diagnostics rather than silent fallback.

## Document State And History

The document is controlled through `v-model:document`; the component never mutates the caller's object.

All mutations use a discriminated `DesignerCommand` and one pure reducer:

```text
UI intent -> dispatch(command) -> validate command/drop target
          -> reduceDocument(current, command)
          -> semantic validation
          -> emit update:document(next)
          -> record one history entry
```

Commands cover add, move, copy, remove, update properties and replace document. The reducer prevents unknown IDs, cycles, illegal slots, duplicate IDs and duplicate field keys. Selection, hover, open panels and drag previews are ephemeral UI state and never enter the document/history.

MVP uses a bounded full-snapshot history (proposed default: 100 commands). This is simpler and more auditable than inverse patches for the expected document size. External document replacement resets the local history baseline.

## Drag And Keyboard Interaction

Use the existing `sortablejs@1.15.7` directly:

- palette: clone-only source;
- every legal container slot: an independent sortable/drop zone;
- stable `data-node-id` connects DOM feedback to document commands;
- `group.put` and `onMove` provide early feedback, while the reducer is the final integrity boundary;
- Sortable-mutated DOM is transient feedback, never the source of truth; Vue rerenders from the command result.

SortableJS does not solve keyboard accessibility. Each selected node therefore exposes explicit move before/after/into-parent commands, focus restoration and an `aria-live` result. Pointer drag and keyboard commands dispatch the same reducer actions.

Upgrade to `@vue-dnd-kit/core` only if a later requirement makes keyboard drag gestures, collision strategies or overlays first-class. Do not add a SortableJS Vue wrapper merely to mirror arrays: it does not remove tree, history or legality logic.

## UI Composition

The default workbench follows the established form-designer workflow without coupling domain logic to it:

- left: searchable, categorized material palette;
- center: bounded form canvas with explicit empty drop zones and node selection affordances;
- right: tabs for field/component properties, validation and conditions;
- top toolbar: undo, redo, preview, import and export;
- preview uses the compiled document and the real ConfigForm Element Plus renderer.

The shell is slot-extensible so host applications can replace the toolbar or panels without replacing the document engine.

### Canvas Field Layout And Selection

`DesignerFormSettings.labelPosition` is the single authoring source for field label layout. The document schema accepts `left` and `top`, the form property panel edits it, the compiler forwards it to the renderer configuration, and both the designer preview and runtime renderer apply the same two layout modes. Missing values normalize at the rendering boundary to `left` for backward compatibility.

The preview shell contributes no border, padding, minimum height or text of its own. It renders the registered Vue component in an inert subtree and uses the shell only as the selection event boundary. A selected node draws a `pointer-events: none` pseudo-element at `inset: -5px` with a dashed border, so the visual selection area does not alter SortableJS geometry. The action toolbar is absolutely positioned immediately above the pseudo-element's top-right corner. Unselected nodes have neither the pseudo-element nor a visible toolbar.

Container nodes do not receive an opaque whole-node mask because that would intercept nested field selection and drop zones. Selection event handling remains on the node shell while the decorative pseudo-element never participates in hit testing.

## Technology Decisions

| Concern | MVP choice | Reason |
|---|---|---|
| Vue integration | Vue 3.5 Composition API | Existing workspace/runtime contract |
| Drag/drop | Direct SortableJS 1.15.7 | Already cataloged, tested and sufficient for finite nested lists |
| Rules package | New `@moluoxixi/zod3-to-rule` | Reusable JSON-safe contract and Zod bridge without Vue coupling |
| Document validation | Zod 3.25.x inside designer and `zod3-to-rule` | Reuses current dependency and structured issues |
| Field validation | `zod3-to-rule` compiles descriptors to current Zod runtime contract | One runtime validation engine |
| State | Local controlled state + pure reducer | Supports multiple isolated designer instances |
| Undo/redo | Small bounded snapshot history | Explicit command boundaries; no new dependency |
| UI adapter | Element Plus first | Existing adapter and broad playground coverage |
| Unit/component tests | Vitest + happy-dom | Existing package convention |
| Browser workflow tests | Playwright in ConfigForm playground | Existing real-browser integration path |

Not selected for MVP:

- Pinia: does not provide document commands/history and would duplicate host-owned state.
- VueUse history: useful only after automatic/coalesced capture becomes a real requirement; it does not own tree commands or validity.
- Immer: introduce only if profiling proves snapshots/path-copy reducer updates are a bottleneck.
- XState: reserve for future asynchronous publication/workflow state, not synchronous document editing.
- Ajv/TypeBox/Valibot: they introduce a second validation abstraction while runtime still requires Zod.

## Existing Designer Engines

No mature engine is adopted directly:

- Formily Designable and Alibaba Lowcode Engine provide useful material/setter/plugin architecture, but their designer ecosystems are React-oriented and use different schema/runtime contracts.
- amis editor is a React page-level JSON runtime/editor and would replace rather than extend ConfigForm.
- form-create/designer is the closest Vue 3/Element Plus UX reference, but outputs its own rule format and runtime; adopting it still requires a full translation layer.
- VForm/Variant Form has restrictive/non-standard licensing signals, older dependencies and its own runtime schema.

We borrow the workbench, material metadata and setter concepts, not their engines. Primary references:

- https://github.com/alibaba/formily
- https://github.com/alibaba/lowcode-engine
- https://github.com/xaboy/form-create-designer/tree/next
- https://github.com/baidu/amis

## Validation Pipeline And Diagnostics

1. Read document and rules versions from unknown JSON.
2. Apply adjacent pure JSON migrations to current versions.
3. Run the strict current-version document and rules parsers.
4. Run semantic passes: duplicate IDs/fields, illegal containment, material/slot existence and registry references.
5. Delegate validation descriptor compilation to `@moluoxixi/zod3-to-rule`; compile conditions and material bindings in designer core.
6. Return `{ fields, diagnostics }`; do not partially render documents with error-severity diagnostics.

All layers normalize errors to one `DesignerDiagnostic` contract containing code, severity, JSON path, message and optional node ID. UI rendering consumes diagnostics but never parses raw Zod issues or registry exceptions.

## Compatibility And Rollback

- Existing ConfigForm runtime/headless contracts and handwritten `ConfigFormNode[]` remain unchanged.
- The designer and Element Plus designer adapter are new opt-in packages.
- Generic runtime-config reverse import is outside MVP; a later bridge may import only static, identifiable subsets with diagnostics.
- Removing the new packages and playground route restores the pre-feature state without data or API migration.
- Designer document version migrations are forward-only pure functions; the original imported JSON remains available to the host when a migration fails.

## Verification Strategy

- Contract tests: JSON-only enforcement, version gate/migrations, structured diagnostic paths.
- Reducer tests: every command, subtree copy IDs, cycle/slot rejection, duplicate field rejection, immutable caller input.
- Compiler tests: material/binding resolution, condition truth tables, validation descriptor -> Zod behavior, custom registry references.
- Component tests: palette, selection, property editing, history boundaries, empty drop zones and keyboard move commands.
- E2E: palette -> canvas -> nested move -> property/validation/condition edit -> preview -> export/import -> equivalent preview.
- Compatibility regression: existing ConfigForm runtime, adapters and 200-field scenarios remain unchanged.
- Performance baseline: operations on a representative 200-node document remain responsive; introduce a stricter numeric budget only after measuring the first implementation.

## Property Editing Commit Semantics

- discrete setters (switch, select, stepper) commit immediately;
- text setters commit on blur or Enter and cancel on Escape;
- compound condition/validation editors use Apply/Cancel;
- each complete edit is one command/history entry.
