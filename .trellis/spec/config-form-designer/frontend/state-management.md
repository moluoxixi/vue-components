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
  layout: { span?: { min: number, max: number } }
}

type ModelOperation
  = { type: 'insert', node: LowCodeNode, target: ModelNodeTarget }
  | { type: 'move', nodeId: string, target: ModelNodeTarget }
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
- Opening a version 1 workspace may read `form.designer.json`. Normal editing must not parse `App.vue` or
  `form.config.ts` back into model state.
- Source and Config are opened from the single Export menu and are read-only. Config export serializes
  `LowCodePageModel`, not the compatibility `DesignerDocument`.
- Runtime form values belong to the Preview instance. They never update page structure.

## 4. Validation & Error Matrix

| Condition | Required result |
| --- | --- |
| Inserted root or descendant component is absent from Registry | `MODEL_COMPONENT_UNKNOWN`; no mutation |
| Inserted subtree contains duplicate IDs or conflicts with existing IDs | `MODEL_NODE_ID_DUPLICATE`; no mutation |
| Target parent, slot, accepted kind, or accepted material is invalid | Matching `MODEL_TARGET_*` diagnostic; no mutation |
| Move targets the moving node's own subtree | `MODEL_MOVE_CYCLE`; no mutation |
| Resize span is not an integer in `1..24` or `null` | `MODEL_RESIZE_INVALID`; no mutation |
| Updated property, event key, or binding key is absent from the Component Registry | Matching `MODEL_PROP_UNKNOWN`, `MODEL_EVENT_UNKNOWN`, or `MODEL_BINDING_UNKNOWN`; no mutation |
| Registered event action or binding source is empty/non-string | Matching `MODEL_EVENT_ACTION_INVALID` or `MODEL_BINDING_SOURCE_INVALID`; no mutation |
| Duplicate omits an ID for any source descendant | `MODEL_DUPLICATE_MAPPING_INCOMPLETE`; no mutation |
| Batch is empty | `MODEL_BATCH_EMPTY`; no history entry or revision change |
| Any nested batch operation fails | Roll back the complete batch to the original model |

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
- Integration: both built-in adapter projects install, type-check, and build from generated files.
- Browser: Components/Layers/Pages are reachable; Layers selection updates Inspector; a committed Inspector edit updates
  Canvas and the open Preview; Source/Config open only through the Export menu and remain read-only.

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
