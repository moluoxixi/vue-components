# Design-first Config Model State

## 1. Scope / Trigger

This contract applies when changing the ConfigForm Designer model, Workbench page state, model operations, history,
runtime preview, or Source/Config export. `LowCodePageModel` is the only long-lived mutable page structure in the
Workbench. Selection, panel state, Preview values, Monaco state, and generated files are projections or transient UI
state.

The existing `DesignerDocument` remains a compatibility projection while the reusable Designer component and version 1
workspace artifact still use that shape. It must not become a second editable draft.

## 2. Signatures

```ts
interface LowCodePageModel {
  id: string
  name: string
  version: 1
  props: DesignerJsonObject
  form: DesignerFormSettings
  nodes: LowCodeNode[]
  flows?: ConfigFormFlow[]
}

interface LowCodeNode {
  id: string
  component: string
  props: DesignerJsonObject
  events: Record<string, RegisteredEventAction[]>
  bindings: Record<string, RegisteredBinding>
  children: LowCodeNode[]
  slots: Record<string, LowCodeNode[]>
  kind: DesignerNodeKind
}

interface LowCodeComponentDefinition {
  component: string
  runtime: DesignerRuntimeMaterialBinding
  sourceComponent?: string
  props: DesignerPropertySetterDefinition[]
  events: LowCodeEventSchema[]
  bindings: LowCodeBindingSchema[]
  slots: DesignerMaterialSlotDefinition[]
  allowedParents: DesignerMaterialParentDefinition[]
  layout: { span?: { min: number, max: number } }
}

type ModelOperation
  = { type: 'insert', node: LowCodeNode, target: ModelNodeTarget }
  | { type: 'move', nodeId: string, target: ModelNodeTarget }
  | { type: 'updateFlows', flows?: ConfigFormFlow[] }
  | { type: 'updateProps' | 'updateEvents' | 'updateBindings', nodeId: string, /* payload */ }
  | { type: 'updateNode', nodeId: string, patch: ModelNodePatch }
  | { type: 'resize', nodeId: string, span: number | null }
  | { type: 'duplicate', nodeId: string, target: ModelNodeTarget, idMap: Record<string, string> }
  | { type: 'remove', nodeId: string }
  | { type: 'batch', operations: ModelOperation[] }

applyModelOperation(model, operation, registry): ModelOperationResult
applyConfigModelOperation(history, operation, registry): ConfigModelHistoryResult

interface DesignerCommandControl {
  apply(command: DesignerCommand, projectedDocument: DesignerDocument): boolean
}

interface ModelOperationOptions {
  /** Optional host-side action registry used to reject unknown Flow refs. */
  flowActions?: ConfigFormFlowActionRegistry
}

interface ConfigFormFlow {
  version: 1
  id: string
  name: string
  trigger: { kind: 'page.mount' | 'form.submit' | 'field.change', field?: string }
  nodes: ConfigFormFlowNode[]
  edges: ConfigFormFlowEdge[]
}
```

## 3. Contracts

The normal Workbench flow is one way:

```text
legacy Designer artifact (open/migrate once)
  -> LowCodePageModel
  -> DesignerDocument compatibility projection -> Design / Runtime Renderer / Preview
  -> stable Config JSON -> readonly JSON or Tree viewer
  -> generated Vue project files -> readonly Monaco or download
```

- `component` is a Component Registry key, never a Vue component instance or arbitrary HTML tag.
- Default children live in `children`; only named-slot children live in `slots`. Do not duplicate the same node in both.
- Model operations apply to a clone and commit atomically. A successful history entry stores both the operation and its
  inverse; a failed operation returns the original model and does not advance `revision`.
- In a controlled Workbench, Designer commands must call `DesignerCommandControl.apply` before committing local
  Designer history. A rejected Model operation leaves the current `DesignerDocument` projection unchanged; the next
  accepted Model revision refreshes that projection.
- `events` and `bindings` are JSON-safe registered IR. Version 1 only whitelists event and binding keys through the
  Component Registry, then stores non-empty `action` and `source` references as opaque strings. It does not execute,
  compile, or validate workflow semantics. User functions and source snippets do not belong in the model; the deferred
  workflow engine owns action/source catalogs and execution.
- Palette, Canvas, Preview, Inspector, and Source generation use one `LowCodeComponentRegistry`. The Designer Registry
  is reached through `lowCodeRegistry.designer`; generated portable component names come from
  `LowCodeComponentDefinition.sourceComponent`. A missing definition or source projection blocks the operation/export.
- A structural material may declare `allowedParents: Array<{ material, slot }>` in the Component Registry. This is a
  placement capability, not persisted page data. Document analysis, live Runtime projection, Designer commands, and
  Config Model insert/move validation must all enforce the same contract. Invalid stored structural children are
  diagnosed and omitted from the live projection so a missing provider cannot corrupt Vue's component tree.
- Opening a version 1 workspace may read `form.designer.json`. Normal editing must not parse `App.vue` or
  `form.config.ts` back into model state.
- Source and Config are opened from the single Export menu and are read-only. Config export serializes
  `LowCodePageModel`, not the compatibility `DesignerDocument`.
- Runtime form values belong to the Preview instance. They never update page structure.
- Pointer dragging never reorders business DOM. The drag controller creates one Registry-backed candidate node and
  projects the candidate Model through the same RuntimeSurface used after commit. Pointer up submits one semantic
  insert/move command; pointer cancel, readonly teardown, and unmount discard the candidate without advancing history.
- Nested inside targets are sticky while the pointer still hits the same parent. This prevents the candidate's real
  height from moving the pointer into a different before/after geometry band. A real empty Flex/Grid may have zero
  runtime height; only during an active drag, the resolver inflates its measured geometry into a small hit band and the
  editor overlay draws the drop indicator. It must not add a persisted child, trailing sentinel, or Runtime placeholder.
- `LowCodePageModel.flows` is an optional JSON-only DAG projection. `analyzeConfigFormFlow` validates graph shape before
  an operation commits; when a host provides `ModelOperationOptions.flowActions`, every action node ref must resolve in
  that registry. Flow runtime values, outputs, trace, abort signals, and concurrency queues are transient and never
  mutate page structure.
- RuntimeSurface metadata (`data-config-node-id`, `data-config-path`, `data-config-slot`, and node kind) is derived from
  the same model path in Design and Preview. Design mode may intercept control events, but must not replace registered
  runtime components with static summaries; selection and drop visuals belong to an editor overlay.
- `DESIGNER_LOCALE_KEY` follows Vue's descendant-only provide/inject boundary. A Workbench dialog or sibling projection
  rendered outside `ConfigFormDesigner` must accept the same `DesignerLocaleOptions` explicitly (while it may retain an
  injected fallback); it must not assume the Designer's internal provider is visible across sibling component trees.

## 4. Validation & Error Matrix

| Condition | Required result |
| --- | --- |
| Inserted root or descendant component is absent from Registry | `MODEL_COMPONENT_UNKNOWN`; no mutation |
| Inserted subtree contains duplicate IDs or conflicts with existing IDs | `MODEL_NODE_ID_DUPLICATE`; no mutation |
| Target parent, slot, accepted kind, or accepted material is invalid | Matching `MODEL_TARGET_*` diagnostic; no mutation |
| A material is outside every Registry `allowedParents` location | `DESIGNER_MATERIAL_PARENT_INVALID` or `MODEL_TARGET_PARENT_INVALID`; no mutation / live mount |
| Move targets the moving node's own subtree | `MODEL_MOVE_CYCLE`; no mutation |
| Resize span is not an integer in `1..24` or `null` | `MODEL_RESIZE_INVALID`; no mutation |
| Updated property, event key, or binding key is absent from the Component Registry | Matching `MODEL_PROP_UNKNOWN`, `MODEL_EVENT_UNKNOWN`, or `MODEL_BINDING_UNKNOWN`; no mutation |
| Registered event action or binding source is empty/non-string | Matching `MODEL_EVENT_ACTION_INVALID` or `MODEL_BINDING_SOURCE_INVALID`; no mutation |
| Duplicate omits an ID for any source descendant | `MODEL_DUPLICATE_MAPPING_INCOMPLETE`; no mutation |
| Batch is empty | `MODEL_BATCH_EMPTY`; no history entry or revision change |
| Any nested batch operation fails | Roll back the complete batch to the original model |
| Flow graph is malformed, cyclic, unreachable, or has an incomplete branch | Flow diagnostic from `analyzeConfigFormFlow`; no model mutation |
| Flow action ref is unknown when a host registry is supplied | `MODEL_FLOW_ACTION_UNKNOWN`; no model mutation |

## 5. Good / Base / Bad Cases

- Good: apply one `batch` operation for a multi-selection delete, then store its reversed inverse batch in history.
- Good: let a controlled Designer calculate the projected command result, commit the corresponding Model Operation,
  then refresh the Designer from `configModelToDesignerDocument(history.present)`.
- Base: convert a stored version 1 Designer artifact to `LowCodePageModel` on open and generate the TypeScript Config
  module from the Design projection.
- Bad: keep `sourceDraft`, `configDraft`, and a Designer document ref, then watch and parse them in both directions.
- Bad: export `configModelToDesignerDocument(model)` as "Config Model" because that drops page metadata,
  `events`, and `bindings`.
- Bad: let the controlled Designer commit local history before the Model reducer accepts the command; a rejected
  Registry validation would split Canvas state from Preview and exports.

## 6. Tests Required

- Unit: every operation succeeds with the expected inverse and rejects invalid IDs, Registry keys, targets, resize values,
  duplicate mappings, and empty batches without mutating the input.
- Unit: undo applies the stored inverse; redo replays the original operation; failed operations do not change revision.
- Unit: a controlled Designer command rejected by `DesignerCommandControl.apply` does not emit a document update or
  change the exported projection.
- Unit: Source generation resolves every component through the supplied Registry and rejects an unregistered component.
- Unit: DesignerDocument compatibility projection preserves supported field/container structure and default/named slot
  placement.
- Unit: root and nested candidate targets resolve append indices without DOM reordering; sticky nested and collapsed
  geometry targets remain deterministic; palette cancellation removes candidate/overlay state without emitting a Model
  mutation.
- Unit: structural children with `allowedParents` are accepted only in the declared material/slot pair, rejected at the
  root and wrong parents, and omitted from live Runtime projection when loading invalid stored documents.
- Unit: a Workbench projection outside the Designer provider applies an explicit locale and reacts when the locale
  options are replaced without mutating the Config Model.
- Integration: both built-in adapter projects install, type-check, and build from generated files.
- Browser: Components/Layers/Pages are reachable; Layers selection updates Inspector; a committed Inspector edit updates
  Canvas and the open Preview; Source/Config open only through the Export menu and remain read-only.
- Browser: palette drops into populated Flex/Grid and other legal nested slots append to the intended parent, then the
  Runtime Preview renders the same committed node count and order. Test helpers must bring the source and final target
  into view before pointer movement so a viewport miss cannot masquerade as a Designer regression.

## 7. Wrong vs Correct

### Wrong

```ts
function updateConfig(source: string) {
  configDraft.value = source
  designerDocument.value = parseDesignerConfig(source).document
}
```

### Correct

```ts
const designerDocument = computed(() => configModelToDesignerDocument(configModel.value))
const generatedConfigJson = computed(() => JSON.stringify(configModel.value, null, 2))

function applyDesignCommand(command: DesignerCommand, projected: DesignerDocument) {
  const operation = designerCommandToModelOperation(command, projected, configModel.value.props)
  return commitModelHistory(applyConfigModelOperation(history.value, operation, registry.value))
}
```

The compatibility conversion is owned at the Design boundary. Generated Source and Config never call the reverse path.
